import { sum } from "./sum.mjs";
export function mean(items) {
  return sum(items) / items.length;
}
