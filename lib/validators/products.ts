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

/* =========================================================
   HELPERS
========================================================= */

function getCategoryId(body: any) {
  return (
    body.category_id ??
    body.categoryId ??
    null
  );
}

function calcFinalPrice(
  variants: any[],
  fallbackPrice: number
) {
  if (!variants.length) {
    return fallbackPrice;
  }

  return Math.min(
    ...variants.map((v) =>
      Number(v.final_price ?? v.price ?? 0)
    )
  );
}

function normalizeShippingRates(
  body: any,
  primaryCountry?: string
) {
  const rates =
    body.shipping_rates ??
    body.shippingRates ??
    [];

  return rates.map((r: any) => ({
    zone: r.zone,

    price: Number(r.price ?? 0),

    domestic_country_code:
      r.zone === "domestic"
        ? (
            r.domestic_country_code ??
            primaryCountry ??
            body.primary_shipping_country ??
            body.primaryShippingCountry ??
            body.domestic_country_code ??
            null
          )
        : null,
  }));
}

/* =========================================================
   LIST PRODUCTS
========================================================= */

export async function listProductsService(
  req: Request
) {
  const { searchParams } = new URL(req.url);

  const ids =
    searchParams.get("ids");

  const products = ids
    ? await getProductsByIds(
        ids
          .split(",")
          .filter(Boolean)
      )
    : await getAllProducts();

  const productIds =
    products.map((p) => p.id);

  const shippingRows =
    productIds.length > 0
      ? await getShippingRatesByProducts(
          productIds
        )
      : [];

  const shippingMap =
    new Map<string, any[]>();

  for (const r of shippingRows) {
    if (
      !shippingMap.has(r.product_id)
    ) {
      shippingMap.set(
        r.product_id,
        []
      );
    }

    shippingMap
      .get(r.product_id)!
      .push({
        zone: r.zone,
        price: r.price,
        domestic_country_code:
          r.domestic_country_code,
      });
  }

  return Promise.all(
    products.map(async (p) => {
      const variants =
        await getVariantsByProductId(
          p.id
        );

      const enrichedVariants =
        variants.map((v: any) => {
          const saleActive =
            v.sale_enabled &&
            v.sale_price !== null &&
            Number(v.sale_price) > 0 &&
            Number(v.sale_price) <
              Number(v.price);

          return {
            ...v,

            final_price:
              saleActive
                ? Number(v.sale_price)
                : Number(v.price),
          };
        });

      const prices =
        enrichedVariants.map(
          (v: any) =>
            Number(v.final_price)
        );

      return {
        ...p,

        has_variants:
          variants.length > 0,

        min_price:
          prices.length
            ? Math.min(...prices)
            : null,

        max_price:
          prices.length
            ? Math.max(...prices)
            : null,

        variants:
          enrichedVariants,

        shipping_rates:
          shippingMap.get(p.id) ??
          [],
      };
    })
  );
}

/* =========================================================
   CREATE PRODUCT
========================================================= */

export async function createProductService(
  req: Request,
  userId: string
) {
  const body =
    await req.json();

  const variants =
    normalizeVariants(
      body.variants || []
    );

  const finalPrice =
    calcFinalPrice(
      variants,
      Number(body.price || 0)
    );

  const product =
    await createProduct(userId, {
      name: body.name,

      description:
        body.description ?? "",

      detail:
        body.detail ?? "",

      images:
        body.images ?? [],

      thumbnail:
        body.thumbnail ?? "",

      category_id:
        getCategoryId(body),

      price: finalPrice,

      stock: variants.length
        ? variants.reduce(
            (
              s: number,
              v: any
            ) =>
              s +
              Number(
                v.stock || 0
              ),
            0
          )
        : Number(
            body.stock || 0
          ),

      sale_price:
        body.sale_price ??
        null,

      sale_start:
        body.sale_start ??
        null,

      sale_end:
        body.sale_end ??
        null,

      sale_stock: Number(
        body.sale_stock ?? 0
      ),

      sale_enabled:
        Boolean(
          body.sale_enabled
        ),

      is_active:
        body.is_active !== false,
    });

  /* ================= VARIANTS ================= */

  if (variants.length) {
    await replaceVariantsByProductId(
      product.id,
      variants
    );
  }

  /* ================= SHIPPING ================= */

  const shippingRates =
    normalizeShippingRates(
      body,
      body.primary_shipping_country
    );

  if (shippingRates.length) {
    await upsertShippingRates({
      productId: product.id,
      rates: shippingRates,
    });
  }

  return {
    success: true,

    data: {
      id: product.id,
    },
  };
}

/* =========================================================
   UPDATE PRODUCT
========================================================= */

export async function updateProductService(
  req: Request,
  userId: string
) {
  const body =
    await req.json();

  const variants =
    normalizeVariants(
      body.variants || []
    );

  const finalPrice =
    calcFinalPrice(
      variants,
      Number(body.price || 0)
    );

  const updated =
    await updateProductBySeller(
      userId,
      body.id,
      {
        name: body.name,

        description:
          body.description,

        detail:
          body.detail,

        images:
          body.images,

        thumbnail:
          body.thumbnail,

        category_id:
          getCategoryId(body),

        price: finalPrice,

        stock: variants.length
          ? variants.reduce(
              (
                s: number,
                v: any
              ) =>
                s +
                Number(
                  v.stock || 0
                ),
              0
            )
          : Number(
              body.stock || 0
            ),

        sale_price:
          body.sale_price ??
          null,

        sale_enabled:
          body.sale_enabled ??
          false,

        sale_start:
          body.sale_start ??
          null,

        sale_end:
          body.sale_end ??
          null,

        sale_stock:
          body.sale_stock ??
          0,

        is_active:
          body.is_active ??
          true,
      }
    );

  if (!updated) {
    return {
      error: "NOT_FOUND",
    };
  }

  /* ================= VARIANTS ================= */

  await replaceVariantsByProductId(
    body.id,
    variants
  );

  /* ================= SHIPPING ================= */

  const shippingRates =
    normalizeShippingRates(
      body,
      body.primary_shipping_country
    );

  if (shippingRates.length) {
    await upsertShippingRates({
      productId: body.id,
      rates: shippingRates,
    });
  }

  return {
    success: true,

    data: {
      id: body.id,
      price: finalPrice,
    },
  };
}

/* =========================================================
   DELETE PRODUCT
========================================================= */

export async function deleteProductService(
  req: Request,
  userId: string
) {
  const { searchParams } =
    new URL(req.url);

  const id =
    searchParams.get("id");

  if (!id) {
    return {
      error: "MISSING_ID",
    };
  }

  const ok =
    await deleteProductBySeller(
      userId,
      id
    );

  if (!ok) {
    return {
      error: "NOT_FOUND",
    };
  }

  return {
    success: true,
  };
}
