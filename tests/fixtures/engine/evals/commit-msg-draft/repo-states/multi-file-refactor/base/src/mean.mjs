export function mean(items) {
  return items.reduce((a, b) => a + b, 0) / items.length;
}
