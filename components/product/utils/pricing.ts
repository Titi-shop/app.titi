
/* =========================================================
   TYPES
========================================================= */

export interface SaleValidationResult {
  valid: boolean;

  finalPrice: number;

  reason?: string;
}

/* =========================================================
   HELPERS
========================================================= */

export function toSafeNumber(
  value: unknown,
  fallback = 0
): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

/* =========================================================
   SALE VALIDATION
========================================================= */

export function isSaleValid(
  price: number,
  salePrice: number | null
): boolean {
  if (
    salePrice === null ||
    salePrice <= 0
  ) {
    return false;
  }

  if (price <= 0) {
    return false;
  }

  return salePrice < price;
}

/* =========================================================
   FINAL PRICE
========================================================= */

export function calculateFinalPrice(
  price: number,
  salePrice: number | null,
  saleEnabled: boolean
): number {
  const normalizedPrice =
    toSafeNumber(price);

  const normalizedSalePrice =
    salePrice === null
      ? null
      : toSafeNumber(salePrice);

  if (
    saleEnabled &&
    isSaleValid(
      normalizedPrice,
      normalizedSalePrice
    )
  ) {
    return normalizedSalePrice!;
  }

  return normalizedPrice;
}

/* =========================================================
   SALE PERCENT
========================================================= */

export function calculateSalePercent(
  price: number,
  salePrice: number | null
): number {
  if (
    !isSaleValid(price, salePrice)
  ) {
    return 0;
  }

  return Math.round(
    ((price - salePrice!) / price) *
      100
  );
}

/* =========================================================
   FLASH SALE LEFT
========================================================= */

export function calculateSaleLeft(
  saleStock: number,
  saleSold: number
): number {
  return Math.max(
    0,
    toSafeNumber(saleStock) -
      toSafeNumber(saleSold)
  );
}

/* =========================================================
   SALE WINDOW
========================================================= */

export function isSaleInTimeWindow(
  saleStart?: string | null,
  saleEnd?: string | null
): boolean {
  if (!saleStart || !saleEnd) {
    return false;
  }

  const start =
    new Date(saleStart).getTime();

  const end =
    new Date(saleEnd).getTime();

  const now = Date.now();

  return now >= start && now <= end;
}

/* =========================================================
   FULL SALE CHECK
========================================================= */

export function validateSale(
  params: {
    price: number;

    salePrice: number | null;

    saleEnabled: boolean;

    saleStart?: string | null;

    saleEnd?: string | null;
  }
): SaleValidationResult {
  const price = toSafeNumber(
    params.price
  );

  const salePrice =
    params.salePrice === null
      ? null
      : toSafeNumber(
          params.salePrice
        );

  const saleEnabled =
    Boolean(params.saleEnabled);

  /* =========================
     SALE DISABLED
  ========================= */

  if (!saleEnabled) {
    return {
      valid: true,

      finalPrice: price,
    };
  }

  /* =========================
     INVALID SALE PRICE
  ========================= */

  if (
    !isSaleValid(
      price,
      salePrice
    )
  ) {
    return {
      valid: false,

      finalPrice: price,

      reason:
        "INVALID_SALE_PRICE",
    };
  }

  /* =========================
     INVALID WINDOW
  ========================= */

  if (
    !params.saleStart ||
    !params.saleEnd
  ) {
    return {
      valid: false,

      finalPrice: price,

      reason:
        "SALE_TIME_REQUIRED",
    };
  }

  /* =========================
     SUCCESS
  ========================= */

  return {
    valid: true,

    finalPrice:
      calculateFinalPrice(
        price,
        salePrice,
        true
      ),
  };
}
