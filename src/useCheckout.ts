/**
 * 注文の確定。依頼の冪等キーと選んだカードは App に置き、画面を切り替えても消えないようにする。
 * キーをいつ作り直すかは checkout.ts が決める。
 */
import { useEffect, useState } from "react";

import { type Customer, type Order, api, errorMessage } from "./api.ts";
import { type Cart, lines } from "./cart.ts";
import { type Outcome, type RequestKey, basisOf, follow, fresh, outcomeOf, parseStored, settle } from "./checkout.ts";
import { CARDS } from "./constants.ts";
import { load, save } from "./storage.ts";

const newKey = (): string => crypto.randomUUID();

const RETRY_HINT = "（カートとカードはそのままにしてあります。もう一度「注文を確定する」を押しても、注文と請求は 1 つのままです）";
const KEY_STORE = "checkout.request";
const CARD_STORE = "checkout.card";

export interface Checkout {
  readonly card: string;
  readonly setCard: (card: string) => void;
  readonly busy: boolean;
  /** 前の依頼の結果が分からないまま。やり直すか、やめるまでカートとカードを変えさせない。 */
  readonly locked: boolean;
  readonly error: string | null;
  readonly place: () => Promise<void>;
  /** 結果の分からない依頼をあきらめ、カートとカードを変えられるようにする。 */
  readonly abandon: () => void;
}

export function useCheckout(
  cart: Cart,
  me: Customer | null,
  on: { readonly ordered: (o: Order) => void; readonly rejected: () => void },
): Checkout {
  const [card, setCard] = useState<string>(() => {
    const saved = load(CARD_STORE);
    return CARDS.some((c) => c.token === saved) ? (saved as string) : CARDS[0].token;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basis = basisOf(lines(cart), card, me?.email ?? null);
  const [stored, setStored] = useState<RequestKey>(() => parseStored(load(KEY_STORE)) ?? fresh(basis, newKey));
  useEffect(() => save(KEY_STORE, JSON.stringify(stored)), [stored]);
  useEffect(() => save(CARD_STORE, card), [card]);
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
    if (outcome === "accepted" && order !== null) on.ordered(order);
    else if (outcome === "rejected") on.rejected();
  };

  const abandon = (): void => {
    setStored(fresh(basis, newKey));
    setError(null);
  };

  return { card, setCard, busy, locked: requestKey.unsettled, error, place, abandon };
}
