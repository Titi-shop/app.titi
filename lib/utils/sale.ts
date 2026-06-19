export function isSaleActive(
  saleEnabled?: boolean,
  salePrice?: number | null,
  price?: number | null,
  saleStart?: string | Date | null,
  saleEnd?: string | Date | null
): boolean {
  if (!saleEnabled) {
    return false;
  }

  if (
    salePrice == null ||
    price == null ||
    salePrice <= 0 ||
    salePrice >= price
  ) {
    return false;
  }

  const now = Date.now();

  if (saleStart) {
    const start =
      new Date(saleStart).getTime();

    if (now < start) {
      return false;
    }
  }

  if (saleEnd) {
    const end =
      new Date(saleEnd).getTime();

    if (now > end) {
      return false;
    }
  }

  return true;
}
