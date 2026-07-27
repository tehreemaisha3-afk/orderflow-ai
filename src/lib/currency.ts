export const CURRENCY_CODE = "PKR";

export function formatCurrency(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return `${CURRENCY_CODE} ${safe.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
