/**
 * カート。ブラウザのメモリだけに置き、注文を確定したときに初めてサーバーへ送る（サーバーにカートの表はない）。
 */
import type { OrderLine, Product } from "./api.ts";

export const MAX_QUANTITY = 99;

export interface CartLine {
  readonly product: Product;
  readonly quantity: number;
}

export type Cart = readonly CartLine[];

const clamp = (q: number): number => Math.max(0, Math.min(MAX_QUANTITY, Math.trunc(q)));

/** 商品を足す。同じ商品は 1 行にまとめる。 */
export function add(cart: Cart, product: Product, quantity = 1): Cart {
  const found = cart.some((l) => l.product.id === product.id);
  return found
    ? cart.map((l) => (l.product.id === product.id ? { ...l, quantity: clamp(l.quantity + quantity) } : l))
    : [...cart, { product, quantity: clamp(quantity) }].filter((l) => l.quantity > 0);
}

/** 数量を変える。0 なら行を消す。 */
export function setQuantity(cart: Cart, productId: number, quantity: number): Cart {
  return cart
    .map((l) => (l.product.id === productId ? { ...l, quantity: clamp(quantity) } : l))
    .filter((l) => l.quantity > 0);
}

/** 表示用の合計（確定する合計はサーバーが決める）。 */
export function total(cart: Cart): number {
  return cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
}

export function lines(cart: Cart): OrderLine[] {
  return cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity }));
}
