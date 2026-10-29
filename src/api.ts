/**
 * backend-rust の HTTP API（/api）。セッションは HttpOnly の cookie で、ここからは触らない。
 * 金額と在庫は表示のためだけに使う。注文の合計は backend-proxy が DB の価格から決める。
 */

export interface Customer {
  readonly id: number;
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
  readonly status: string;
  readonly created_at: string;
  readonly items: readonly OrderItem[];
}

export interface OrderLine {
  readonly product_id: number;
  readonly quantity: number;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "same-origin", headers: { accept: "application/json" } };
  if (body !== undefined) {
    init.headers = { ...init.headers, "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const r = await fetch(`/api${path}`, init);
  if (r.status === 204) return undefined as T;
  const data: unknown = await r.json().catch(() => ({}));
  if (!r.ok) {
    const message = typeof data === "object" && data !== null && "error" in data ? String(data.error) : r.statusText;
    throw new ApiError(r.status, message);
  }
  return data as T;
}

export const api = {
  me: () => call<Customer>("GET", "/me"),
  signup: (s: { email: string; password: string; full_name: string; address: string }) =>
    call<Customer>("POST", "/signup", s),
  login: (email: string, password: string) => call<Customer>("POST", "/login", { email, password }),
  logout: () => call<void>("POST", "/logout"),
  products: () => call<Product[]>("GET", "/products"),
  orders: () => call<Order[]>("GET", "/orders"),
  placeOrder: (requestKey: string, lines: readonly OrderLine[], cardToken: string) =>
    call<Order>("POST", "/orders", { request_key: requestKey, lines, card_token: cardToken }),
};

export function yen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}
