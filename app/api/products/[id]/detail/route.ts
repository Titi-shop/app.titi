import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getUserFromBearer,
} from "@/lib/auth/getUserFromBearer";

import {
  getProductDetailService,
} from "@/lib/services/products/detail";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const auth =
    await getUserFromBearer();

  const userId =
    auth?.userId ?? null;

  const { id } =
    await context.params;

  const result =
    await getProductDetailService(
      id,
      userId
    );

  return NextResponse.json(
    result
  );
}
