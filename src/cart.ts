/**
 * カート。ブラウザのメモリだけに置き、注文を確定したときに初めてサーバーへ送る（サーバーにカートの表はない）。
 *
 * 1 行の数量は 1 から「MAX_QUANTITY と在庫の少ないほう」まで。在庫が 0 の商品は行に残さない。
 * 行を消すのは remove だけ（数量を 0 にしても消えない）。
 */
import type { OrderLine, Product } from "./api.ts";

export const MAX_QUANTITY = 99;

export interface CartLine {
  readonly product: Product;
  readonly quantity: number;
}

export type Cart = readonly CartLine[];

/** その商品をカートに入れられる最大の数。 */
export function limitOf(product: Product): number {
  return Math.max(0, Math.min(MAX_QUANTITY, Math.trunc(product.stock)));
}

const isCount = (q: number): boolean => Number.isInteger(q) && q >= 1;
const clamp = (q: number, product: Product): number => Math.min(limitOf(product), q);
const nonEmpty = (cart: Cart): Cart => cart.filter((l) => l.quantity > 0);

/** 商品を足す。同じ商品は 1 行にまとめ、商品の情報は渡されたもので置き換える。 */
export function add(cart: Cart, product: Product, quantity = 1): Cart {
  if (!isCount(quantity)) return cart;
  const found = cart.some((l) => l.product.id === product.id);
  return nonEmpty(found
    ? cart.map((l) => (l.product.id === product.id ? { product, quantity: clamp(l.quantity + quantity, product) } : l))
    : [...cart, { product, quantity: clamp(quantity, product) }]);
}

/** 数量を変える。1 以上の整数でなければ何もしない。上限を超える数は上限にする。 */
export function setQuantity(cart: Cart, productId: number, quantity: number): Cart {
  if (!isCount(quantity)) return cart;
  return nonEmpty(cart.map((l) => (l.product.id === productId ? { ...l, quantity: clamp(quantity, l.product) } : l)));
}

/** 行を消す。 */
export function remove(cart: Cart, productId: number): Cart {
  return cart.filter((l) => l.product.id !== productId);
}

/** カートに入っている数（なければ 0）。 */
export function quantityOf(cart: Cart, productId: number): number {
  return cart.find((l) => l.product.id === productId)?.quantity ?? 0;
}

/**
 * 商品の一覧を読み直したあとに、カートの商品の情報（価格・在庫）を新しくする。
 * 数量は新しい在庫までに減らし、なくなった商品と在庫が 0 の商品の行は消す。
 */
export function refresh(cart: Cart, products: readonly Product[]): Cart {
  const byId = new Map(products.map((p) => [p.id, p]));
  return cart.flatMap((l) => {
    const p = byId.get(l.product.id);
    if (p === undefined) return [];
    const quantity = clamp(l.quantity, p);
    return quantity > 0 ? [{ product: p, quantity }] : [];
  });
}

/** 数量の欄の文字を数にする。1 以上の整数でなければ null（入力の途中の空欄など）。 */
export function parseQuantity(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return isCount(n) ? n : null;
}

/** 表示用の合計（確定する合計はサーバーが決める）。 */
export function total(cart: Cart): number {
  return cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
}

export function lines(cart: Cart): OrderLine[] {
  return cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity }));
}
