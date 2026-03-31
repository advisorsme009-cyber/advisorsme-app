/**
 * Financial number formatter for engine results.
 * - Thousand separators
 * - Parentheses for negatives: (45,916,931)
 * - Null/undefined → "—"
 */
export const engineFormatNumber = (num) => {
  if (num === null || num === undefined || num === "") return "—";
  if (typeof num === "string") {
    const parsed = Number(num);
    if (isNaN(parsed)) return num;
    return engineFormatNumber(parsed);
  }
  if (typeof num !== "number" || isNaN(num)) return "—";
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return num < 0 ? `(${formatted})` : formatted;
};

/**
 * Format as percentage with 1 decimal: 0.527 → "52.7%"
 */
export const engineFormatPercent = (num) => {
  if (num === null || num === undefined || num === "") return "—";
  const n = Number(num);
  if (isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
};
