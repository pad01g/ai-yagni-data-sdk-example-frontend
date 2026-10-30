import { describe, expect, test } from "vitest";

import type { Product } from "./api.ts";
import { MAX_QUANTITY, add, limitOf, lines, parseQuantity, quantityOf, refresh, remove, setQuantity, total } from "./cart.ts";

const product = (id: number, price: number, stock = 10): Product =>
  ({ id, code: `P-${id}`, name: `商品 ${id}`, description: "", price, stock });

describe("cart", () => {
  test("adding the same product merges the line", () => {
    const c = add(add([], product(1, 100)), product(1, 100), 2);
    expect(lines(c)).toEqual([{ product_id: 1, quantity: 3 }]);
  });

  test("adding stops at the stock and at MAX_QUANTITY", () => {
    expect(quantityOf(add([], product(1, 100, 3), 5), 1)).toBe(3);
    expect(quantityOf(add([], product(1, 100, 500), 500), 1)).toBe(MAX_QUANTITY);
    const c = add([], product(1, 100, 3), 3);
    expect(quantityOf(add(c, product(1, 100, 3)), 1)).toBe(3);
  });

  test("adding a product with no stock or a non-positive quantity does nothing", () => {
    expect(add([], product(1, 100, 0))).toEqual([]);
    expect(add([], product(1, 100), 0)).toEqual([]);
    expect(add([], product(1, 100), -1)).toEqual([]);
    expect(add([], product(1, 100), 1.5)).toEqual([]);
  });

  test("adding takes the newer product snapshot", () => {
    const c = add(add([], product(1, 100)), product(1, 120));
    expect(c[0]?.product.price).toBe(120);
  });

  test("limitOf is the smaller of MAX_QUANTITY and the stock", () => {
    expect(limitOf(product(1, 100, 5))).toBe(5);
    expect(limitOf(product(1, 100, 1000))).toBe(MAX_QUANTITY);
    expect(limitOf(product(1, 100, -2))).toBe(0);
  });

  test("setQuantity clamps to the limit", () => {
    const c = add([], product(1, 100, 7));
    expect(quantityOf(setQuantity(c, 1, 50), 1)).toBe(7);
    expect(quantityOf(setQuantity(c, 1, 4), 1)).toBe(4);
  });

  test("setQuantity ignores 0, negatives, fractions and NaN instead of removing the line", () => {
    const c = add([], product(1, 100), 2);
    for (const q of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(setQuantity(c, 1, q)).toBe(c);
    }
  });

  test("setQuantity leaves other lines alone", () => {
    const c = add(add([], product(1, 100)), product(2, 200), 2);
    expect(lines(setQuantity(c, 1, 5))).toEqual([{ product_id: 1, quantity: 5 }, { product_id: 2, quantity: 2 }]);
  });

  test("remove deletes only that line", () => {
    const c = add(add([], product(1, 100)), product(2, 200));
    expect(lines(remove(c, 1))).toEqual([{ product_id: 2, quantity: 1 }]);
    expect(remove(c, 3)).toEqual(c);
  });

  test("parseQuantity accepts only integers of 1 or more", () => {
    expect(parseQuantity("3")).toBe(3);
    expect(parseQuantity(" 12 ")).toBe(12);
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("-1")).toBeNull();
    expect(parseQuantity("1.5")).toBeNull();
    expect(parseQuantity("1e2")).toBeNull();
    expect(parseQuantity("abc")).toBeNull();
  });

  test("refresh updates price and stock and clamps to the new stock", () => {
    const c = add(add([], product(1, 100, 10), 8), product(2, 200, 10), 2);
    const r = refresh(c, [product(1, 150, 5), product(2, 200, 10)]);
    expect(lines(r)).toEqual([{ product_id: 1, quantity: 5 }, { product_id: 2, quantity: 2 }]);
    expect(r[0]?.product.price).toBe(150);
    expect(r[0]?.product.stock).toBe(5);
  });

  test("refresh drops lines whose product disappeared or has no stock", () => {
    const c = add(add(add([], product(1, 100)), product(2, 200)), product(3, 300));
    const r = refresh(c, [product(1, 100, 0), product(3, 300)]);
    expect(lines(r)).toEqual([{ product_id: 3, quantity: 1 }]);
  });

  test("the displayed total is price times quantity", () => {
    const c = add(add([], product(1, 2500), 2), product(2, 1200));
    expect(total(c)).toBe(6200);
  });
});
