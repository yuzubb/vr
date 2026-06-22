# VRM 同期チェック

リアルタイムの顔トラッキングでVRMアバターを動かし、**「実際の顔」と「アバターの顔」が
ちゃんと同期しているか**を一定間隔でDiscordに送って確認するツールです。

- 顔の検出: MediaPipe FaceLandmarker（ブラウザ内で処理）
- アバター: VRM（@pixiv/three-vrm + Three.js）
- 通知: Discord Webhook（サーバー側のAPIルート経由で送信）

カメラ映像そのものは外部に送りません。送るのは一定間隔で撮影した静止画2枚だけです。
起動前に同意画面で、何が起きるかを明示します。

---

## 必要なもの

- Node.js 18.17 以上
- VRM モデル（`public/models/avatar.vrm`）
- Discord の Webhook URL

---

## セットアップ

```bash
# 1. 依存をインストール
npm install

# 2. 環境変数を用意
cp .env.example .env.local
#   .env.local を開いて DISCORD_WEBHOOK_URL を貼り付ける

# 3. VRMモデルを配置
#   public/models/avatar.vrm として保存
#   無料モデル: https://hub.vroid.com/

# 4. 開発サーバー起動
npm run dev
#   http://localhost:3000 を開く
```

> カメラは `localhost` か HTTPS でしか起動しません。Render などにデプロイすれば
> 自動でHTTPSになります。

---

## Discord Webhook の作り方

1. Discord サーバーの「サーバー設定」→「連携サービス」→「ウェブフック」
2. 「新しいウェブフック」を作成し、投稿先チャンネルを選ぶ
3. 「ウェブフックURLをコピー」して `.env.local` の `DISCORD_WEBHOOK_URL` に貼る

このURLは秘密です。`NEXT_PUBLIC_` を付けず、サーバー側だけで使っています
（ブラウザのコードには出ません）。

---

## 仕組み

```
カメラ ──> MediaPipe FaceLandmarker ──> 顔の向き・表情(blendshapes)
                                              │
                                              ▼
                                   lib/faceToVRM.ts で
                                   VRMの頭ボーン・表情に反映
                                              │
       ┌──────────────────────────┬──────────┘
       ▼                          ▼
  実際の顔(canvas)          アバター(WebGL canvas)
       └────────── 30秒ごとに2枚を撮影 ──────────┘
                          │
                          ▼
              /api/webhook (サーバー側)
                          │
                          ▼
                  Discord チャンネル
```

### 顔→アバターの対応（`lib/faceToVRM.ts`）

| 顔の動き            | blendshape            | VRM表情/ボーン |
|--------------------|-----------------------|----------------|
| まばたき            | eyeBlinkLeft/Right    | `blink`        |
| 口を開く            | jawOpen               | `aa`           |
| 笑う               | mouthSmileLeft/Right  | `happy`        |
| 頭の向き(上下左右傾き)| 変換行列              | `head` ボーン   |

数値はローパスフィルタで平滑化しています。`smooth()` の係数を変えると
追従の機敏さ／なめらかさを調整できます。

---

## カスタマイズ

| やりたいこと            | 触る場所 |
|------------------------|---------|
| 送信間隔を変える         | `.env.local` の `NEXT_PUBLIC_CAPTURE_INTERVAL_MS` |
| 表情の対応を増やす       | `lib/faceToVRM.ts`（`em.setValue(...)` を追加） |
| 追従のなめらかさ調整     | `lib/faceToVRM.ts` の `smooth()` 係数 |
| 送信メッセージの見た目   | `app/api/webhook/route.ts` の `embed` |
| カメラ解像度/画質       | `components/FaceTracker.tsx` の `getUserMedia` |

VRM 1.0 の標準表情プリセット: `happy / angry / sad / relaxed / surprised /
aa / ih / ou / ee / oh / blink / blinkLeft / blinkRight / lookUp / lookDown /
lookLeft / lookRight / neutral`

---

## Render へのデプロイ

リポジトリに `render.yaml` を含めてあります。

1. GitHub にプッシュ
2. Render で「New +」→「Blueprint」→ リポジトリを選択
3. 環境変数 `DISCORD_WEBHOOK_URL` を入力（`sync: false` なので手動入力）
4. デプロイ完了後、表示されたURLを開く

手動で作る場合:

```
Type:          Web Service
Build Command: npm install && npm run build
Start Command: npm start
Env:           DISCORD_WEBHOOK_URL = （あなたのWebhook URL）
```

---

## トラブルシューティング

**カメラが起動しない**
`localhost` か HTTPS で開いているか確認。ブラウザのカメラ権限も確認。

**アバターが出ない / モデル読込失敗**
`public/models/avatar.vrm` があるか確認。別のVRMで試す。
ブラウザのコンソール（F12）でエラーを確認。

**Discordに届かない**
`.env.local` の `DISCORD_WEBHOOK_URL` が正しいか、Webhookが削除されて
いないか確認。サーバーログにDiscordの応答コードが出ます。

**アバターのキャプチャが真っ黒**
`VRMViewer` は `preserveDrawingBuffer: true` で初期化済み。WebGLが無効な
環境では表示されないので、対応ブラウザで開く。

---

## 使い方の注意

- 自分以外の人が映る場所で使うときは、その人にも内容を伝えて同意を得てください。
- Discord に残った画像は、不要になったら削除してください。
- 使用するVRMモデルの配布条件・ライセンスを守ってください。
