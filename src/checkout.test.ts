import { describe, expect, test } from "vitest";

import { ApiError, type Order } from "./api.ts";
import { basisOf, follow, fresh, outcomeOf, parseStored, settle } from "./checkout.ts";

/** k1, k2, … を順に返す。 */
function keys(): () => string {
  let n = 0;
  return () => `k${++n}`;
}

const order = (status: string): Order => ({ id: 1, total: 100, status, created_at: "2026-01-01T00:00:00", items: [] });
const cartA = [{ product_id: 1, quantity: 2 }];
const cartB = [{ product_id: 1, quantity: 3 }];

describe("request key", () => {
  test("the same cart, card and customer keep the key", () => {
    const k = keys();
    const s = fresh(basisOf(cartA, "tok_visa", "a@example.com"), k);
    expect(follow(s, basisOf(cartA, "tok_visa", "a@example.com"), k)).toBe(s);
  });

  test("the order of lines does not matter", () => {
    const two = [{ product_id: 1, quantity: 1 }, { product_id: 2, quantity: 1 }];
    expect(basisOf(two, "tok_visa", "a@example.com")).toBe(basisOf([...two].reverse(), "tok_visa", "a@example.com"));
  });

  test("changing the cart, the card or the customer rotates the key", () => {
    const k = keys();
    const s = fresh(basisOf(cartA, "tok_visa", "a@example.com"), k);
    expect(follow(s, basisOf(cartB, "tok_visa", "a@example.com"), k).key).not.toBe(s.key);
    expect(follow(s, basisOf(cartA, "tok_limited", "a@example.com"), k).key).not.toBe(s.key);
    expect(follow(s, basisOf(cartA, "tok_visa", "b@example.com"), k).key).not.toBe(s.key);
    expect(follow(s, basisOf(cartA, "tok_visa", null), k).key).not.toBe(s.key);
  });

  test("changing the cart and changing it back still gives a new key", () => {
    const k = keys();
    const a = fresh(basisOf(cartA, "tok_visa", "a@example.com"), k);
    const b = follow(a, basisOf(cartB, "tok_visa", "a@example.com"), k);
    const back = follow(b, basisOf(cartA, "tok_visa", "a@example.com"), k);
    expect(new Set([a.key, b.key, back.key]).size).toBe(3);
  });

  test("outcomes: 2xx is accepted, 4xx is rejected, the rest and a payment conflict are unknown", () => {
    expect(outcomeOf({ order: order("paid") })).toBe("accepted");
    expect(outcomeOf({ error: new ApiError(400, "x") })).toBe("rejected");
    expect(outcomeOf({ error: new ApiError(401, "x") })).toBe("rejected");
    expect(outcomeOf({ error: new ApiError(409, "x") })).toBe("rejected");
    expect(outcomeOf({ error: new ApiError(409, "x", "payment_conflict") })).toBe("unknown");
    expect(outcomeOf({ error: new ApiError(500, "x") })).toBe("unknown");
    expect(outcomeOf({ error: new ApiError(503, "x") })).toBe("unknown");
    expect(outcomeOf({ error: new ApiError(0, "x") })).toBe("unknown");
    expect(outcomeOf({ error: new TypeError("Failed to fetch") })).toBe("unknown");
  });

  test("success and a definitive rejection rotate the key", () => {
    const k = keys();
    const s = fresh(basisOf(cartA, "tok_visa", "a@example.com"), k);
    for (const outcome of ["accepted", "rejected"] as const) {
      const next = settle(s, s.key, outcome, k);
      expect(next.key).not.toBe(s.key);
      expect(next.basis).toBe(s.basis);
      expect(next.unsettled).toBe(false);
    }
  });

  test("an unknown outcome keeps the key, marks it unsettled and holds it even if the cart changes", () => {
    const k = keys();
    const s = fresh(basisOf(cartA, "tok_visa", "a@example.com"), k);
    const kept = settle(s, s.key, "unknown", k);
    expect(kept.unsettled).toBe(true);
    expect(kept.key).toBe(s.key);
    expect(follow(kept, basisOf(cartB, "tok_visa", "a@example.com"), k)).toBe(kept);
    // 決着すれば作り直す
    expect(settle(kept, kept.key, "accepted", k).unsettled).toBe(false);
  });

  test("a stored key is read back only when it has the right shape", () => {
    const s = { key: "k", basis: "b", unsettled: true };
    expect(parseStored(JSON.stringify(s))).toEqual(s);
    expect(parseStored(null)).toBeNull();
    expect(parseStored("{")).toBeNull();
    expect(parseStored(JSON.stringify({ key: 1 }))).toBeNull();
  });

  test("a result for a key that was already rotated changes nothing", () => {
    const k = keys();
    const sent = fresh(basisOf(cartA, "tok_visa", "a@example.com"), k);
    const now = follow(sent, basisOf(cartB, "tok_visa", "a@example.com"), k);
    expect(settle(now, sent.key, "accepted", k)).toBe(now);
    expect(settle(now, sent.key, "rejected", k)).toBe(now);
  });
});
