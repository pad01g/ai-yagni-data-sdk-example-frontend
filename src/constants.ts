/**
 * 画面で使う決まった値。
 */

/** 模擬の決済サービスのカード。 */
export const CARDS = [
  { token: "tok_visa", label: "通るカード" },
  { token: "tok_limited", label: "利用枠 ¥10,000 のカード" },
  { token: "tok_declined", label: "拒否されるカード" },
] as const;

/** 注文の状態の表示名。断られた注文（declined）は一覧に出てこない。 */
export const ORDER_STATUS_LABELS = {
  pending: "支払い確認中",
  paid: "支払済み",
  shipped: "発送済み",
  cancelled: "取り消し",
} as const satisfies Record<string, string>;

export type OrderStatus = keyof typeof ORDER_STATUS_LABELS;

/** 状態の表示名。知らない状態なら、そのまま出す。 */
export function statusLabel(status: string): string {
  return Object.hasOwn(ORDER_STATUS_LABELS, status) ? ORDER_STATUS_LABELS[status as OrderStatus] : status;
}
