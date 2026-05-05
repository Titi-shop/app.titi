import {
  getAllProducts,
  getProductsByIds,
  createProduct,
  updateProductBySeller,
  deleteProductBySeller,
} from "@/lib/db/products";

import {
  getVariantsByProductId,
  replaceVariantsByProductId,
} from "@/lib/db/variants";

import {
  getShippingRatesByProducts,
  upsertShippingRates,
} from "@/lib/db/shipping";

import { normalizeVariants } from "@/lib/validators/products";

/* ================= GET ================= */
export async function listProductsService(req: Request) {
  const { searchParams } = new URL(req.url);
  const ids = searchParams.get("ids");

  const products = ids
    ? await getProductsByIds(ids.split(",").filter(Boolean))
    : await getAllProducts();

  const productIds = products.map((p) => p.id);

  const shippingRows =
    productIds.length > 0
      ? await getShippingRatesByProducts(productIds)
      : [];

  const shippingMap = new Map<string, any[]>();

  for (const r of shippingRows) {
    if (!shippingMap.has(r.product_id)) {
      shippingMap.set(r.product_id, []);
    }

    shippingMap.get(r.product_id)!.push({
      zone: r.zone,
      price: r.price,
      domesticCountryCode: r.domestic_country_code,
    });
  }

  const now = Date.now();

  return Promise.all(
    products.map(async (p) => {
      const variants = await getVariantsByProductId(p.id);

      const enrichedVariants = variants.map((v) => ({
        ...v,
        finalPrice:
          v.saleEnabled &&
          v.salePrice &&
          v.salePrice < v.price
            ? v.salePrice
            : v.price,
      }));

      const prices = enrichedVariants.map((v) => v.finalPrice);

      return {
        ...p,
        hasVariants: variants.length > 0,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        variants: enrichedVariants,
        shippingRates: shippingMap.get(p.id) ?? [],
      };
    })
  );
}

/* ================= CREATE ================= */
export async function createProductService(req: Request, userId: string) {
  const body = await req.json();

  const variants = normalizeVariants(body.variants);

  const price =
    variants.length > 0
      ? Math.min(...variants.map((v) => v.price))
      : Number(body.price);

  const product = await createProduct(userId, {
    name: body.name,
    description: body.description ?? "",
    detail: body.detail ?? "",
    images: body.images ?? [],
    thumbnail: body.thumbnail ?? "",
    category_id: body.categoryId ?? null,
    price,
    stock: variants.length
      ? variants.reduce((s, v) => s + v.stock, 0)
      : Number(body.stock || 0),
    sale_price: body.salePrice ?? null,
    sale_enabled: body.saleEnabled ?? false,
  });

  if (variants.length) {
    await replaceVariantsByProductId(product.id, variants);
  }

  if (body.shippingRates?.length) {
    await upsertShippingRates({
      productId: product.id,
      rates: body.shippingRates,
    });
  }

  return { success: true, data: { id: product.id } };
}

/* ================= UPDATE ================= */
export async function updateProductService(req: Request, userId: string) {
  const body = await req.json();

  const variants = normalizeVariants(body.variants);

  const updated = await updateProductBySeller(userId, body.id, {
    name: body.name,
    price: body.price,
    stock: body.stock,
    sale_price: body.salePrice ?? null,
    sale_enabled: body.saleEnabled ?? false,
  });

  if (!updated) return { error: "NOT_FOUND" };

  await replaceVariantsByProductId(body.id, variants);

  return { success: true };
}

/* ================= DELETE ================= */
export async function deleteProductService(req: Request, userId: string) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return { error: "MISSING_ID" };

  const ok = await deleteProductBySeller(userId, id);

  if (!ok) return { error: "NOT_FOUND" };

  return { success: true };
}
