# ai-yagni-data-sdk-example-frontend

EC の例（[ai-yagni-data-sdk-example-backend-rust](https://github.com/pad01g/ai-yagni-data-sdk-example-backend-rust)）の利用者向けフロントエンドです。

Vite + React + TypeScript の SPA で、最小構成にしています。

- SSR はしません。
- ルーターやデータ取得のライブラリは使わず、`fetch` と React の状態だけで書いています。

## 画面

| 画面 | 中身 |
|---|---|
| 商品 | 商品の一覧と在庫。カートに入れる |
| カート | 数量の変更、カードの選択、注文の確定 |
| 注文履歴 | 自分の注文と明細 |
| ログイン | メールとパスワードでログインする、または登録する |

- **カート**: カートはブラウザのメモリにだけ置きます。サーバーにカートの表はありません。
- **合計**: 画面の合計は目安です。注文の合計は、backend-proxy が DB の価格から決めます。
- **依頼の冪等キー**: 注文の確定では `crypto.randomUUID()` の依頼の冪等キーを送ります。通信が失敗してやり直しても、注文は 1 つになります。
- **セッション**: セッションは backend-rust が発行する HttpOnly の cookie です。この SPA からは触りません。
- **試し用のアカウント**: `hanako@example.com` / `password`（backend の代表データ）

## API

`/api` を backend-rust に渡します。

- **compose の中**: nginx が渡します（[`nginx.conf`](nginx.conf)）。
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
