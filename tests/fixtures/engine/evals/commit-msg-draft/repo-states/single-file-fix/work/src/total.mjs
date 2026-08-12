export function total(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((a, b) => a + b, 0);
}
