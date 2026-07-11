import { NextResponse } from "next/server";
import { upsertUserFromPi } from "@/lib/db/users";
const PI_API_URL =
  process.env.PI_API_URL ??
  "https://api.minepi.com/v2";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================= TYPES ================= */
type PiMeResponse = {
  uid?: string;
  username?: string;
  wallet_address?: string | null;
};

/* ================= BLOCK GET ================= */
export async function GET() {
  return new Response("Method Not Allowed", { status: 405 });
}

/* ================= POST ================= */
export async function POST(req: Request) {
  try {
    /* ================= 1️⃣ GET TOKEN ================= */
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "MISSING_ACCESS_TOKEN" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7).trim();
    console.log(
  "[VERIFY] TOKEN LENGTH",
  accessToken.length
  );
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "MISSING_ACCESS_TOKEN" },
        { status: 400 }
      );
    }

    /* ================= 2️⃣ VERIFY PI ================= */
    const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

const piRes = await fetch(`${PI_API_URL}/me`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  },
  cache: "no-store",
  signal: controller.signal,
}).finally(() => clearTimeout(timeout));
console.log("[VERIFY] URL =", `${PI_API_URL}/me`);
console.log("[VERIFY] STATUS", piRes.status);

console.log(
  "[VERIFY] CONTENT-TYPE",
  piRes.headers.get("content-type")
);

console.log(
  "[VERIFY] TOKEN",
  accessToken.slice(0, 20) + "..."
);

    if (!piRes.ok) {
      return NextResponse.json(
        { success: false, error: "INVALID_ACCESS_TOKEN" },
        { status: 401 }
      );
    }
  const contentType =
piRes.headers.get("content-type");

if (
 !contentType?.includes("application/json")
){
 throw new Error(
   "INVALID_PI_RESPONSE"
 );
  }
    const raw = await piRes.text();
console.log("[VERIFY] RAW", raw);
    console.log(
  "[VERIFY] RAW TYPE",
  typeof raw
);

console.log(
  "[VERIFY] RAW LENGTH",
  raw.length
);
const data = raw ? JSON.parse(raw) : null;
    console.log(
  "[VERIFY] DATA TYPE",
  typeof data
);

console.log(
  "[VERIFY] DATA",
  data
);
console.log("[PI RESPONSE]", data);

if (
  !data ||
  typeof data !== "object" ||
  typeof data.uid !== "string" ||
  typeof data.username !== "string"
) {
  return NextResponse.json(
    {
      success: false,
      error: "INVALID_PI_USER",
      data,
    },
    {
      status: 401,
    }
  );
}

const pi_uid = data.uid.trim();

if (!pi_uid) {
  return NextResponse.json(
    {
      success: false,
      error: "INVALID_PI_UID",
    },
    {
      status: 401,
    }
  );
}
    const username = data.username.trim();

    if (!username) {
  return NextResponse.json(
    {
      success: false,
      error: "INVALID_USERNAME",
    },
    {
      status: 401,
    }
  );
}

    
    const wallet_address =
   typeof data.wallet_address === "string"
  ? data.wallet_address.trim() || null
  : null;

    /* ================= 3️⃣ UPSERT USER (DB LAYER) ================= */
    const dbUser = await upsertUserFromPi(
  pi_uid,
  username,
  wallet_address
);

    if (!dbUser?.id) {
      return NextResponse.json(
        { success: false, error: "USER_NOT_FOUND" },
        { status: 500 }
      );
    }

    /* ================= 4️⃣ ROLE ================= */
    const role =
      dbUser.role === "seller" ||
      dbUser.role === "admin" ||
      dbUser.role === "customer"
        ? dbUser.role
        : "customer";

    /* ================= 5️⃣ RESPONSE ================= */
   return NextResponse.json({
  success: true,
  user: {
  id: dbUser.id,
  pi_uid,
  username,
  wallet_address,
  role,
  is_admin: !!dbUser.is_admin,
},
});

} catch (err) {

 if (
   err instanceof DOMException &&
   err.name === "AbortError"
 ) {
   return NextResponse.json(
     {
       success:false,
       error:"PI_TIMEOUT",
     },
     {
       status:504,
     }
   );
 }

    console.error("❌ PI VERIFY ERROR:", err);

    return NextResponse.json(
      { success: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
