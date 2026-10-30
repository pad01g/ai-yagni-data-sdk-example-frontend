/**
 * 注文の確定。依頼の冪等キーと選んだカードは App に置き、画面を切り替えても消えないようにする。
 * キーをいつ作り直すかは checkout.ts が決める。
 */
import { useState } from "react";

import { type Customer, type Order, api, errorMessage } from "./api.ts";
import { type Cart, lines } from "./cart.ts";
import { type Outcome, type RequestKey, basisOf, follow, fresh, outcomeOf, settle } from "./checkout.ts";
import { CARDS } from "./constants.ts";

const newKey = (): string => crypto.randomUUID();

const PENDING_MESSAGE =
  "支払いの確認がまだ済んでいません。カートとカードを変えずに、もう一度「注文を確定する」を押してください（注文は 1 つのままです）。";
const RETRY_HINT = "（同じ内容のままやり直しても、注文は 1 つになります）";

export interface Checkout {
  readonly card: string;
  readonly setCard: (card: string) => void;
  readonly busy: boolean;
  readonly error: string | null;
  readonly place: () => Promise<void>;
}

export function useCheckout(
  cart: Cart,
  me: Customer | null,
  on: { readonly ordered: (o: Order) => void; readonly rejected: () => void },
): Checkout {
  const [card, setCard] = useState<string>(CARDS[0].token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basis = basisOf(lines(cart), card, me?.email ?? null);
  const [stored, setStored] = useState<RequestKey>(() => fresh(basis, newKey));
  // カート・カード・ログインしている人が変わったら、描画の中でキーを作り直す
  const requestKey = follow(stored, basis, newKey);
  if (requestKey !== stored) setStored(requestKey);

  const place = async (): Promise<void> => {
    const sent = requestKey.key;
    setBusy(true);
    setError(null);
    let outcome: Outcome;
    let order: Order | null = null;
    try {
      order = await api.placeOrder(sent, lines(cart), card);
      outcome = outcomeOf({ order });
    } catch (e) {
      outcome = outcomeOf({ error: e });
      setError(outcome === "unknown" ? `${errorMessage(e)}${RETRY_HINT}` : errorMessage(e));
    } finally {
      setBusy(false);
    }
    setStored((s) => settle(s, sent, outcome, newKey));
    if (outcome === "pending") setError(PENDING_MESSAGE);
    else if (outcome === "accepted" && order !== null) on.ordered(order);
    else if (outcome === "rejected") on.rejected();
  };

  return { card, setCard, busy, error, place };
}
