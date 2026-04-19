export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    console.log("🧪 [WALLET API] userId:", auth.userId);

    const wallet = await getWalletByUserId(auth.userId);

    console.log("🧪 [WALLET API] result:", wallet);

    return NextResponse.json({
      balance: wallet?.balance ?? 0,
    });

  } catch (err) {
    console.error("[WALLET][GET_ERROR]", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
