/* =====================================================
   HELPERS
===================================================== */

export function toNumberSafe(
  value: unknown,
  field: string
): number {
  const num = Number(value);

  if (Number.isNaN(num)) {
    console.error(
      "❌ [RETURN][PARSE_ERROR]",
      {
        field,
        value,
      }
    );

    throw new Error(
      "INVALID_NUMBER"
    );
  }

  return num;
}
