/**
 * 画面は 4 つ（商品・カート・注文履歴・ログイン/登録）。ルーターは使わず、状態で切り替える。
 * カート・ログインしている人・注文の確定（依頼の冪等キーとカード）は、画面を切り替えても残るようにここに置く。
 */
import { useCallback, useEffect, useState } from "react";

import { ApiError, type Customer, type Product, api, errorMessage, onUnauthorized, yen } from "./api.ts";
import { type Cart, add, parseCart, quantityOf, refresh } from "./cart.ts";
import { Account } from "./components/Account.tsx";
import { CartView } from "./components/CartView.tsx";
import { Orders } from "./components/Orders.tsx";
import { Products } from "./components/Products.tsx";
import { load, save } from "./storage.ts";
import { useCheckout } from "./useCheckout.ts";

const CART_STORE = "cart";

type View = "products" | "cart" | "orders" | "account";

export function App() {
  const [view, setView] = useState<View>("products");
  const [me, setMe] = useState<Customer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart>(() => parseCart(load(CART_STORE)));
  useEffect(() => save(CART_STORE, cart.length > 0 ? JSON.stringify(cart) : null), [cart]);
  const [notice, setNotice] = useState<string | null>(null);

  // セッションが切れていたら（ログインが要る API の 401）、ログインしていない状態にする
  useEffect(() => onUnauthorized(() => setMe(null)), []);

  const reloadProducts = useCallback(() => {
    api.products().then(
      (ps) => {
        setProducts(ps);
        setCart((c) => refresh(c, ps));
      },
      (e: unknown) => setNotice(errorMessage(e)),
    );
  }, []);

  useEffect(() => {
    reloadProducts();
    api.me().then(setMe, () => setMe(null));
  }, [reloadProducts]);

  const checkout = useCheckout(cart, me, {
    ordered: (o) => {
      setCart([]);
      reloadProducts();
      setNotice(`注文 #${o.id} を受け付けました（${yen(o.total)}）`);
      setView("orders");
    },
    // 在庫や価格が変わって断られたかもしれないので、読み直してカートを合わせる
    rejected: reloadProducts,
  });

  const logout = async (): Promise<void> => {
    try {
      await api.logout();
    } catch (e) {
      // 401 はもうログアウトしている
      if (!(e instanceof ApiError && e.status === 401)) throw e;
    }
    setCart([]);
    setMe(null);
  };

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
              if (checkout.locked) {
                setNotice("前の注文の結果を確かめています。カートの注文を確定するか、やめてから商品を足してください");
                return;
              }
              const before = quantityOf(cart, p.id);
              const next = add(cart, p);
              setCart(next);
              setNotice(quantityOf(next, p.id) > before
                ? `${p.name} をカートに入れました`
                : `${p.name} はこれ以上カートに入れられません`);
            }}
          />
        )}
        {view === "cart" && (
          <CartView cart={cart} me={me} checkout={checkout} onChange={setCart} onLogin={() => setView("account")} />
        )}
        {view === "orders" && <Orders me={me} onLogin={() => setView("account")} />}
        {view === "account" && (
          <Account
            me={me}
            onLogin={(c) => {
              setMe(c);
              setView(cart.length > 0 ? "cart" : "products");
            }}
            onLogout={logout}
          />
        )}
      </main>
    </div>
  );
}
