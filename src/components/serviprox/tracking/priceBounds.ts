import type { Order } from "../../../types/serviprox";

export function priceBounds(order: Order) {
  const min = order.price_bounds?.min ?? order.estimate_min;
  const max = order.price_bounds?.max ?? order.estimate_max;
  const lower = min == null ? NaN : Number(min);
  const upper = max == null ? NaN : Number(max);
  return Number.isFinite(lower) && Number.isFinite(upper) && lower >= 1 && upper >= lower
    ? { min: lower, max: upper } : null;
}
