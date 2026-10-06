# Amazonアソシエイト × Instagram 収益化パイプライン

暮らし・家事・収納ジャンルの「選ぶときのチェックポイント」図解カルーセルを作り、Instagram Graph API で毎日自動投稿する。
導線は「インスタ投稿 → プロフのリンク（GitHub Pages のリンク集ページ）→ 投稿と同じ見出し → 商品ごとの『Amazonで見る』→ 購入」。
ストアフロントはアソシエイトの審査に通ってから追加する（`content/account.json` の `storefrontUrl` を入れるとリンク集ページにボタンが出る）。

- 手作業のセットアップ: [docs/setup-guide.md](docs/setup-guide.md)
- 投稿の型・キャプション・守るルール: [docs/content-strategy.md](docs/content-strategy.md)
- アカウント設計: [docs/account-profile.md](docs/account-profile.md)
- 毎日の運用・困ったとき（投稿結果が不明、リンク保留など）: [docs/operations.md](docs/operations.md)

## 投稿を作る流れ

```
npm run build-posts -- --all        # themes.json → posts/<id>/post.json（status: draft、商品スロットだけ）
（Claude が文言を書く → status: written）
npm run images -- --all             # 足りないイラストを OpenAI で生成 → 文字を合成して slide1〜7.jpg
（スライドを目視チェック。イラストが微妙なら --post <id> --redo item3 で作り直し）
npm run picks                       # 商品選びチェックリスト（docs/picks-checklist.md）
npm run links -- --post <id> URL1 … URL5   # ユーザーが選んだ商品のURLを登録（ASIN → アソシエイトリンク）
npm run caption -- --post <id>      # 投稿される文章の最終形と、商品ごとの「キャプションの行 ↔ チェックポイント」を表示（読むだけ）
npm run status -- --approve <id>    # 規約チェック・商品リンクがそろっていれば status: ready（投稿待ち）。承認の指紋を保存
git push                            # GitHub Actions が毎日8時に ready の先頭1本を投稿 → リンク集ページも更新
npm run status                      # 投稿ごとの「次にやること」
npm run status -- --json            # 同じ情報を機械可読で。投稿ごとに nextAction.code と blockedBy（user なら人が実行する）が出る
npm test                            # コードを変えたら。外部サービスにはつながない
```

## Claude が post.json の文言を書くときのルール

draft の post.json を開き、以下を埋めて `status` を `"written"` にする。

- `products[].shortName`: アイテムの種類名。**12文字以内**、ブランド名・型番は入れない（例: 「伸縮できる室内物干し」）
- `products[].points`: 「選ぶときのチェックポイント」を **ちょうど3つ、各14文字以内**
  - ユーザーはこの3つを**全部満たす商品**を Amazon で選ぶ。だから「探せば普通に見つかる具体的な条件」にする（例: 「使わない日は薄くたためる」「幅を伸縮して調整できる」）
  - 特定商品の性能・使用感・価格・評価は書かない
- `products[].illustration`: イラストの説明。**一般的な形状で**書く（特定メーカー製品に似せない）。文字が入るもの（パッケージ・ボタン表示）は「（文字なし）」と添える
- `cover.title`: 表紙の大見出し。**改行位置を `\n` で指定**して、1行10〜12文字にする（例: `"部屋干しがラクになる\n洗濯グッズ5選"`）。改行を抜くと `title` と同じになるように
- `cover.subtitle`: 悩みが伝わる一言（16文字以内）
- `cta.headline`: まとめスライドの大見出し（12文字以内）
- `caption`: [content-strategy.md](docs/content-strategy.md) のテンプレどおりの **本文だけ**。`#PR`・AI表記・リンク集ページのURL・アソシエイト開示文・ハッシュタグは自動で付くので書かない
- `hashtags`: 5個まで（固定 `#amazonで買えるもの` `#暮らしのアイデア` ＋テーマ別3個）

禁止（`lib/compliance.js` が自動で止める）: 価格・送料、★・評価の数字・レビュー件数・順位、「最安」「No.1」「必ず」などの断定、「使ってみた」「購入品」などの体験談、「Amazon公式」「Amazonおすすめ」、配送条件。Amazonの商品画像は使わない。

ユーザーが「01の商品URLこれ」と貼ってきたら、`npm run links -- --post <id> <URL…>` で登録する。

ユーザーが選んだ商品がチェックポイントを満たさないときは、登録する前に「別の商品を選ぶ」か「チェックポイントをその商品に合わせて書き換える」かをユーザーに聞く。書き換えるときは、その都度次の4つをセットでやる:
1. `products[].points` を書き換える（上のルールどおり。書き換えた理由は `products[].review.note` に残す）
2. `caption` の同じ番号の行（`01 〇〇 … 一言`）も新しいチェックポイントに合わせて書き直す
3. `npm run images -- --post <id> --no-api` でスライドを作り直して目視チェック
4. `npm run caption -- --post <id>` の出力（投稿される文章そのもの）をユーザーに見せてから、承認に進む

**商品を推測で登録しない。** チェックポイントを満たすか確かめられない商品は登録・承認しない。投稿済みの商品が条件に合わないと分かったら、Instagram の投稿は触らず、post.json でリンクを外して `rejectedAsins` と `linkHold` に記録する（[docs/operations.md](docs/operations.md)）。

## 自動化（Hermes）から触るときの操作境界

上の商品選定・URL登録・承認・公開はすべて**人が実行する操作**で、Claude Code でも Hermes でも自動で走らせない。ここでは「人が実行する」を明確にして、自動化が越えない境界を定義する。一覧: [docs/hermes-ops.md](docs/hermes-ops.md)

自動で実行してよい:
- `npm run status` / `npm run status -- --json`（読むだけ）
- `npm run caption -- --post <id>`（読むだけ）
- `npm test`（外部サービスに無接続）
- `npm run picks`（`docs/picks-checklist.md` の生成だけ。git 管理下の成果物）
- `npm run images -- --post <id> --no-api`（**status: written の投稿だけ**。ready の再合成は承認の指紋を壊すので不可）
- `npm run images -- --post <id> --prompts`（プロンプトの表示のみ）
- `npm run build-posts -- --all`（新規 draft のみ。`--force` は不可）
- `npm run check`（外部への read-only。トークンは更新しない）
- `git status` / `git log` / `git diff`（読み取りのみ）

人が実行する操作（自動化は実行せず、コマンドの型を提示して止まる）:
- Amazon の商品選定そのもの（`products[].asin` を推測・補完・検索で埋めない）
- `npm run links`（商品URLの登録。`rejectedAsins` 付きの ASIN を再登録しない）
- `npm run status -- --approve <id>`（承認の指紋を作る）
- `npm run status -- --resolve <id> --published <URL>` / `--not-published`（結果が不明な投稿の復旧）
- `npm run publish` / `publish:dry` / `publish.js` の全モード（コンテナ作成だけでも Instagram に触れる）
- Instagram への投稿・編集・削除・再投稿
- `git commit` / `git push`（bot の push は push トリガーを動かさない既存設計のため）
- `npm run images -- --redo`（OpenAI の課金）/ `npm run refresh-token`（Secret の書き込み）
- `.env` / GitHub Secrets / `content/account.json` / `lib/compliance.js` の編集

`npm run status -- --json` の `nextAction.blockedBy` が `user` なら、その操作は人が実行する。
`code` は `write_copy` / `generate_slides` / `pick_products` / `approve` / `reapprove` /
`wait_publish` / `resolve_unknown` / `replace_held_link` / `verify_checkpoints` / `nothing` のいずれか。

## 実装メモ
- スライドの文字はすべてプログラムで描く（[lib/slides.js](lib/slides.js) / [lib/draw.js](lib/draw.js)）。AI にはイラスト（文字なし・正方形）だけを作らせる（[lib/illustrations.js](lib/illustrations.js)）
- イラスト生成は OpenAI Image API（[lib/openai-image.js](lib/openai-image.js)、既定は `gpt-image-2` / medium）。ChatGPT のサブスクとは別課金で、API組織の本人確認が必要。手作業なら `npm run images -- --post <id> --prompts` で出たプロンプトを ChatGPT に貼り、`posts/<id>/illust/<key>.png` に保存して `--no-api` で合成
- フォントは同梱の Zen Maru Gothic（OFL）。Windows の Pango は日本語を含むパスのフォントを読めず黙って別書体になるので、[lib/fonts.js](lib/fonts.js) が `C:/Users/Public/amazon-ig-fonts` にコピーしてから使う
- Amazon の AI 利用表記（2026/4/20〜）: キャプション1行目（`lib/posts.js` の `CAPTION_HEADER`）、全スライド左下（[lib/label.js](lib/label.js)）、リンク集ページ上部の3か所
- 商品リンクは `https://www.amazon.co.jp/dp/<ASIN>?tag=<トラッキングID>`（[lib/amazon.js](lib/amazon.js)）。商品データAPI（Creators API）は「直近30日で適格販売10件」を満たすまで使えない
- リンク集ページは [scripts/build-site.js](scripts/build-site.js) → `site/`（コミットしない）。`pages.yml` が GitHub Pages に公開。自動投稿後は `publish.yml` から呼ぶ（bot の push では push トリガーが動かないため）
- Instagram は画像を公開URLからしか受け取れないので、投稿時に Supabase Storage（公開バケット）へ上げてから渡す: [lib/storage.js](lib/storage.js)
- 公開の流れ（[lib/publisher.js](lib/publisher.js)）: 公開直前チェック（承認の指紋＝文章・商品リンク・画像・トラッキングIDが承認時と同じか）→「投稿中（publishing）」を push → 公開 →「投稿済み」を push。結果不明の `publishing` が残っていたら Instagram の最近の投稿と照合し、見つからなければ止まる（自動で再投稿しない）
- `scripts/images.js` の `--no-api` は minimist では `api: false` になる。`args.api !== false` で判定する
- トークン更新（[lib/token-refresh.js](lib/token-refresh.js)）は、新しいトークンを確かめられたときだけ保存する。Secret へのパイプは使わない
- `.env` はコミットしない。GitHub では Secrets に同じ値を入れる。リポジトリは GitHub Pages のために公開（キー類は入らない）
