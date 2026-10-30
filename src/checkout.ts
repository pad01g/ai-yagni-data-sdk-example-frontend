/**
 * 注文の依頼の冪等キー（request_key）をいつ作り直すかを決める。React に依らない関数だけを置く。
 *
 * - 同じキーで同じ依頼をやり直すと、サーバーは注文を 1 つにまとめる。
 * - カートの中身・カード・ログインしている人が変わったら別の依頼なので、新しいキーにする。
 *   （古いキーのまま中身を変えて送ると、サーバーは 409 で断るか、前の注文を返してしまう）
 * - 結果が決まったら（受け付けられた、または 4xx で断られた）、次の依頼は新しいキーにする。
 * - 結果がわからないとき（通信の失敗・5xx、前の支払いの確認中）は、同じキーのままにし、決着していない印を付ける。
 *   同じ依頼をやり直せば、二重に注文せずに結果が決まる。印のあるあいだ、画面はカートとカードを変えさせない
 *   （変えると新しいキーの別の注文になり、前の注文の請求が済んでいれば二重に払うことになる）。
 *   やめることもできる。そのときサーバーは、決着しない注文を後で決済サービスと突き合わせて片付ける。
 */
import { ApiError, type Order, type OrderLine } from "./api.ts";

export interface RequestKey {
  readonly key: string;
  /** どの依頼のためのキーか（basisOf の値）。 */
  readonly basis: string;
  /** このキーで送った依頼の結果が分からないまま（同じ依頼でやり直すまで、中身を変えない）。 */
  readonly unsettled: boolean;
}

/** 依頼の中身。これが変わったらキーを作り直す。 */
export function basisOf(lines: readonly OrderLine[], card: string, customer: string | null): string {
  const sorted = [...lines].sort((a, b) => a.product_id - b.product_id).map((l) => [l.product_id, l.quantity]);
  return JSON.stringify([customer, card, sorted]);
}

export function fresh(basis: string, newKey: () => string): RequestKey {
  return { key: newKey(), basis, unsettled: false };
}

/**
 * 依頼の中身が変わっていたら新しいキーにする。変わっていなければ同じものを返す。
 * 結果の分からない依頼があるあいだは作り直さない（商品の読み直しでカートが変わっても、前の注文と別の注文にしない。
 * 中身が違えば、サーバーが 409 で断るので、そこで新しいキーになる）。
 */
export function follow(current: RequestKey, basis: string, newKey: () => string): RequestKey {
  return current.basis === basis || current.unsettled ? current : fresh(basis, newKey);
}

/**
 * 注文の依頼の結果。
 * - accepted: 受け付けられた（支払いも済んだ）
 * - rejected: 4xx で断られた（中身を直して、新しい依頼として出し直す）
 * - unknown: 通信の失敗・5xx・前の支払いの確認中（payment_conflict）で、決着したかどうかわからない
 */
export type Outcome = "accepted" | "rejected" | "unknown";

export function outcomeOf(result: { readonly order: Order } | { readonly error: unknown }): Outcome {
  if ("order" in result) return "accepted";
  const e = result.error;
  if (e instanceof ApiError && e.code === "payment_conflict") return "unknown";
  return e instanceof ApiError && e.status >= 400 && e.status < 500 ? "rejected" : "unknown";
}

/** 依頼の結果を受けて、次に使うキーを決める。sentKey は送ったキー。 */
export function settle(current: RequestKey, sentKey: string, outcome: Outcome, newKey: () => string): RequestKey {
  // 送っている間にカートなどが変わって、もう作り直してあるならそのまま
  if (current.key !== sentKey) return current;
  if (outcome === "unknown") return current.unsettled ? current : { ...current, unsettled: true };
  return fresh(current.basis, newKey);
}

/** 保存しておいたキー（sessionStorage から読んだ値）が、形の正しいものなら返す。 */
export function parseStored(raw: string | null): RequestKey | null {
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (
      typeof v === "object" && v !== null && "key" in v && typeof v.key === "string" && "basis" in v &&
      typeof v.basis === "string" && "unsettled" in v && typeof v.unsettled === "boolean"
    ) {
      return { key: v.key, basis: v.basis, unsettled: v.unsettled };
    }
  } catch {
    // 壊れていれば使わない
  }
  return null;
}
