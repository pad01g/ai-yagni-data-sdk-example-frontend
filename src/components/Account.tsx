import { type FormEvent, useState } from "react";

import { type Customer, api, errorMessage } from "../api.ts";

export function Account(props: {
  me: Customer | null;
  onLogin: (c: Customer) => void;
  onLogout: () => Promise<void>;
}) {
  const { me, onLogin, onLogout } = props;
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (me !== null) {
    const logout = async (): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        await onLogout();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    };
    return (
      <section>
        <p>{me.full_name}（{me.email}）でログインしています。</p>
        <p>お届け先: {me.address}</p>
        <button disabled={busy} onClick={() => void logout()}>ログアウト</button>
        {error !== null && <p className="error">{error}</p>}
      </section>
    );
  }
  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string): string => String(f.get(k) ?? "");
    setBusy(true);
    setError(null);
    try {
      onLogin(mode === "login"
        ? await api.login(v("email"), v("password"))
        : await api.signup({ email: v("email"), password: v("password"), full_name: v("full_name"), address: v("address") }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
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
        <button type="submit" disabled={busy}>{mode === "login" ? "ログイン" : "登録する"}</button>
        {error !== null && <p className="error">{error}</p>}
      </form>
      <button className="link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? "はじめての方は登録" : "登録済みの方はログイン"}
      </button>
      <p className="hint">試し用: hanako@example.com / password</p>
    </section>
  );
}
