# セットアップ手順（最初の1回だけ・手作業）

所要時間の目安: 合計1〜2時間。上から順にやればOK。
取得したキー類は `.env` に入れる（`.env.example` をコピーして `.env` を作る）。**`.env` は絶対に人に見せない・コミットしない。**
アカウント名やストアフロントURLなど秘密じゃない設定は `content/account.json` に入れる。

---

## 0. 楽天版の自動実行を止める（2分）

楽天アフィのリポジトリにも GitHub Actions（毎日の投稿・トークン更新）が入っている。同じインスタのトークンを使うので止めておく。
Claude に「楽天アフィの Actions を止めて」と頼むか、GitHub の楽天アフィのリポジトリ → Actions → 各ワークフロー → 右上「…」→「Disable workflow」。

## 1. Instagram のプロフィールを差し替える（5分）

1. まだなら: プロフィール → 右上の≡ →「アカウントの種類とツール」→「プロアカウントに切り替える」（種類は **クリエイター**、カテゴリは「ショッピング・小売」か「ブロガー」）
2. 名前・自己紹介は [account-profile.md](account-profile.md) の文面にする
3. リンクは手順3で作るストアフロントのURLにする（あとでOK）

> Facebookページとの連携は不要（「Instagramログイン」方式のAPIを使うため）

## 2. Amazonアソシエイトに登録する（15分）

1. https://affiliate.amazon.co.jp/ →「無料アカウントを作成」→ Amazon のアカウントでログイン
2. 「ウェブサイトおよびモバイルアプリ」に **Instagram のURL**（`https://www.instagram.com/ユーザーネーム/`）を入れる
3. ストアID（トラッキングID、`xxxxx-22` の形）を決める
4. 支払い・税務情報を入れて完了
5. すでに登録済みなら: アソシエイト・セントラル → アカウント設定 →「ウェブサイトおよびモバイルアプリの情報」に Instagram のURLを追加

> **申請から180日以内に適格販売が3件ないと承認されない**（自分の購入は対象外）。最初の半年はフォロワーと保存数を増やすことに集中
> 承認の審査では Instagram の中身も見られるので、投稿が数本たまってから審査に進むのが安心

## 3. ストアフロントを作る（10分）

2026年4月末から、アソシエイト登録者なら誰でもストアフロントを作れる。

1. アソシエイト・セントラルのメニュー（または Amazon ショッピングアプリのアソシエイト用メニュー）から「ストアフロント」を開いて作成
   - メニュー名や場所は変わることがあるので、見当たらなければアソシエイト・セントラルのヘルプで「ストアフロント」と検索
2. 表示名・自己紹介は [account-profile.md](account-profile.md) の文面にする
3. ストアフロントのURL（`https://www.amazon.co.jp/shop/...`）を
   - `content/account.json` の `storefrontUrl` に入れる
   - Instagram のプロフィールのリンクに入れる
4. アイデアリストは投稿を作ってから（`npm run storefront` のチェックリストどおりに）作る

## 4. Gemini の APIキーを取る（5分）

1. https://aistudio.google.com/apikey →「APIキーを作成」→ `GEMINI_API_KEY` へ
2. 画像生成モデル（Nano Banana Pro）は **有料枠（課金設定）が必要**
   - 目安: 1枚あたり20円前後。1投稿7枚 × 14本 ≒ 100枚で **2,000〜3,000円くらい**（作り直し込み）。正確な単価は Google の料金ページで確認
   - Google AI Studio の「Billing」で予算アラートを設定しておくと安心

## 5. Supabase（画像の公開置き場）を用意する（10分）

Instagram は「ネット上の公開URL」からしか画像を受け取れないので、投稿の瞬間だけここに置く。無料・クレカ不要。

1. https://supabase.com でサインアップ →「New project」（リージョンは Tokyo）
2. 左メニュー「Storage」→「New bucket」→ 名前 `ig-images`、**Public bucket をON**
3. 「Project Settings」→「API Keys」で **secret key**（`sb_secret_...`）をコピー → `SUPABASE_SECRET_KEY`
4. 「Project Settings」→「Data API」の Project URL → `SUPABASE_URL`

> 無料プランは1週間アクセスがないと一時停止する。毎日投稿していれば止まらない

## 6. Meta（Instagram API）のアクセストークンを取る（20〜30分）

1. https://developers.facebook.com/ に Facebook アカウントでログイン（開発者登録がまだなら登録）
2. 「マイアプリ」→「アプリを作成」
   - ユースケース: **「Instagramでメッセージやコンテンツを管理」**
   - ビジネスポートフォリオ: 今はなしでOK
3. 左メニュー「アプリの役割」→「役割」→「メンバーを追加」→ **Instagramテスター** に自分のIGアカウント名を追加
4. Instagramアプリ側で承認: 設定 →「ウェブサイトのアクセス許可」→「アプリとウェブサイト」→「テスターへの招待」→ 承認
5. Metaのアプリ画面「ユースケース」→ Instagram の「カスタマイズ」→「Instagramログインによる API 設定」
   - 「アクセストークンを生成」でアカウントを追加 → Instagramにログインして権限を許可
   - 表示された **トークン** → `IG_ACCESS_TOKEN`（一度しか表示されないのですぐコピー）
6. `IG_USER_ID` は空のままでOK → 次の「7. 確認」で正しい値が表示される

> 自分のアカウントに投稿するだけなら **アプリ審査は不要**（テスター扱いで使える）
> トークンは60日で切れるけど、GitHub Actions が月2回自動更新する（手順8）

## 7. 確認

```
npm install
npm run check
```

全部 ✅ になればOK。❌ が出たらメッセージに従って `.env` か `content/account.json` を直す。

## 8. GitHub（毎日の自動投稿）

1. https://github.com/new で **Private** リポジトリを新しく作る（README などは追加しない。楽天アフィとは別）
2. Claude に「GitHubにpushして」と頼む（リポジトリURLを伝える）
3. リポジトリの Settings →「Secrets and variables」→「Actions」→「New repository secret」で登録:

| 名前 | 値 |
|---|---|
| `IG_USER_ID` | `.env` と同じ |
| `IG_ACCESS_TOKEN` | `.env` と同じ |
| `SUPABASE_URL` | `.env` と同じ |
| `SUPABASE_SECRET_KEY` | `.env` と同じ |
| `GH_PAT` | 下で作るトークン |

4. `GH_PAT`（トークン自動更新用）の作り方:
   GitHub 右上アイコン → Settings → Developer settings → Personal access tokens →「Fine-grained tokens」→「Generate new token」
   - Repository access: **このリポジトリだけ**
   - Permissions →「Secrets」: **Read and write**
   - 有効期限: 最長にしてカレンダーに更新日をメモ
5. Actions タブ →「Instagram自動投稿」→「Run workflow」（ドライランにチェック）で動作確認

> 非公開リポジトリの GitHub Actions は無料プランで月2,000分まで。毎日1分程度なので余裕
