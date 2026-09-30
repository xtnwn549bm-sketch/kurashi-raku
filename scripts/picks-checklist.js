/**
 * 商品選びのチェックリスト（docs/picks-checklist.md）を作る
 *
 * スライドには「選ぶときのチェックポイント」しか書いていないので、3つとも満たす商品を選べばスライドと食い違わない。
 * 選んだら npm run links で商品URLを登録する（リンク集ページのボタンになる）
 *
 * 使い方: npm run picks
 */

const fs = require('fs');
const path = require('path');
const { ROOT } = require('../lib/config');
const { listPosts } = require('../lib/posts');

const pending = listPosts().filter((p) => p.status !== 'published' && p.products.some((item) => !item.asin));
const posts = pending.filter((p) => p.status !== 'draft');
const drafts = pending.filter((p) => p.status === 'draft');

const yen = (n) => `${Number(n).toLocaleString('ja-JP')}円`;

const lines = [
  '# 商品選びチェックリスト',
  '',
  `生成日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
  '',
  '## やり方',
  '1. 各アイテムの「Amazonで探す」を開いて、チェックポイントを**3つとも満たす**商品を1つ選ぶ',
  '2. 商品ページのURLをコピー（スマホアプリなら「共有」→「リンクをコピー」でOK）',
  '3. 5つそろったら、下のコマンドの URL1〜URL5 を置き換えて実行（または Claude に「01の商品URLこれ」と貼って頼む）',
  '',
  '## 商品の選び方（投稿には書かない。選ぶときの基準）',
  '- 評価が高く、レビューの数も多いもの（目安: ★4.0以上・レビュー数百件以上）',
  '- 「スポンサー」表示の広告枠ではなく、ふつうの検索結果から選ぶ',
  '- 販売元が Amazon かメーカー公式、または評価の高い出品者',
  '- 価格はテーマの目安の範囲内',
  '- 自分で買ってもこちらの紹介料にはならないので、動作確認のための購入はしない',
  '',
];

for (const post of posts) {
  const range = post.priceRange ? `${yen(post.priceRange.min)}〜${yen(post.priceRange.max)}` : '指定なし';
  lines.push(`## ${post.id}「${post.title}」（status: ${post.status}）`, '', `- 価格の目安: ${range}`, '');
  post.products.forEach((p, i) => {
    lines.push(
      `- [${p.asin ? 'x' : ' '}] ${String(i + 1).padStart(2, '0')} ${p.shortName || p.keyword}${p.asin ? `（登録済み: ${p.asin}）` : ''}`,
      `  - チェックポイント: ${(p.points || []).join(' ／ ') || '（未作成）'}`,
      `  - Amazonで探す: https://www.amazon.co.jp/s?k=${encodeURIComponent(p.keyword)}`,
    );
  });
  lines.push('', '```', `npm run links -- --post ${post.id} URL1 URL2 URL3 URL4 URL5`, '```', '');
}

if (drafts.length > 0) {
  lines.push(`> 文言がまだの下書き（${drafts.map((p) => p.id).join(', ')}）はチェックポイントが決まってないので載せてない`, '');
}

const outPath = path.join(ROOT, 'docs', 'picks-checklist.md');
fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
console.log(`保存: docs/picks-checklist.md（${posts.length}投稿ぶん${drafts.length ? ` / 下書き${drafts.length}本は対象外` : ''}）`);
