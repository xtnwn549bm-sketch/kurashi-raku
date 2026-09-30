# セットアップ手順（最初の1回だけ・手作業）

所要時間の目安: 合計1〜2時間。上から順にやればOK。
取得したキー類は `.env` に入れる（`.env.example` をコピーして `.env` を作る）。**`.env` は絶対に人に見せない・コミットしない。**
アカウント名・トラッキングID・リンク集ページのURLなど秘密じゃない設定は `content/account.json` に入れる。

---

## 1. Instagram のプロフィールを差し替える（5分）

1. まだなら: プロフィール → 右上の≡ →「アカウントの種類とツール」→「プロアカウントに切り替える」（種類は **クリエイター**、カテゴリは「ショッピング・小売」か「ブロガー」）
2. 名前・自己紹介は [account-profile.md](account-profile.md) の文面にする
3. リンクは手順7で作るリンク集ページのURLにする（あとでOK）

> Facebookページとの連携は不要（「Instagramログイン」方式のAPIを使うため）

## 2. Amazonアソシエイトに登録する（15分）

1. https://affiliate.amazon.co.jp/ →「無料アカウントを作成」→ Amazon のアカウントでログイン
2. 「ウェブサイトおよびモバイルアプリ」に **Instagram のURL**（`https://www.instagram.com/ユーザーネーム/`）を入れる
3. ストアID（トラッキングID、`xxxxx-22` の形）を決める → `content/account.json` の `associateTag` に入れる
4. 支払い・税務情報を入れて完了
5. すでに登録済みなら: アソシエイト・セントラル → アカウント設定 →「ウェブサイトおよびモバイルアプリの情報」に Instagram のURLを追加

> **申請から180日以内に適格販売が3件ないと承認されない**（自分の購入は対象外）。審査前でもリンクは使えて、売上も計測される
> 審査では Instagram とリンク集ページの中身も見られるので、投稿が数本たまってから審査に進むのが安心

## 3. OpenAI の APIキーを取る（10分）

イラストを自動で作るのに使う。**ChatGPT のサブスク（Plus など）とは別の従量課金**で、サブスクの料金には含まれない。

1. https://platform.openai.com/ に ChatGPT と同じアカウントでログイン
2. 「Settings」→「Billing」でクレジットを前払いで追加（最初は $5〜10 で十分）。使いすぎ防止の上限も設定しておく
3. 画像生成モデル（GPT Image）は、API の「組織の認証（Organization Verification）」が済んでいないと使えない。やり方は公式ヘルプ https://help.openai.com/en/articles/10910291-api-organization-verification を見て
4. 「API keys」→「Create new secret key」→ 表示されたキーを `OPENAI_API_KEY` へ（一度しか表示されないのですぐコピー）

- 料金の目安: `gpt-image-2`（quality: medium）で1枚5〜8円。1投稿6枚で50円前後、14本で700円前後
- `OPENAI_IMAGE_QUALITY=low` にすると1枚1円前後まで下がる（仕上がりは粗くなる）
- API を使わずに ChatGPT アプリで手作りすることもできる: `npm run images -- --post <id> --prompts` で出たプロンプトを ChatGPT に貼り、できた画像を表示された場所に保存して `npm run images -- --post <id> --no-api`

## 4. Supabase（画像の公開置き場）を用意する（10分）

Instagram は「ネット上の公開URL」からしか画像を受け取れないので、投稿の瞬間だけここに置く。無料・クレカ不要。

1. https://supabase.com でサインアップ →「New project」（リージョンは Tokyo）
2. 左メニュー「Storage」→「New bucket」→ 名前 `ig-images`、**Public bucket をON**
3. 「Project Settings」→「API Keys」で **secret key**（`sb_secret_...`）をコピー → `SUPABASE_SECRET_KEY`
4. 「Project Settings」→「Data API」の Project URL → `SUPABASE_URL`

> 無料プランは1週間アクセスがないと一時停止する。毎日投稿していれば止まらない

## 5. Meta（Instagram API）のアクセストークンを取る（20〜30分）

1. https://developers.facebook.com/ に Facebook アカウントでログイン（開発者登録がまだなら登録）
2. 「マイアプリ」→「アプリを作成」
   - ユースケース: **「Instagramでメッセージやコンテンツを管理」**
   - ビジネスポートフォリオ: 今はなしでOK
3. 左メニュー「アプリの役割」→「役割」→「メンバーを追加」→ **Instagramテスター** に自分のIGアカウント名を追加
4. Instagramアプリ側で承認: 設定 →「ウェブサイトのアクセス許可」→「アプリとウェブサイト」→「テスターへの招待」→ 承認
5. Metaのアプリ画面「ユースケース」→ Instagram の「カスタマイズ」→「Instagramログインによる API 設定」
   - 「アクセストークンを生成」でアカウントを追加 → Instagramにログインして権限を許可
   - 表示された **トークン** → `IG_ACCESS_TOKEN`（一度しか表示されないのですぐコピー）
6. `IG_USER_ID` は空のままでOK → 次の「6. 確認」で正しい値が表示される

> 自分のアカウントに投稿するだけなら **アプリ審査は不要**（テスター扱いで使える）
> トークンは60日で切れるけど、GitHub Actions が月2回自動更新する（手順7）

## 6. 確認

```
npm install
npm run check
```

全部 ✅ になればOK。❌ が出たらメッセージに従って `.env` か `content/account.json` を直す。

## 7. GitHub（毎日の自動投稿とリンク集ページ）

1. https://github.com/new で **Public（公開）** リポジトリを新しく作る（README などは追加しない）
   - 無料で GitHub Pages を使うには公開リポジトリが必要。`.env` はコミットされないので、キー類が見られることはない
   - 投稿の文言やスクリプトは誰でも見られる状態になる
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
5. リンク集ページを有効にする: Settings →「Pages」→「Build and deployment」の Source を **「GitHub Actions」** にする
6. Actions タブ →「リンク集ページの公開」→「Run workflow」→ 終わったら表示されるURL（`https://ユーザー名.github.io/リポジトリ名/`）を
   - `content/account.json` の `siteUrl` に入れる
   - Instagram のプロフィールのリンクに入れる
   - アソシエイト・セントラルの「ウェブサイトおよびモバイルアプリの情報」に追加する（リンクを置く場所は全部登録が必要）
7. Actions タブ →「Instagram自動投稿」→「Run workflow」（ドライランにチェック）で動作確認

> 公開リポジトリの GitHub Actions は無料

## 8. 審査に通ったら（ストアフロント）

アソシエイトの審査に通ると、Amazon 上に自分のストアフロントを作れる。通ったら Claude に「ストアフロント作れるようになった」と伝えればOK。
1. アソシエイト・セントラルからストアフロントを作る（表示名・自己紹介は [account-profile.md](account-profile.md)）
2. 投稿と同じ名前のアイデアリストを作って、リンク集ページと同じ商品を入れる
3. ストアフロントのURLを `content/account.json` の `storefrontUrl` に、各リストのURLを post.json の `storefrontListUrl` に入れる → リンク集ページにボタンが出る
