import { NextResponse } from "next/server";
import { validate as isUuid } from "uuid";
import {
  getSellerAddresses,
  createSellerAddress,
} from "@/lib/db/sellerAddresses";

export async function GET(req: Request) {
  const sellerId = req.headers.get("x-seller-id");

  if (!sellerId || !isUuid(sellerId)) {
    return NextResponse.json(
      { error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const data = await getSellerAddresses(sellerId);

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();

  const sellerId = req.headers.get("x-seller-id");

  if (!sellerId || !isUuid(sellerId)) {
    return NextResponse.json(
      { error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const data = await createSellerAddress({
    ...body,
    seller_id: sellerId,
  });

  return NextResponse.json(data);
}
