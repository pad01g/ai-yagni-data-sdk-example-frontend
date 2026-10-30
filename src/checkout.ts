/**
 * 注文の依頼の冪等キー（request_key）をいつ作り直すかを決める。React に依らない関数だけを置く。
 *
 * - 同じキーで同じ依頼をやり直すと、サーバーは注文を 1 つにまとめる。
 * - カートの中身・カード・ログインしている人が変わったら別の依頼なので、新しいキーにする。
 *   （古いキーのまま中身を変えて送ると、サーバーは 409 で断るか、前の注文を返してしまう）
 * - 結果が決まったら（受け付けられた、または 4xx で断られた）、次の依頼は新しいキーにする。
 * - 結果がわからないとき（通信の失敗・5xx）と、支払いが確認中のときは、同じキーのままにする。
 *   同じ依頼をやり直せば、二重に注文せずに結果が決まる。
 */
import { ApiError, type Order, type OrderLine } from "./api.ts";

export interface RequestKey {
  readonly key: string;
  /** どの依頼のためのキーか（basisOf の値）。 */
  readonly basis: string;
}

/** 依頼の中身。これが変わったらキーを作り直す。 */
export function basisOf(lines: readonly OrderLine[], card: string, customer: string | null): string {
  const sorted = [...lines].sort((a, b) => a.product_id - b.product_id).map((l) => [l.product_id, l.quantity]);
  return JSON.stringify([customer, card, sorted]);
}

export function fresh(basis: string, newKey: () => string): RequestKey {
  return { key: newKey(), basis };
}

/** 依頼の中身が変わっていたら新しいキーにする。変わっていなければ同じものを返す。 */
export function follow(current: RequestKey, basis: string, newKey: () => string): RequestKey {
  return current.basis === basis ? current : fresh(basis, newKey);
}

/**
 * 注文の依頼の結果。
 * - accepted: 受け付けられた
 * - pending: 受け付けられたが、支払いが確認中（同じ依頼をやり直すと確定する）
 * - rejected: 4xx で断られた（中身を直して、新しい依頼として出し直す）
 * - unknown: 通信の失敗・5xx で、受け付けられたかどうかわからない
 */
export type Outcome = "accepted" | "pending" | "rejected" | "unknown";

export function outcomeOf(result: { readonly order: Order } | { readonly error: unknown }): Outcome {
  if ("order" in result) return result.order.status === "pending" ? "pending" : "accepted";
  const e = result.error;
  return e instanceof ApiError && e.status >= 400 && e.status < 500 ? "rejected" : "unknown";
}

/** 依頼の結果を受けて、次に使うキーを決める。sentKey は送ったキー。 */
export function settle(current: RequestKey, sentKey: string, outcome: Outcome, newKey: () => string): RequestKey {
  // 送っている間にカートなどが変わって、もう作り直してあるならそのまま
  if (current.key !== sentKey) return current;
  return outcome === "accepted" || outcome === "rejected" ? fresh(current.basis, newKey) : current;
}
