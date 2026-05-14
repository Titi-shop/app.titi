import type {
  ProductFormState,
  ProductPayload,
  ProductVariant,
  ShippingRate,
} from "../types";

import {
  calculateFinalPrice,
  isSaleValid,
} from "./pricing";

/* =========================================================
   HELPERS
========================================================= */

function toNumber(
  value: number | "" | null | undefined
): number {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const parsed = Number(value);

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

function normalizeVariants(
  variants: ProductVariant[]
): ProductVariant[] {
  return variants.map(
    (variant, index) => {
      const price = toNumber(
        variant.price
      );

      const salePrice =
        variant.salePrice === null ||
        variant.salePrice === undefined
          ? null
          : toNumber(
              variant.salePrice
            );

      const saleEnabled =
        Boolean(
          variant.saleEnabled
        ) &&
        isSaleValid(
          price,
          salePrice
        );

      return {
        ...variant,

        option1:
          variant.option1.trim(),

        option2:
          variant.option2?.trim() ||
          null,

        option3:
          variant.option3?.trim() ||
          null,

        price,

        salePrice,

        saleEnabled,

        saleStock: toNumber(
          variant.saleStock
        ),

        saleSold: toNumber(
          variant.saleSold
        ),

        stock: toNumber(
          variant.stock
        ),

        finalPrice:
          calculateFinalPrice(
            price,
            salePrice,
            saleEnabled
          ),

        isUnlimited:
          Boolean(
            variant.isUnlimited
          ),

        isActive:
          variant.isActive !== false,

        sortOrder:
          variant.sortOrder ??
          index,

        sold: toNumber(
          variant.sold
        ),

        currency: "PI",
      };
    }
  );
}

function normalizeShipping(
  shippingRates:
    ProductFormState["shippingRates"]
): ShippingRate[] {
  return Object.entries(
    shippingRates
  ).map(([zone, value]) => ({
    zone:
      zone as ShippingRate["zone"],

    price: toNumber(value),

    currency: "PI",
  }));
}

/* =========================================================
   BUILD PAYLOAD
========================================================= */

export function buildProductPayload(
  form: ProductFormState
): ProductPayload {
  const hasVariants =
    form.variants.length > 0;

  const variants =
    normalizeVariants(
      form.variants
    );

  const price = toNumber(
    form.price
  );

  const salePrice =
    form.salePrice === "" ||
    form.salePrice === null
      ? null
      : toNumber(
          form.salePrice
        );

  const saleEnabled =
    Boolean(form.saleEnabled) &&
    isSaleValid(
      price,
      salePrice
    );

  return {
    id: form.id,

    /* BASIC */

    name: form.name.trim(),

    shortDescription:
      form.shortDescription.trim(),

    description:
      form.description.trim(),

    detail:
      form.detail.trim(),

    categoryId:
      form.categoryId,

    /* MEDIA */

    thumbnail:
      form.thumbnail ||
      form.images[0] ||
      null,

    images: form.images,

    detailImages:
      form.detailImages,

    videoUrl:
      form.videoUrl.trim(),

    /* PRICE */

    price: hasVariants
      ? 0
      : price,

    salePrice:
      hasVariants
        ? null
        : salePrice,

    currency: "PI",

    /* FLASH SALE */

    saleEnabled:
      hasVariants
        ? variants.some(
            (v) =>
              v.saleEnabled
          )
        : saleEnabled,

    saleStock:
      hasVariants
        ? 0
        : toNumber(
            form.saleStock
          ),

    saleStart:
      form.saleStart,

    saleEnd:
      form.saleEnd,

    /* STOCK */

    stock: hasVariants
      ? 0
      : toNumber(
          form.stock
        ),

    isUnlimited:
      Boolean(
        form.isUnlimited
      ),

    /* VARIANTS */

    hasVariants,

    variants,

    /* SHIPPING */

    shippingRates:
      normalizeShipping(
        form.shippingRates
      ),

    domesticCountryCode:
      form.domesticCountryCode,

    /* STATUS */

    status: form.status,

    isActive:
      form.isActive,

    isFeatured:
      form.isFeatured,

    isDigital:
      form.isDigital,

    /* SEO */

    metaTitle:
      form.metaTitle.trim(),

    metaDescription:
      form.metaDescription.trim(),

    /* REQUEST */

    idempotencyKey:
      crypto.randomUUID(),
  };
}
