import { NextResponse } from "next/server";
import { logger, maskId } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let paymentId = "";

  try {
    const PI_API = process.env.PI_API_URL;
    const PI_KEY = process.env.PI_API_KEY;

    if (!PI_API || !PI_KEY) {
      return NextResponse.json(
        { error: "PI_NOT_CONFIGURED" },
        { status: 500 }
      );
    }

    const body = await req.json();

    paymentId =
      typeof body.paymentId === "string"
        ? body.paymentId
        : "";

    const txid =
      typeof body.txid === "string"
        ? body.txid
        : "";
    if (!paymentId || !txid) {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    logger.info(
  "PI.COMPLETE_INCOMPLETE.START",
  {
    paymentId: maskId(paymentId),
    txid: maskId(txid),
  }
);

    const res = await fetch(
  `${PI_API}/v2/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${PI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txid }),
      }
    );

    const data = await res.text();

    logger.info(
  "PI.COMPLETE_INCOMPLETE.RESULT",
  {
    paymentId: maskId(paymentId),
    status: res.status,
    ok: res.ok,
  }
);

    return new NextResponse(data, { status: res.status });

  } catch (err) {
    logger.error(
  "PI.COMPLETE_INCOMPLETE.ERROR",
  {
    paymentId: maskId(paymentId),
    message:
      err instanceof Error
        ? err.message
        : "UNKNOWN_ERROR",
  }
);

if (
  process.env.NODE_ENV !==
  "production"
) {
  console.error(err);
}

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
