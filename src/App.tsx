/**
 * 画面は 4 つ（商品・カート・注文履歴・ログイン/登録）。ルーターは使わず、状態で切り替える。
 */
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { ApiError, type Customer, type Order, type Product, api, yen } from "./api.ts";
import { type Cart, add, lines, setQuantity, total } from "./cart.ts";

type View = "products" | "cart" | "orders" | "account";

/** 模擬の決済サービスのカード。 */
const CARDS = [
  { token: "tok_visa", label: "通るカード" },
  { token: "tok_limited", label: "利用枠 ¥10,000 のカード" },
  { token: "tok_declined", label: "拒否されるカード" },
] as const;

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function App() {
  const [view, setView] = useState<View>("products");
  const [me, setMe] = useState<Customer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const reloadProducts = useCallback(() => {
    api.products().then(setProducts, (e: unknown) => setNotice(message(e)));
  }, []);

  useEffect(() => {
    reloadProducts();
    api.me().then(setMe, () => setMe(null));
  }, [reloadProducts]);

  const count = cart.reduce((n, l) => n + l.quantity, 0);
  return (
    <div className="page">
      <header>
        <h1>ai-yagni shop</h1>
        <nav>
          <button onClick={() => setView("products")} aria-current={view === "products"}>商品</button>
          <button onClick={() => setView("cart")} aria-current={view === "cart"}>カート（{count}）</button>
          <button onClick={() => setView("orders")} aria-current={view === "orders"}>注文履歴</button>
          <button onClick={() => setView("account")} aria-current={view === "account"}>
            {me === null ? "ログイン" : me.full_name}
          </button>
        </nav>
      </header>
      {notice !== null && (
        <p className="notice" role="status">
          {notice} <button onClick={() => setNotice(null)}>閉じる</button>
        </p>
      )}
      <main>
        {view === "products" && (
          <Products
            products={products}
            onAdd={(p) => {
              setCart((c) => add(c, p));
              setNotice(`${p.name} をカートに入れました`);
            }}
          />
        )}
        {view === "cart" && (
          <CartView
            cart={cart}
            me={me}
            onChange={setCart}
            onLogin={() => setView("account")}
            onOrdered={(o) => {
              setCart([]);
              reloadProducts();
              setNotice(`注文 #${o.id} を受け付けました（${yen(o.total)}）`);
              setView("orders");
            }}
          />
        )}
        {view === "orders" && <Orders me={me} onLogin={() => setView("account")} />}
        {view === "account" && (
          <Account
            me={me}
            onChange={(c) => {
              setMe(c);
              if (c !== null) setView(cart.length > 0 ? "cart" : "products");
            }}
          />
        )}
      </main>
    </div>
  );
}

function Products({ products, onAdd }: { products: readonly Product[]; onAdd: (p: Product) => void }) {
  return (
    <ul className="products">
      {products.map((p) => (
        <li key={p.id}>
          <h2>{p.name}</h2>
          <p>{p.description}</p>
          <p className="price">{yen(p.price)}</p>
          <p className="stock">{p.stock > 0 ? `在庫 ${p.stock}` : "在庫切れ"}</p>
          <button disabled={p.stock <= 0} onClick={() => onAdd(p)}>カートに入れる</button>
        </li>
      ))}
    </ul>
  );
}

function CartView(props: {
  cart: Cart;
  me: Customer | null;
  onChange: (c: Cart) => void;
  onLogin: () => void;
  onOrdered: (o: Order) => void;
}) {
  const { cart, me, onChange, onLogin, onOrdered } = props;
  const [card, setCard] = useState<string>(CARDS[0].token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 依頼の冪等キー。同じカートの注文をやり直しても（通信の失敗など）、注文は 1 つになる
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  if (cart.length === 0) return <p>カートは空です。</p>;
  const order = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const o = await api.placeOrder(requestKey, lines(cart), card);
      setRequestKey(crypto.randomUUID());
      onOrdered(o);
    } catch (e) {
      // 中身の決まった失敗（在庫・決済）なら、直してから新しい依頼として出し直す
      if (e instanceof ApiError && e.status < 500) setRequestKey(crypto.randomUUID());
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <table className="cart">
        <thead>
          <tr><th>商品</th><th>単価</th><th>数量</th><th>小計</th></tr>
        </thead>
        <tbody>
          {cart.map((l) => (
            <tr key={l.product.id}>
              <td>{l.product.name}</td>
              <td>{yen(l.product.price)}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={l.quantity}
                  aria-label={`${l.product.name} の数量`}
                  onChange={(e) => onChange(setQuantity(cart, l.product.id, Number(e.target.value)))}
                />
              </td>
              <td>{yen(l.product.price * l.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="total">合計（目安）: {yen(total(cart))}</p>
      {me === null ? (
        <button onClick={onLogin}>ログインして注文する</button>
      ) : (
        <div className="checkout">
          <p>お届け先: {me.address}</p>
          <label>
            カード{" "}
            <select value={card} onChange={(e) => setCard(e.target.value)}>
              {CARDS.map((c) => (
                <option key={c.token} value={c.token}>{c.label}</option>
              ))}
            </select>
          </label>
          <button disabled={busy} onClick={() => void order()}>注文を確定する</button>
          {error !== null && <p className="error">{error}</p>}
        </div>
      )}
    </section>
  );
}

function Orders({ me, onLogin }: { me: Customer | null; onLogin: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (me !== null) api.orders().then(setOrders, (e: unknown) => setError(message(e)));
  }, [me]);
  if (me === null) return <button onClick={onLogin}>ログインして注文履歴を見る</button>;
  if (error !== null) return <p className="error">{error}</p>;
  if (orders === null) return <p>読み込み中…</p>;
  if (orders.length === 0) return <p>注文はまだありません。</p>;
  return (
    <ul className="orders">
      {orders.map((o) => (
        <li key={o.id}>
          <h2>注文 #{o.id}（{o.status === "paid" ? "支払済み" : o.status === "shipped" ? "発送済み" : o.status}）</h2>
          <p>{o.created_at.slice(0, 16)} UTC ・ 合計 {yen(o.total)}</p>
          <ul>
            {o.items.map((i) => (
              <li key={i.line_no}>{i.product_name} × {i.quantity}（{yen(i.unit_price)}）</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function Account({ me, onChange }: { me: Customer | null; onChange: (c: Customer | null) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  if (me !== null) {
    return (
      <section>
        <p>{me.full_name}（{me.email}）でログインしています。</p>
        <p>お届け先: {me.address}</p>
        <button onClick={() => void api.logout().then(() => onChange(null))}>ログアウト</button>
      </section>
    );
  }
  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string): string => String(f.get(k) ?? "");
    setError(null);
    try {
      onChange(mode === "login"
        ? await api.login(v("email"), v("password"))
        : await api.signup({ email: v("email"), password: v("password"), full_name: v("full_name"), address: v("address") }));
    } catch (err) {
      setError(message(err));
    }
  };
  return (
    <section>
      <form className="account" onSubmit={(e) => void submit(e)}>
        <label>メール <input name="email" type="email" required autoComplete="email" /></label>
        <label>
          パスワード{" "}
          <input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </label>
        {mode === "signup" && (
          <>
            <label>氏名 <input name="full_name" required maxLength={100} autoComplete="name" /></label>
            <label>住所 <input name="address" required maxLength={500} autoComplete="street-address" /></label>
          </>
        )}
        <button type="submit">{mode === "login" ? "ログイン" : "登録する"}</button>
        {error !== null && <p className="error">{error}</p>}
      </form>
      <button className="link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? "はじめての方は登録" : "登録済みの方はログイン"}
      </button>
      <p className="hint">試し用: hanako@example.com / password</p>
    </section>
  );
}
