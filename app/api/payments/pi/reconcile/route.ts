import { NextResponse } from "next/server";
import { withTransaction, query } from "@/lib/db";

export const runtime = "nodejs";

/* =========================
   MOCK RPC
========================= */

async function verifyRpc(txid: string) {
  return {
    ok: Math.random() > 0.3,
    raw: {}
  };
}

/* =========================
   API
========================= */

export async function GET() {
  try {
    console.log("[RECONCILE] START");

    const intents = await query(
      `
      SELECT *
      FROM payment_intents
      WHERE status IN ('submitted','verifying')
      AND created_at < now() - interval '2 minutes'
      LIMIT 50
      `
    );

    for (const intent of intents.rows) {

      await withTransaction(async (client) => {

        /* =========================
           NO TXID → FAIL
        ========================= */

        if (!intent.txid) {
          await client.query(
            `
            UPDATE payment_intents
            SET status = 'failed',
                failed_reason = 'missing_txid'
            WHERE id = $1
            `,
            [intent.id]
          );
          return;
        }

        /* =========================
           VERIFY RPC AGAIN
        ========================= */

        const rpc = await verifyRpc(intent.txid);

        if (!rpc.ok) {
          await client.query(
            `
            UPDATE payment_intents
            SET status = 'failed',
                failed_reason = 'rpc_failed'
            WHERE id = $1
            `,
            [intent.id]
          );
          return;
        }

        /* =========================
           FIX STATE
        ========================= */

        await client.query(
          `
          UPDATE payment_intents
          SET status = 'paid',
              paid_at = now()
          WHERE id = $1
          `,
          [intent.id]
        );

        /* =========================
           ENSURE ORDER EXISTS
        ========================= */

        const orderCheck = await client.query(
          `SELECT order_id FROM payment_intents WHERE id=$1`,
          [intent.id]
        );

        if (!orderCheck.rows[0].order_id) {

          const order = await client.query(
            `
            INSERT INTO orders (
              buyer_id,
              seller_id,
              total_amount,
              status
            )
            VALUES ($1,$2,$3,'paid')
            RETURNING id
            `,
            [
              intent.buyer_id,
              intent.seller_id,
              intent.total_amount
            ]
          );

          await client.query(
            `
            UPDATE payment_intents
            SET order_id = $2
            WHERE id = $1
            `,
            [intent.id, order.rows[0].id]
          );
        }
      });
    }

    return NextResponse.json({
      ok: true,
      processed: intents.rowCount
    });

  } catch (e) {
    return NextResponse.json(
      { error: "RECONCILE_FAILED" },
      { status: 500 }
    );
  }
}
