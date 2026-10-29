import { describe, expect, test } from "vitest";

import type { Product } from "./api.ts";
import { MAX_QUANTITY, add, lines, setQuantity, total } from "./cart.ts";

const product = (id: number, price: number): Product =>
  ({ id, code: `P-${id}`, name: `商品 ${id}`, description: "", price, stock: 10 });

describe("cart", () => {
  test("adding the same product merges the line", () => {
    const c = add(add([], product(1, 100)), product(1, 100), 2);
    expect(lines(c)).toEqual([{ product_id: 1, quantity: 3 }]);
  });

  test("quantities stay within 1..99 and 0 removes the line", () => {
    const c = add([], product(1, 100), 500);
    expect(c[0]?.quantity).toBe(MAX_QUANTITY);
    expect(setQuantity(c, 1, 0)).toEqual([]);
  });

  test("the displayed total is price times quantity", () => {
    const c = add(add([], product(1, 2500), 2), product(2, 1200));
    expect(total(c)).toBe(6200);
  });
});
