import { useEffect, useState } from "react";

import { type Customer, type Order, api, errorMessage, yen } from "../api.ts";
import { statusLabel } from "../constants.ts";

export function Orders({ me, onLogin }: { me: Customer | null; onLogin: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (me !== null) api.orders().then(setOrders, (e: unknown) => setError(errorMessage(e)));
  }, [me]);
  if (me === null) return <button onClick={onLogin}>ログインして注文履歴を見る</button>;
  if (error !== null) return <p className="error">{error}</p>;
  if (orders === null) return <p>読み込み中…</p>;
  if (orders.length === 0) return <p>注文はまだありません。</p>;
  return (
    <ul className="orders">
      {orders.map((o) => (
        <li key={o.id}>
          <h2>注文 #{o.id}（{statusLabel(o.status)}）</h2>
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
