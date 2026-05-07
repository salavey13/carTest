const safeDomIdPart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "bike";

export function buildSaleBuySectionId(itemId: string) {
  return `buy-${safeDomIdPart(itemId)}`;
}
