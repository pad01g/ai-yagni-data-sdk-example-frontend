/**
 * backend-rust の HTTP API（/api）。セッションは HttpOnly の cookie で、ここからは触らない。
 * 金額と在庫は表示のためだけに使う。注文の合計は backend-proxy が DB の価格から決める。
 *
 * ログインが要る API が 401 を返したら（セッションが切れたなど）、onUnauthorized で登録した関数を呼ぶ。
 * ログインと登録の 401 はパスワードの誤りなどなので、呼ばずにエラーとして返すだけにする。
 */

export interface Customer {
  readonly email: string;
  readonly full_name: string;
  readonly address: string;
}

export interface Product {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly stock: number;
}

export interface OrderItem {
  readonly line_no: number;
  readonly product_id: number;
  readonly product_name: string;
  readonly quantity: number;
  readonly unit_price: number;
}

export interface Order {
  readonly id: number;
  readonly total: number;
  /** pending・paid・shipped・cancelled（表示名は constants.ts）。 */
  readonly status: string;
  readonly created_at: string;
  readonly items: readonly OrderItem[];
}

export interface OrderLine {
  readonly product_id: number;
  readonly quantity: number;
}

/** status が 0 なら、サーバーに届かなかった（通信の失敗）。 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** backend がメッセージを返さなかったとき（nginx が返したときなど）の言い方。 */
const FALLBACK_MESSAGES: Readonly<Record<number, string>> = {
  429: "リクエストが多すぎます。しばらく待ってからやり直してください。",
  502: "サーバーが一時的に利用できません。しばらくしてからやり直してください。",
  503: "サーバーが一時的に利用できません。しばらくしてからやり直してください。",
  504: "サーバーの応答が遅れています。しばらくしてからやり直してください。",
};

const NETWORK_MESSAGE = "サーバーに接続できませんでした。通信を確かめてからやり直してください。";

/** 失敗した応答の本文から、画面に出すメッセージを決める。 */
export function failureMessage(status: number, body: unknown, statusText: string): string {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" && body.error !== "") {
    return body.error;
  }
  return FALLBACK_MESSAGES[status] ?? (statusText !== "" ? statusText : `エラーになりました（HTTP ${status}）`);
}

/** 例外を画面に出すメッセージにする。 */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

let unauthorized: () => void = () => {};

/** ログインが要る API の 401 で呼ぶ関数を登録する。戻り値は登録を外す関数。 */
export function onUnauthorized(handler: () => void): () => void {
  unauthorized = handler;
  return () => {
    if (unauthorized === handler) unauthorized = () => {};
  };
}

async function call<T>(method: string, path: string, body?: unknown, { session = true } = {}): Promise<T> {
  const init: RequestInit = { method, credentials: "same-origin", headers: { accept: "application/json" } };
  if (body !== undefined) {
    init.headers = { ...init.headers, "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  let r: Response;
  try {
    r = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, NETWORK_MESSAGE);
  }
  if (r.status === 204) return undefined as T;
  const data: unknown = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && session) unauthorized();
    throw new ApiError(r.status, failureMessage(r.status, data, r.statusText));
  }
  return data as T;
}

export const api = {
  me: () => call<Customer>("GET", "/me"),
  signup: (s: { email: string; password: string; full_name: string; address: string }) =>
    call<Customer>("POST", "/signup", s, { session: false }),
  login: (email: string, password: string) => call<Customer>("POST", "/login", { email, password }, { session: false }),
  logout: () => call<void>("POST", "/logout"),
  products: () => call<Product[]>("GET", "/products"),
  orders: () => call<Order[]>("GET", "/orders"),
  placeOrder: (requestKey: string, lines: readonly OrderLine[], cardToken: string) =>
    call<Order>("POST", "/orders", { request_key: requestKey, lines, card_token: cardToken }),
};

export function yen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}
