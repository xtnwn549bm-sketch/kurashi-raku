/**
 * 投稿される文章（キャプションの最終形）を表示する。読むだけで、ファイルは書き換えない
 *
 * 1行目の #PR・AI表記、本文、アソシエイトの開示文、ハッシュタグをつなげた「Instagram にそのまま載る文章」を出す。
 * 商品ごとに「キャプションの行」と「スライドのチェックポイント」を並べるので、
 * 商品に合わせてチェックポイントを書き換えたあと、文章がずれていないかを承認前に見比べられる
 *
 * 使い方:
 *   npm run caption -- --post 02_koromogae
 *
 * 規約チェックに引っかかったら終了コード 1
 */

const minimist = require('minimist');
const { loadPost, buildCaption } = require('../lib/posts');
const { findViolations } = require('../lib/compliance');

const args = minimist(process.argv.slice(2), { string: ['post'] });
// Instagram のキャプションの上限
const INSTAGRAM_CAPTION_LIMIT = 2200;
const no = (i) => String(i + 1).padStart(2, '0');

if (!args.post) {
  console.error('--post <id> を指定して');
  process.exit(1);
}

const post = loadPost(args.post);
const caption = buildCaption(post);
const bodyLines = (post.caption || '').split('\n');

console.log(`${post.id}「${post.title}」（status: ${post.status}）`);
console.log('\n──── このまま投稿される文章 ────');
console.log(caption);
console.log('──────────────────────────');
console.log(`文字数: ${caption.length} / ${INSTAGRAM_CAPTION_LIMIT}（本文 ${(post.caption || '').length} 文字）`);

console.log('\n商品ごとの見比べ（キャプションの行 ↔ スライドのチェックポイント）');
post.products.forEach((p, i) => {
  const line = bodyLines.find((l) => l.startsWith(`${no(i)} `));
  console.log(`${no(i)} ${p.shortName}`);
  console.log(`   キャプション: ${line || '（この商品の行がない）'}`);
  console.log(`   チェックポイント: ${(p.points || []).join(' / ')}`);
});

const problems = findViolations(post);
console.log(problems.length === 0
  ? '\n規約チェック: OK'
  : `\n規約チェック: 直すところあり\n${problems.map((x) => `  - ${x}`).join('\n')}`);
if (post.status === 'ready') console.log(`※ 承認済み。文章を変えたら、もう一度 npm run status -- --approve ${post.id} が必要`);
if (post.status === 'published') console.log('※ 投稿済み。ここを変えても Instagram の投稿は変わらない（Instagram での編集は人がやる）');
process.exitCode = problems.length > 0 ? 1 : 0;
