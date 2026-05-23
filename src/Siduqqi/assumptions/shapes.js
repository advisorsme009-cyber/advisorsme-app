// Node-shape predicates used by the recursive FieldRenderer to pick the right
// control for each assumption value.

export function isPerYearDict(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  return keys.every((k) => /^\d{4}$/.test(k));
}

export function isLineItemAssumption(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    Object.prototype.hasOwnProperty.call(value, "driver") ||
    Object.prototype.hasOwnProperty.call(value, "rate")
  );
}

export function isPlainNestedObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
