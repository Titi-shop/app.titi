export async function processExpiredPaymentIntentJob() {
  return withTransaction(async (client) => {

    const res = await client.query<{
      id: string;
      product_id: string;
      variant_id: string | null;
      quantity: number;
    }>(
      `
      SELECT
        id,
        product_id,
        variant_id,
        quantity
      FROM payment_intents
      WHERE
        expires_at <= now()
        AND status IN (
          'created',
          'submitted',
          'authorized'
        )
      FOR UPDATE
      `
    );

    return {
      success: true,
      processed: 0,
    };
  });
}
