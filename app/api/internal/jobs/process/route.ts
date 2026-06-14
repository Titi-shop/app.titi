import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =====================================================
   TYPES
===================================================== */

type EscrowRow = {
  id: string;
  order_id: string;
  seller_id: string;
  amount: string;
  status: string;
  release_status: string;
  release_after: string | null;
};

/* =====================================================
   INTERNAL ESCROW RELEASE JOB
===================================================== */

export async function GET() {
  console.log("[JOBS][START]");

  try {
    const result = await withTransaction(
      async (client) => {

        /* =====================================================
           1. FIND RELEASABLE ESCROWS
        ===================================================== */

        const { rows } =
          await client.query<EscrowRow>(
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

              AND status = 'PAID'

              AND release_after IS NOT NULL

              AND release_after <= NOW()

            FOR UPDATE SKIP LOCKED
            `
          );

        console.log(
          "[JOBS][FOUND_ESCROWS]",
          {
            count: rows.length,
          }
        );

        let processed = 0;

        /* =====================================================
           2. PROCESS ESCROWS
        ===================================================== */

        for (const escrow of rows) {

          console.log(
            "[JOBS][PROCESS_ESCROW]",
            escrow
          );

          const amount =
            Number(escrow.amount);

          if (
            Number.isNaN(amount) ||
            amount <= 0
          ) {
            console.warn(
              "[JOBS][INVALID_AMOUNT]",
              {
                escrowId: escrow.id,
                amount,
              }
            );

            continue;
          }

          /* =====================================================
             2.1 RELEASE ESCROW
          ===================================================== */

          await client.query(
            `
            UPDATE escrow_entries

            SET
              status = 'SETTLED',

              release_status =
                'RELEASED',

              released_amount =
                amount,

              released_at =
                NOW(),

              updated_at =
                NOW(),

              escrow_version =
                escrow_version + 1

            WHERE id = $1
              AND release_status = 'HOLD'
            `,
            [escrow.id]
          );

          console.log(
            "[JOBS][ESCROW_RELEASED]",
            {
              escrowId:
                escrow.id,
            }
          );

          /* =====================================================
             2.2 RELEASE SELLER CREDIT
          ===================================================== */

          await client.query(
            `
            UPDATE seller_credits

            SET
              status = 'AVAILABLE',

              available_amount =
                amount,

              frozen_amount = 0,

              released_at =
                NOW(),

              updated_at =
                NOW(),

              ledger_version =
                ledger_version + 1

            WHERE escrow_id = $1
              AND status = 'FROZEN'
            `,
            [escrow.id]
          );

          console.log(
            "[JOBS][SELLER_CREDIT_RELEASED]",
            {
              escrowId:
                escrow.id,
            }
          );

          /* =====================================================
             2.3 WALLET JOURNAL
          ===================================================== */

          await client.query(
            `
            INSERT INTO wallet_journal (
              id,
              owner_id,
              owner_type,

              ref_id,
              ref_table,

              entry_type,
              direction,

              amount,
              currency,

              note,
              created_at
            )
            VALUES (
              gen_random_uuid(),

              $1,
              'SELLER',

              $2,
              'seller_credits',

              'SELLER_ESCROW_RELEASE',
              'CREDIT',

              $3,
              'PI',

              'Escrow released to seller',

              NOW()
            )
            `,
            [
              escrow.seller_id,
              escrow.id,
              amount,
            ]
          );

          console.log(
            "[JOBS][JOURNAL_CREATED]",
            {
              escrowId:
                escrow.id,
            }
          );

          /* =====================================================
             2.4 COMPLETE ORDER
          ===================================================== */

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
            `,
            [escrow.order_id]
          );

          console.log(
            "[JOBS][ORDER_COMPLETED]",
            {
              orderId:
                escrow.order_id,
            }
          );

          /* =====================================================
             2.5 COMPLETE ORDER ITEMS
          ===================================================== */

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
            `,
            [escrow.order_id]
          );

          console.log(
            "[JOBS][ORDER_ITEMS_COMPLETED]",
            {
              orderId:
                escrow.order_id,
            }
          );

          /* =====================================================
             2.6 SETTLEMENT EVENT
          ===================================================== */

          await client.query(
            `
            INSERT INTO settlement_events (
              id,
              escrow_id,

              event_type,
              source,
              reason,

              metadata,
              created_at
            )
            VALUES (
              gen_random_uuid(),

              $1,

              'AUTO_RELEASE',
              'SYSTEM',
              'Release timer reached',

              '{}'::jsonb,

              NOW()
            )
            `,
            [escrow.id]
          );

          console.log(
            "[JOBS][EVENT_CREATED]",
            {
              escrowId:
                escrow.id,
            }
          );

          processed++;
        }

        console.log(
          "[JOBS][DONE]",
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

    return NextResponse.json(result);

  } catch (error) {

    console.error(
      "[JOBS][FATAL]",
      {
        message:
          error instanceof Error
            ? error.message
            : "UNKNOWN",
      }
    );

    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
      },
      {
        status: 500,
      }
    );
  }
}


