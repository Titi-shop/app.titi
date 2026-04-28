export async function POST() {
  return Response.json(
    { error: "DEPRECATED_ENDPOINT_USE_PAYMENTS_V2" },
    { status: 410 }
  );
}
