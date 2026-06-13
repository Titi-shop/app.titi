
import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic =
  "force-dynamic";

/* =====================================================
   INTERNAL JOBS PROCESSOR

   RESPONSIBILITIES:
   - auto complete orders
   - auto release escrow
   - auto seller payout

   IMPORTANT:
   - server-side only
   - manually triggered / cron-triggered
===================================================== */

export async function GET() {

  console.log(
    "[JOBS][START]"
  );

  try {

    const result =
      await withTransaction(
        async (client) => {

          /* =====================================================
             1. FIND EXPIRED ESCROW
          ===================================================== */

          const { rows } =
            await client.query<{
              id: string;
              order_id: string;
              seller_id: string;
              amount: string;
              status: string;
              release_status: string;
              release_after: string;
            }>(
              `
              SELECT
                id,
                order_id,
                seller_id,
                amount,
                status,
                release_status,
                release_after

              FROM escrow_entries

              WHERE
                release_status = 'HOLD'

                AND status IN (
                  'PAID',
                  'SETTLED'
                )

                AND release_after IS NOT NULL

                AND release_after <= NOW()

              FOR UPDATE SKIP LOCKED
              `
            );

          console.log(
            "[JOBS][FOUND_ESCROWS]",
            {
              count:
                rows.length,

              rows,
            }
          );

          let processed = 0;

          /* =====================================================
             2. PROCESS EACH ESCROW
          ===================================================== */

          for (const escrow of rows) {

            console.log(
              "[JOBS][PROCESS_ESCROW]",
              escrow
            );

            try {

              const amount =
                Number(
                  escrow.amount
                );

              console.log(
                "[JOBS][AMOUNT]",
                {
                  raw:
                    escrow.amount,

                  parsed:
                    amount,
                }
              );

              if (
                Number.isNaN(
                  amount
                ) ||
                amount <= 0
              ) {

                console.warn(
                  "[JOBS][INVALID_AMOUNT]",
                  {
                    escrowId:
                      escrow.id,

                    amount,
                  }
                );

                continue;
              }

              /* =====================================================
                 2.1 ENSURE WALLET
              ===================================================== */

              const walletInsert =
                await client.query(
                  `
                  INSERT INTO wallets (
                    user_id,
                    balance
                  )
                  VALUES ($1, 0)

                  ON CONFLICT (user_id)
                  DO NOTHING
                  `,
                  [
                    escrow.seller_id,
                  ]
                );

              console.log(
                "[JOBS][WALLET_ENSURED]",
                {
                  rowCount:
                    walletInsert.rowCount,
                }
              );

              /* =====================================================
                 2.2 CREDIT WALLET
              ===================================================== */

              const walletUpdate =
                await client.query(
                  `
                  UPDATE wallets

                  SET
                    balance =
                      balance + $1,

                    updated_at =
                      NOW()

                  WHERE user_id = $2
                  `,
                  [
                    amount,
                    escrow.seller_id,
                  ]
                );

              console.log(
                "[JOBS][WALLET_UPDATED]",
                {
                  rowCount:
                    walletUpdate.rowCount,

                  sellerId:
                    escrow.seller_id,

                  amount,
                }
              );

              /* =====================================================
                 2.3 WALLET JOURNAL
              ===================================================== */

              const journalInsert =
                await client.query(
                  `
                  INSERT INTO wallet_journal (
                    owner_id,
                    owner_type,

                    ref_id,
                    ref_table,

                    entry_type,
                    direction,

                    amount,
                    currency,

                    note
                  )
                  VALUES (
                    $1,
                    'SELLER',

                    $2,
                    'escrow_entries',

                    'SELLER_CREDIT',
                    'CREDIT',

                    $3,
                    'PI',

                    'Auto escrow release'
                  )

                  RETURNING id
                  `,
                  [
                    escrow.seller_id,
                    escrow.id,
                    amount,
                  ]
                );

              console.log(
                "[JOBS][JOURNAL_INSERTED]",
                {
                  rowCount:
                    journalInsert.rowCount,

                  rows:
                    journalInsert.rows,
                }
              );

              /* =====================================================
                 2.4 UPDATE ESCROW
              ===================================================== */

              const escrowUpdate =
                await client.query(
                  `
                  UPDATE escrow_entries

                  SET
                    release_status =
                      'RELEASED',

                    released_amount =
                      amount,

                    released_at =
                      NOW(),

                    updated_at =
                      NOW()

                  WHERE id = $1
                    AND release_status = 'HOLD'

                  RETURNING
                    id,
                    release_status,
                    released_at
                  `,
                  [escrow.id]
                );

              console.log(
                "[JOBS][ESCROW_RELEASED]",
                {
                  rowCount:
                    escrowUpdate.rowCount,

                  rows:
                    escrowUpdate.rows,
                }
              );

              /* =====================================================
                 2.5 COMPLETE ORDER
              ===================================================== */

              const orderUpdate =
                await client.query(
                  `
                  UPDATE orders

                  SET
                    fulfillment_status =
                      'completed',

                    completed_at =
                      NOW(),

                    updated_at =
                      NOW()

                  WHERE id = $1

                  RETURNING
                    id,
                    fulfillment_status,
                    completed_at
                  `,
                  [escrow.order_id]
                );

              console.log(
                "[JOBS][ORDER_COMPLETED]",
                {
                  rowCount:
                    orderUpdate.rowCount,

                  rows:
                    orderUpdate.rows,
                }
              );

              /* =====================================================
                 2.6 COMPLETE ORDER ITEMS
              ===================================================== */

              const itemsUpdate =
                await client.query(
                  `
                  UPDATE order_items

                  SET
                    fulfillment_status =
                      'completed',

                    completed_at =
                      NOW(),

                    updated_at =
                      NOW()

                  WHERE order_id = $1
                    AND fulfillment_status IN (
                      'shipped',
                      'delivered'
                    )

                  RETURNING
                    id,
                    fulfillment_status
                  `,
                  [escrow.order_id]
                );

              console.log(
                "[JOBS][ORDER_ITEMS_COMPLETED]",
                {
                  rowCount:
                    itemsUpdate.rowCount,

                  rows:
                    itemsUpdate.rows,
                  }
              );

              /* =====================================================
                 2.7 SETTLEMENT EVENT
              ===================================================== */

              const eventInsert =
                await client.query(
                  `
                  INSERT INTO settlement_events (
                    escrow_id,
                    event_type,
                    source,
                    reason,
                    metadata
                  )
                  VALUES (
                    $1,
                    'AUTO_RELEASE',
                    'SYSTEM',
                    'Release timer reached',
                    '{}'::jsonb
                  )

                  RETURNING id
                  `,
                  [escrow.id]
                );

              console.log(
                "[JOBS][EVENT_INSERTED]",
                {
                  rowCount:
                    eventInsert.rowCount,

                  rows:
                    eventInsert.rows,
                }
              );

              processed++;

              console.log(
                "[JOBS][ESCROW_DONE]",
                {
                  escrowId:
                    escrow.id,

                  processed,
                }
              );

            } catch (escrowError) {

              console.error(
                "[JOBS][ESCROW_FAILED]",
                {
                  escrowId:
                    escrow.id,

                  message:
                    escrowError instanceof Error
                      ? escrowError.message
                      : "UNKNOWN",
                }
              );

              throw escrowError;
            }
          }

          console.log(
            "[JOBS][FINISHED]",
            {
              processed,
            }
          );

          return {
            success: true,
            processed,
          };
        }
      );

    return NextResponse.json(
      result
    );

  } catch (error) {

    console.error(
      "[JOBS][PROCESS_FATAL]",
      {
        message:
          error instanceof Error
            ? error.message
            : "UNKNOWN",
      }
    );

    return NextResponse.json(
      {
        error:
          "INTERNAL_SERVER_ERROR",
      },
      {
        status: 500,
      }
    );
  }
}
```
