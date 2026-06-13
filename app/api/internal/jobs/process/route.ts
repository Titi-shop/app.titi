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
   - cron-triggered
   - no client usage
===================================================== */

export async function GET() {

  try {

    const result =
      await withTransaction(
        async (client) => {

          /* =====================================================
             1. GET EXPIRED ESCROW HOLDS

             CONDITIONS:
             - HOLD
             - release time reached
             - already delivered/shipped
          ===================================================== */

          const { rows } =
            await client.query<{
              id: string;
              order_id: string;
              seller_id: string;
              amount: string;
            }>(
              `
              SELECT
                id,
                order_id,
                seller_id,
                amount

              FROM escrow_entries

              WHERE
                release_status = 'HOLD'
                AND status = 'PAID'
                AND release_after IS NOT NULL
                AND release_after <= NOW()
              FOR UPDATE SKIP LOCKED
              `
            );

          let processed = 0;

          /* =====================================================
             2. PROCESS EACH ESCROW
          ===================================================== */

          for (const escrow of rows) {

            const amount =
              Number(
                escrow.amount
              );

            if (
              Number.isNaN(
                amount
              ) ||
              amount <= 0
            ) {
              continue;
            }

            /* =====================================================
               2.1 ENSURE SELLER WALLET
            ===================================================== */

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

            /* =====================================================
               2.2 CREDIT SELLER WALLET
            ===================================================== */

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

            /* =====================================================
               2.3 INSERT LEDGER
            ===================================================== */

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
              `,
              [
                escrow.seller_id,
                escrow.id,
                amount,
              ]
            );

            /* =====================================================
               2.4 UPDATE ESCROW
            ===================================================== */

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
              `,
              [escrow.id]
            );

            /* =====================================================
               2.5 COMPLETE ORDER
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

            /* =====================================================
               2.6 COMPLETE ORDER ITEMS
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

            /* =====================================================
               2.7 SETTLEMENT EVENT
            ===================================================== */

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
              `,
              [escrow.id]
            );

            processed++;
          }

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
      "[JOBS][PROCESS]",
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
