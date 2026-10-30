# ai-yagni-data-sdk-example-frontend

EC の例（[ai-yagni-data-sdk-example-backend-rust](https://github.com/pad01g/ai-yagni-data-sdk-example-backend-rust)）の利用者向けフロントエンドです。

Vite + React + TypeScript の SPA で、最小構成にしています。

- SSR はしません。
- ルーターやデータ取得のライブラリは使わず、`fetch` と React の状態だけで書いています。

## 画面

| 画面 | 中身 |
|---|---|
| 商品 | 商品の一覧と在庫。カートに入れる |
| カート | 数量の変更と削除、カードの選択、注文の確定 |
| 注文履歴 | 自分の注文と明細 |
| ログイン | メールとパスワードでログインする、または登録する |

- **カート**: カートはブラウザのメモリにだけ置きます。サーバーにカートの表はありません。
  - 数量は 1 から「99 と在庫の少ないほう」までです。数量の欄は、欄を離れたときか Enter で確定します。行を消すのは「削除」ボタンです。
  - 商品の一覧を読み直すと、カートの価格と在庫も新しくします。在庫を超える数量は減らし、なくなった商品と在庫切れの商品は外します。
  - ログアウトするとカートは空になります。
- **合計**: 画面の合計は目安です。注文の合計は、backend-proxy が DB の価格から決めます。
- **依頼の冪等キー**: 注文の確定では `crypto.randomUUID()` の依頼の冪等キーを送ります（[`src/checkout.ts`](src/checkout.ts)）。
  - 通信の失敗・5xx・支払い確認中（`pending`）のあとは、同じキーのままです。同じ内容でやり直しても、注文は 1 つになります。画面を切り替えてもキーは変わりません。
  - カートの中身・カード・ログインしている人が変わったとき、注文が受け付けられたとき、4xx で断られたときは、新しいキーにします。
- **注文の状態**: 支払い確認中（`pending`）・支払済み（`paid`）・発送済み（`shipped`）・取り消し（`cancelled`）。
- **ログインの切れ**: ログインが要る API が 401 を返したら、ログインしていない状態に戻します。ログインの 401（パスワードの誤り）はエラーを出すだけです。
- **セッション**: セッションは backend-rust が発行する HttpOnly の cookie です。この SPA からは触りません。
- **試し用のアカウント**: `hanako@example.com` / `password`（backend の代表データ）

## API

`/api` を backend-rust に渡します。

- **compose の中**: nginx が渡します（[`nginx.conf`](nginx.conf)）。
  - `backend` の名前は compose の DNS で 10 秒ごとに引き直します。backend のコンテナを作り直しても見つけ直せます。
  - ログインと登録は、送り元の IP ごとに 1 分 10 回まで（ほかに 5 回の余裕）です。超えると 429 を返します。
  - `/api` の依頼の本文は 16 KB までです。
  - セキュリティのヘッダー（CSP・`X-Frame-Options` など）を付けます。`/assets/` はずっとキャッシュさせ、`index.html` は毎回確かめさせます。
- **手元の開発サーバー**: Vite が渡します（`BACKEND_URL`）。

## 動かし方（ホストには docker 以外何も入れない）

```sh
make ci       # 型検査・テスト・ビルド
make image    # nginx のイメージ
make dev      # 開発サーバー（http://localhost:5173）
```

全体（MySQL・proxy・payment・backend・frontend）は、backend-rust の `make up` で起動します。

## ライセンス

MIT
