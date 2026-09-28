# Amazonアソシエイト × Instagram 収益化パイプライン

暮らし・家事・収納ジャンルの「選ぶときのチェックポイント」図解カルーセルを Gemini で作り、Instagram Graph API で毎日自動投稿する。
導線は「インスタ投稿 → プロフのリンク（Amazonストアフロント）→ 同名のアイデアリスト → 購入」。

- 手作業のセットアップ: [docs/setup-guide.md](docs/setup-guide.md)
- 投稿の型・キャプション・守るルール: [docs/content-strategy.md](docs/content-strategy.md)
- アカウント設計: [docs/account-profile.md](docs/account-profile.md)

## 投稿を作る流れ

```
npm run build-posts -- --all        # themes.json → posts/<id>/post.json（status: draft、商品スロットだけ）
（Claude が文言を書く → status: written）
npm run images -- --all             # スライド画像 slide1〜7.jpg を生成（下端に「PR｜AIにより作成」とアカウント名を焼き込み）
（画像を目視チェック。文字化け・誤字は --post <id> --slide <n> で作り直し）
npm run storefront                  # アイデアリスト登録チェックリスト → ユーザーが手で登録 → storefrontDone: true
npm run status -- --approve <id>    # 規約チェックを通れば status: ready（投稿待ち）
git push                            # GitHub Actions が毎日21時に ready の先頭1本を投稿
```

## Claude が post.json の文言を書くときのルール

draft の post.json を開き、以下を埋めて `status` を `"written"` にする。

- `products[].shortName`: アイテムの種類名。**12文字以内**、ブランド名・型番は入れない（例: 「伸縮できる室内物干し」）
- `products[].points`: 「選ぶときのチェックポイント」を **ちょうど3つ、各14文字以内**
  - ユーザーはこの3つを**全部満たす商品**を Amazon で選んでリストに入れる。だから「探せば普通に見つかる具体的な条件」にする（例: 「使わない日は薄くたためる」「幅を伸縮して調整できる」）
  - 特定商品の性能・使用感・価格・評価は書かない
- `products[].illustration`: 中央に描くイラストの説明。**一般的な形状で**書く（特定メーカー製品に似せない）
- `cover.title`（themes.json のまま or 調整）/ `cover.subtitle`: 悩みが伝わる一言（16文字以内）
- `cta.headline`: まとめスライドの大見出し（12文字以内）
- `caption`: [content-strategy.md](docs/content-strategy.md) のテンプレどおりの **本文だけ**。`#PR`・AI表記・アソシエイト開示文・ハッシュタグは自動で付くので書かない
- `hashtags`: 5個まで（固定 `#amazonで買えるもの` `#暮らしのアイデア` ＋テーマ別3個）

禁止（`lib/compliance.js` が自動で止める）: 価格・送料、★・評価の数字・レビュー件数・順位、「最安」「No.1」「必ず」などの断定、「使ってみた」「購入品」などの体験談、「Amazon公式」「Amazonおすすめ」、配送条件。Amazonの商品画像は使わない。

## 実装メモ
- 商品データAPIはまだ使っていない。Creators API（PA-API 5 の後継）は「直近30日で適格販売10件」が条件。満たしたら `lib/amazon.js` を追加して候補の自動提案を入れる（仕様はその時点の公式ドキュメントで確認）
- Amazon の AI 利用表記（2026/4/20〜）: キャプション1行目（`lib/posts.js` の `CAPTION_HEADER`）と全スライド左下（[lib/label.js](lib/label.js)）の2か所
- Instagram は画像を公開URLからしか受け取れないので、投稿時に Supabase Storage（公開バケット）へ上げてから渡す: [lib/storage.js](lib/storage.js)
- 画像生成は隣の `ai-channnel-infographic-test` の image-gen スキルを関数化したもの: [lib/image_gen.js](lib/image_gen.js)
- ラベルの焼き込みは sharp の text 入力（Pango）。Windows は `BIZ-UDGothicB.ttc` などを使う。生成済みPNGから焼き直すなら `npm run images -- --all --relabel`
- `.env` はコミットしない。GitHub では Secrets に同じ値を入れる
