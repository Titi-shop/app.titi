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

import {
  normalizeVariants,
  validateProductPayload,
} from "@/lib/validators/products";
/* =========================================================
   TYPES
========================================================= */

type VariantInput = {
  price?: number;
  sale_price?: number | null;
  final_price?: number;
  stock?: number;
  sale_enabled?: boolean;
};

type ShippingRateInput = {
  zone: string;
  price: number;
  domestic_country_code: string | null;
};

type ProductRequestBody = {
  id?: string;

  name: string;

  description?: string;
  detail?: string;

  images?: string[];
  thumbnail?: string;

  category_id?: number | null;

  price?: number;
  stock?: number;

  sale_price?: number | null;
  sale_start?: string | null;
  sale_end?: string | null;

  sale_stock?: number;
  sale_enabled?: boolean;

  is_active?: boolean;

  primary_shipping_country?: string;
  domestic_country_code?: string;

  shipping_rates?: {
    zone: string;
    price?: number;
    domestic_country_code?: string | null;
  }[];

  variants?: VariantInput[];
};

/* =========================================================
   HELPERS
========================================================= */

function getCategoryId(
  body: ProductRequestBody
): number | null {
  return body.category_id ?? null;
}

function calcFinalPrice(
  variants: VariantInput[],
  fallbackPrice: number
): number {
  if (!variants.length) {
    return fallbackPrice;
  }

  return Math.min(
    ...variants.map((variant) =>
      Number(
        variant.final_price ??
          variant.sale_price ??
          variant.price ??
          0
      )
    )
  );
}

function calcStock(
  variants: VariantInput[],
  fallbackStock: number
): number {
  if (!variants.length) {
    return fallbackStock;
  }

  return variants.reduce(
    (sum, variant) =>
      sum + Number(variant.stock ?? 0),
    0
  );
}

function normalizeShippingRates(
  body: ProductRequestBody,
  primaryCountry?: string
): ShippingRateInput[] {
  const rates =
    body.shipping_rates ?? [];

  return rates.map((rate) => ({
    zone: rate.zone,

    price: Number(rate.price ?? 0),

    domestic_country_code:
      rate.zone === "domestic"
        ? (
            rate.domestic_country_code ??
            primaryCountry ??
            body.primary_shipping_country ??
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
  const { searchParams } =
    new URL(req.url);

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
    products.map(
      (product) => product.id
    );

  const shippingRows =
    productIds.length > 0
      ? await getShippingRatesByProducts(
          productIds
        )
      : [];

  const shippingMap =
    new Map<
      string,
      ShippingRateInput[]
    >();

  for (const row of shippingRows) {
    if (
      !shippingMap.has(
        row.product_id
      )
    ) {
      shippingMap.set(
        row.product_id,
        []
      );
    }

    shippingMap
      .get(row.product_id)!
      .push({
        zone: row.zone,
        price: Number(row.price),

        domestic_country_code:
          row.domestic_country_code,
      });
  }

  return Promise.all(
    products.map(
      async (product) => {
        const variants =
          await getVariantsByProductId(
            product.id
          );

        const enrichedVariants =
          variants.map(
            (variant) => {
              const saleActive =
                variant.sale_enabled &&
                variant.sale_price !==
                  null &&
                Number(
                  variant.sale_price
                ) > 0 &&
                Number(
                  variant.sale_price
                ) <
                  Number(
                    variant.price
                  );

              return {
                ...variant,

                final_price:
                  saleActive
                    ? Number(
                        variant.sale_price
                      )
                    : Number(
                        variant.price
                      ),
              };
            }
          );

        const prices =
          enrichedVariants.map(
            (variant) =>
              Number(
                variant.final_price
              )
          );

        const minVariantPrice =
  enrichedVariants.length > 0
    ? Math.min(
        ...enrichedVariants.map(v =>
          Number(v.price)
        )
      )
    : Number(product.price);

const saleVariants =
  enrichedVariants.filter(
    v =>
      v.sale_price !== null &&
      Number(v.sale_price) > 0
  );

const minVariantSalePrice =
  saleVariants.length > 0
    ? Math.min(
        ...saleVariants.map(v =>
          Number(v.sale_price)
        )
      )
    : null;

const minVariantFinalPrice =
  prices.length > 0
    ? Math.min(...prices)
    : Number(product.final_price);

        return {
  ...product,

  price:
    variants.length > 0
      ? minVariantPrice
      : product.price,

  sale_price:
    variants.length > 0
      ? minVariantSalePrice
      : product.sale_price,

  final_price:
    variants.length > 0
      ? minVariantFinalPrice
      : product.final_price,

  has_variants:
    variants.length > 0,

  min_price:
    prices.length > 0
      ? Math.min(...prices)
      : null,

  max_price:
    prices.length > 0
      ? Math.max(...prices)
      : null,

  variants: enrichedVariants,

  shipping_rates:
    shippingMap.get(product.id) ?? [],
};
      }
    )
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
  (await req.json()) as ProductRequestBody;

/* =========================
   VALIDATE PRODUCT
========================= */

const error =
  validateProductPayload(body);

if (error) {
  return { error };
}

const variants =
  normalizeVariants(
    body.variants ?? []
  );
  
  const finalPrice =
    calcFinalPrice(
      variants,
      Number(body.price ?? 0)
    );

  const stock = calcStock(
    variants,
    Number(body.stock ?? 0)
  );

  const product =
    await createProduct(
      userId,
      {
        name: body.name,

        description:
          body.description ??
          "",

        detail:
          body.detail ?? "",

        images:
          body.images ?? [],

        thumbnail:
          body.thumbnail ?? "",

        category_id:
          getCategoryId(body),

        price: finalPrice,

        stock,

        sale_price:
          body.sale_price ??
          null,

        sale_start:
          body.sale_start ??
          null,

        sale_end:
          body.sale_end ??
          null,

        sale_stock:
          Number(
            body.sale_stock ?? 0
          ),

        sale_enabled:
          Boolean(
            body.sale_enabled
          ),

        is_active:
          body.is_active !==
          false,
      }
    );

  if (variants.length > 0) {
    await replaceVariantsByProductId(
      product.id,
      variants
    );
  }

  const cleanedRates =
    normalizeShippingRates(
      body,
      body.primary_shipping_country
    );

  if (cleanedRates.length > 0) {
    await upsertShippingRates({
      productId: product.id,
      rates: cleanedRates,
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
  (await req.json()) as ProductRequestBody;

/* =========================
   VALIDATE PRODUCT
========================= */

const error =
  validateProductPayload(body);

if (error) {
  return { error };
}

const variants =
  normalizeVariants(
    body.variants ?? []
  );

  const finalPrice =
    calcFinalPrice(
      variants,
      Number(body.price ?? 0)
    );

  const stock = calcStock(
    variants,
    Number(body.stock ?? 0)
  );

  const updated =
    await updateProductBySeller(
      userId,
      body.id ?? "",
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

        stock,

        sale_price:
          body.sale_price ??
          null,

        sale_enabled:
          Boolean(
            body.sale_enabled
          ),

        sale_start:
          body.sale_start ??
          null,

        sale_end:
          body.sale_end ??
          null,

        sale_stock:
          Number(
            body.sale_stock ?? 0
          ),

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

  await replaceVariantsByProductId(
    body.id ?? "",
    variants
  );

  const cleanedRates =
    normalizeShippingRates(
      body,
      body.primary_shipping_country
    );

  if (cleanedRates.length > 0) {
    await upsertShippingRates({
      productId:
        body.id ?? "",
      rates: cleanedRates,
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

  const deleted =
    await deleteProductBySeller(
      userId,
      id
    );

  if (!deleted) {
    return {
      error: "NOT_FOUND",
    };
  }

  return {
    success: true,
  };
}
