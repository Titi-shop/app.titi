import { NextRequest, NextResponse } from "next/server";

import { getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { query } from "@/lib/db";
import {
  getVariantsByProductId,
  replaceVariantsByProductId,
  type ProductVariant,
} from "@/lib/db/variants";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
}

if (!SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
}

/* =========================
   TYPES
========================= */
type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  detail: string | null;
  images: string[] | null;
  thumbnail: string | null;
  category_id: string | null;
  price: number;
  sale_price: number | null;
  sale_start: string | null;
  sale_end: string | null;
  views: number | null;
  sold: number | null;
  stock: number | null;
  is_active: boolean | null;
  rating_avg: number | null;
  rating_count: number | null;
};

type PatchBody = {
  name?: string;
  description?: string;
  detail?: string;
  images?: string[];
  thumbnail?: string | null;
  categoryId?: string | null;
  price?: number;
  salePrice?: number | null;
  saleStart?: string | null;
  saleEnd?: string | null;
  stock?: number;
  is_active?: boolean;
  variants?: ProductVariant[];
};


function normalizeVariants(input: unknown): ProductVariant[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, index) => {
      if (typeof item !== "object" || item === null) return null;

      const row = item as Record<string, unknown>;

      const optionValue =
        typeof row.optionValue === "string"
          ? row.optionValue.trim()
          : "";

      if (!optionValue) return null;

      return {
        id: typeof row.id === "string" ? row.id : undefined,
        optionName:
          typeof row.optionName === "string" && row.optionName.trim() !== ""
            ? row.optionName.trim()
            : "size",
        optionValue,
        stock:
          typeof row.stock === "number" &&
          !Number.isNaN(row.stock) &&
          row.stock >= 0
            ? row.stock
            : 0,
        sku:
          typeof row.sku === "string" && row.sku.trim() !== ""
            ? row.sku.trim()
            : null,
        sortOrder:
          typeof row.sortOrder === "number" && !Number.isNaN(row.sortOrder)
            ? row.sortOrder
            : index,
        isActive:
          typeof row.isActive === "boolean"
            ? row.isActive
            : true,
      };
    })
    .filter((item): item is ProductVariant => item !== null);
}

function getTotalVariantStock(variants: ProductVariant[]) {
  return variants.reduce((sum, item) => sum + (item.stock || 0), 0);
}
/* =========================
   HELPERS
========================= */
function supabaseHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

/* =========================
   PATCH /api/products/[id]
========================= */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const user = await getUserFromBearer();

if (!user) {
  return NextResponse.json(
    { error: "UNAUTHENTICATED" },
    { status: 401 }
  );
}

// map → UUID
const userRes = await query(
  `SELECT id FROM users WHERE pi_uid = $1 LIMIT 1`,
  [user.pi_uid]
);

if (userRes.rowCount === 0) {
  return NextResponse.json(
    { error: "USER_NOT_FOUND" },
    { status: 404 }
  );
}

const userId = userRes.rows[0].id;

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    const body = (await req.json()) as PatchBody;
const normalizedVariants = normalizeVariants(body.variants);
const hasVariants = normalizedVariants.length > 0;

const finalStock = hasVariants
  ? getTotalVariantStock(normalizedVariants)
  stock: finalStock,
  ? body.stock
  : 0;

const updatePayload = {
      name: typeof body.name === "string" ? body.name.trim() : "",
      description:
        typeof body.description === "string" ? body.description : "",
      detail: typeof body.detail === "string" ? body.detail : "",
      images: Array.isArray(body.images)
        ? body.images.filter((item): item is string => typeof item === "string")
        : [],
      category_id:
        typeof body.categoryId === "string" && body.categoryId.trim() !== ""
          ? body.categoryId
          : null,
      price: typeof body.price === "number" && !Number.isNaN(body.price) ? body.price : 0,
      sale_price:
        typeof body.salePrice === "number" && !Number.isNaN(body.salePrice)
          ? body.salePrice
          : null,
      sale_start:
        typeof body.saleStart === "string" && body.saleStart.trim() !== ""
          ? body.saleStart
          : null,
      sale_end:
        typeof body.saleEnd === "string" && body.saleEnd.trim() !== ""
          ? body.saleEnd
          : null,
      stock:
        typeof body.stock === "number" && body.stock >= 0 ? body.stock : 0,
      is_active:
        typeof body.is_active === "boolean" ? body.is_active : true,
      thumbnail:
  typeof body.thumbnail === "string" && body.thumbnail.trim() !== ""
    ? body.thumbnail
    : Array.isArray(body.images) && body.images.length > 0
    ? body.images[0]
    : null,
    };

    const updateRes = await fetch(
`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}&seller_id=eq.${userId}`,
      {
        method: "PATCH",
        headers: {
          ...supabaseHeaders(),
          Prefer: "return=representation",
        },
        body: JSON.stringify(updatePayload),
      }
    );

    if (!updateRes.ok) {
      const text = await updateRes.text();
      console.error("❌ PATCH PRODUCT ERROR:", text);
      return NextResponse.json(
        { error: "FAILED_TO_UPDATE_PRODUCT" },
        { status: 500 }
      );
    }

    const data: ProductRow[] = await updateRes.json();

    if (!data.length) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (Array.isArray(body.variants)) {
  await replaceVariantsByProductId(id, normalizedVariants);
}

    const updatedVariants = await getVariantsByProductId(id);

    return NextResponse.json({
      id: data[0].id,
      name: data[0].name,
      price: data[0].price,

      salePrice: data[0].sale_price ?? null,
      saleStart: data[0].sale_start ?? null,
      saleEnd: data[0].sale_end ?? null,

      description: data[0].description ?? "",
      detail: data[0].detail ?? "",

      images: data[0].images ?? [],
      thumbnail: data[0].thumbnail ?? (data[0].images?.[0] ?? ""),

      categoryId: data[0].category_id ?? "",
      stock: data[0].stock ?? 0,
      is_active: data[0].is_active ?? true,

      views: data[0].views ?? 0,
     sold: data[0].sold ?? 0,
     rating_avg: data[0].rating_avg ?? 0,
     rating_count: data[0].rating_count ?? 0,

      variants: updatedVariants,
    });
  } catch (err) {
    console.error("❌ PRODUCT PATCH ERROR:", err);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}

/* =========================
   GET /api/products/[id]
========================= */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_PRODUCT_ID" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=*`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ FETCH PRODUCT ERROR:", text);
      return NextResponse.json(
        { error: "FAILED_TO_FETCH_PRODUCT" },
        { status: 500 }
      );
    }

    const data: ProductRow[] = await res.json();

    if (data.length === 0) {
      return NextResponse.json(
        { error: "PRODUCT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const p = data[0];
    const variants = await getVariantsByProductId(id);

    return NextResponse.json({
      id: p.id,
      name: p.name,
      price: p.price,

      salePrice: p.sale_price ?? null,
      saleStart: p.sale_start ?? null,
      saleEnd: p.sale_end ?? null,

      description: p.description ?? "",
      detail: p.detail ?? "",

      images: p.images ?? [],
      thumbnail: p.thumbnail ?? (p.images?.[0] ?? ""),

      categoryId: p.category_id ?? "",
      stock: p.stock ?? 0,
      is_active: p.is_active ?? true,

      views: p.views ?? 0,
sold: p.sold ?? 0,
rating_avg: p.rating_avg ?? 0,
rating_count: p.rating_count ?? 0,

      variants,
    });
  } catch (err) {
    console.error("❌ PRODUCT [ID] ERROR:", err);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
