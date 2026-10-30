import { type Customer, yen } from "../api.ts";
import { type Cart, limitOf, remove, setQuantity, total } from "../cart.ts";
import { CARDS } from "../constants.ts";
import type { Checkout } from "../useCheckout.ts";
import { QuantityInput } from "./QuantityInput.tsx";

export function CartView(props: {
  cart: Cart;
  me: Customer | null;
  checkout: Checkout;
  onChange: (c: Cart) => void;
  onLogin: () => void;
}) {
  const { cart, me, checkout, onChange, onLogin } = props;
  const { busy } = checkout;
  if (cart.length === 0) {
    return (
      <section>
        <p>カートは空です。</p>
        {checkout.error !== null && <p className="error">{checkout.error}</p>}
      </section>
    );
  }
  return (
    <section>
      <table className="cart">
        <thead>
          <tr><th>商品</th><th>単価</th><th>数量</th><th>小計</th><th></th></tr>
        </thead>
        <tbody>
          {cart.map((l) => (
            <tr key={l.product.id}>
              <td>{l.product.name}</td>
              <td>{yen(l.product.price)}</td>
              <td>
                <QuantityInput
                  value={l.quantity}
                  max={limitOf(l.product)}
                  label={`${l.product.name} の数量`}
                  disabled={busy}
                  onCommit={(q) => onChange(setQuantity(cart, l.product.id, q))}
                />
              </td>
              <td>{yen(l.product.price * l.quantity)}</td>
              <td>
                <button disabled={busy} onClick={() => onChange(remove(cart, l.product.id))} aria-label={`${l.product.name} を削除`}>
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="total">合計（目安）: {yen(total(cart))}</p>
      {me === null ? (
        <>
          <button onClick={onLogin}>ログインして注文する</button>
          {checkout.error !== null && <p className="error">{checkout.error}</p>}
        </>
      ) : (
        <div className="checkout">
          <p>お届け先: {me.address}</p>
          <label>
            カード{" "}
            <select value={checkout.card} disabled={busy} onChange={(e) => checkout.setCard(e.target.value)}>
              {CARDS.map((c) => (
                <option key={c.token} value={c.token}>{c.label}</option>
              ))}
            </select>
          </label>
          <button disabled={busy} onClick={() => void checkout.place()}>注文を確定する</button>
          {checkout.error !== null && <p className="error">{checkout.error}</p>}
        </div>
      )}
    </section>
  );
}
