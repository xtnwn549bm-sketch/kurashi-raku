# 運用手順（毎日・困ったとき）

まず `npm run status` を見る。投稿ごとに「→ 次にやること」が出る。

## 投稿の状態

| status | 意味 | 次にやること |
|---|---|---|
| `draft` | 文言がまだ | Claude に文言を書いてもらう |
| `written` | 文言とスライドができた | 商品を選んでURLを登録 → 承認 |
| `ready` | 承認済み・投稿待ち | 何もしない（毎日21時に1本ずつ公開） |
| `publishing` | 公開の途中で止まった（結果が不明） | 下の「投稿結果が不明」を見る |
| `published` | 投稿済み | リンク保留があれば代わりの商品を探す |

## 投稿を増やす（written → ready）

1. [picks-checklist.md](picks-checklist.md)（`npm run picks` で更新）を見て、チェックポイントを**3つとも満たす**商品を Amazon で選ぶ
   - 満たすか分からない商品は登録しない。商品ページやメーカーの仕様で確かめる
2. 商品ページのURLを登録: `npm run links -- --post <id> URL1 URL2 URL3 URL4 URL5`
3. 承認: `npm run status -- --approve <id>` → `git push`

**承認したあとに文章・商品リンク・画像・トラッキングIDを変えたら、もう一度 `--approve` が必要。** 承認時の内容と違うまま公開されることはない（公開直前に自動で止まる）。

## 投稿済みの商品が条件に合わなかったとき

Instagram の投稿は編集・再投稿しない。リンク集ページ側で対応する。

- 条件に合わないと分かった商品は、post.json でリンクを外して `rejectedAsins` に記録する（同じ商品をうっかり登録し直せなくなる）。リンク集ページには「条件に合う商品を確認中です」と出る
- 条件を満たす商品が見つかったら: `npm run links -- --post <id> --item <番号> <URL>` → `git push`

## 投稿結果が不明（status: publishing）

公開の途中でエラーや通信切れがあると、投稿されたか分からないまま `publishing` で残る。
次の自動投稿は、まず Instagram の最近の投稿とキャプションを照合する。

- 見つかった → 自動で「投稿済み」として記録する（再投稿しない）
- 見つからない → **自動投稿を止めて** GitHub Actions が赤くなる。Instagram を見て、どちらかを実行して `git push`:
  - 投稿されていた: `npm run status -- --resolve <id> --published https://www.instagram.com/p/...`
  - 投稿されていない: `npm run status -- --resolve <id> --not-published`（次の21時に公開される）

GitHub Actions を再実行（Re-run）しても、最新の main の記録で判断するので二重投稿にはならない。

## トークンの自動更新が失敗したとき

更新に失敗しても、GitHub の `IG_ACCESS_TOKEN` は空にならない（新しいトークンを確かめられたときだけ書き換える）。
Actions の「Instagramトークン更新」が赤なら、ログを見て原因を直し、手動で「Run workflow」。
トークンの期限（60日）が切れていたら [setup-guide.md](setup-guide.md) の手順5で作り直して Secret を登録し直す。

## 画像を作り直す

- 文言を直しただけ: `npm run images -- --post <id> --no-api`（イラストは作らない・料金なし。イラストがなければエラーで止まる）
- イラストも作り直す: `npm run images -- --post <id> --redo item3`（OpenAI の料金がかかる）

## テスト

コードを変えたら `npm test`。外部サービスには一切つながない（実投稿・画像生成・Secret 更新はしない）。
