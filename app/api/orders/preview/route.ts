export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireAuth(req);

  const body = await req.json();
  const { country, items } = body;

  const result = await previewOrder({
    userId: user.id,
    country,
    items,
  });

  return Response.json(result);
}
