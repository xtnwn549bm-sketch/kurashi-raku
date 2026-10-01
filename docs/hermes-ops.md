# 自動化（Hermes など）からの操作境界

このパイプラインは「人が決めて、仕組みが回す」設計。自動投稿は GitHub Actions が毎日 21:00 JST に行う。
自動化（Hermes / Claude Code など）が加わる場合も、**読む・説明する**役割に徹する。
商品選定・URL登録・承認・公開は、人が実行する操作。自動化は絶対に進めない。

Hermes 側の skill（プロファイル内 `skills/social-commerce/kurashi-raku/`）がこの境界を実装している。
CLAUDE.md の「自動化（Hermes）から触るときの操作境界」と同じ内容で、docs/operations.md が日常の運用手順。

## 自動で実行してよい操作

| # | 操作 | 条件・理由 |
|---|---|---|
| P1 | `npm run status` / `npm run status -- --json` | 読み取りのみ。外部副作用なし |
| P2 | `npm test` | 外部サービスに一切つながらない（実投稿・画像生成・Secret 更新をしない） |
| P3 | `npm run picks` | `docs/picks-checklist.md` の生成だけ。git 管理下のファイルなので消しても再生成できる |
| P4 | `npm run images -- --post <id> --no-api` | **status: written の投稿だけ**。イラストを生成しないので費用ゼロ。ready の再合成は承認の指紋を壊すので不可 |
| P5 | `npm run images -- --post <id> --prompts` | プロンプトの表示のみ。ファイルは作らない |
| P6 | `npm run build-posts -- --all` | 新規 draft の作成のみ。`--force` は既存投稿を壊すので不可 |
| P7 | `npm run check` | 外部への read-only 接続。トークンを更新しない |
| P8 | `git status` / `git log` / `git diff` | 読み取りのみ |
| P9 | `npm run caption -- --post <id>` | 投稿される文章の表示のみ。ファイルを書き換えず、外部にもつながらない |

## 人が実行する操作（自動化は実行しない）

| # | 操作 | なぜ自動化が実行してはいけないか |
|---|---|---|
| R1 | Amazon の商品選定 | 3つのチェックポイントを**満たすか人が確認する**。推測・補完・検索での自動埋め込みは禁止（[operations.md](operations.md)） |
| R2 | `npm run links -- --post <id> URL…` | R1 の続き。ASIN を `rejectedAsins` に登録済みの商品は `scripts/links.js` が弾く |
| R3 | `npm run status -- --approve <id>` | 承認の指紋（文章・商品リンク・画像・トラッキングIDの sha256）を作る。中身が変わると公開直前チェックで止まる |
| R4 | `npm run status -- --resolve <id> --published <URL>` / `--not-published` | 結果が不明な投稿の復旧。Instagram を目視で確かめてから決める必要があり、自動で再投稿しない |
| R5 | `npm run publish` / `publish:dry` / `--prepare` / `--execute` / `--dry-run` | コンテナ作成だけでも Instagram 側に触れる。`--dry-run` は公開しないがコンテナが 24 時間残るので安全ではない |
| R6 | Instagram への投稿・編集・削除・再投稿 | 投稿済みの投稿には触らない（差し替えはリンク集ページ側の運用） |
| R7 | `git commit` / `git push` | bot の push では push トリガーが動かない設計（`publish.yml` から `pages.yml` を呼ぶ）で、人が push する前提 |
| R8 | `npm run images -- --redo` / `npm run refresh-token` | OpenAI の課金 / GitHub Secret の書き込み |
| R9 | `.env` / Secrets / `content/account.json` / `lib/compliance.js` の編集 | 鍵・トラッキングID・規約ルール。緩めると公開される内容が壊れる |

## 判定の材料: `npm run status -- --json`

人が読む文言を正規表現で読ませない。`--json` の出力から判断する。

- `nextAction.code`: `write_copy` / `generate_slides` / `pick_products` / `approve` / `reapprove` / `wait_publish` / `resolve_unknown` / `replace_held_link` / `verify_checkpoints` / `nothing`
- `nextAction.blockedBy`: `user` なら人が実行する（R1〜R9 のいずれかに対応）／ `none` なら人手は不要
- `nextAction.command`: 人が実行するコマンドの型（placeholder 付き。Hermes はこれをそのまま提示する）
- `nextAction.text`: 人が読む説明（`npm run status` の出力と同じ文言）
- `problems.content` / `problems.publish`: `lib/checks.js` の判定結果
- `publishingUnresolved` / `autoPublishBlocked`: 結果が不明な投稿があればここに出る（自動投稿は止まる）
- `approval.fingerprintMatch`: 承認後に中身が変わっていないか

`--json` は `--approve` / `--resolve` と併用できない（exit 1）。別々に走らせる。
stdout に npm の見出し行が付くので、機械処理は `node scripts/status.js --json` を直接叩く。

## 人がやるときの依頼文の型

自動化は実行せず、次のように提示して止まる:

1. 実行するコマンドをそのままの形で出す
2. なぜ人の判断が必要か（R1〜R9 の番号）を1行で示す
3. 何が変わるか（どの post.json のどのフィールドが変わるか）を示す
4. 戻す方法（`git diff` など）を示す