/**
 * 投稿の進み具合と「次にやること」の一覧、承認、結果不明な投稿の解決
 *
 * 使い方:
 *   npm run status                                                   # 一覧と次にやること
 *   npm run status -- --approve 01_heyaboshi                         # チェックを通れば投稿待ち（ready）にする
 *   npm run status -- --resolve 01_heyaboshi --published <投稿URL>   # 結果不明（publishing）→ 投稿済みとして記録
 *   npm run status -- --resolve 01_heyaboshi --not-published         # 結果不明（publishing）→ 未投稿なので投稿待ちに戻す
 */

const fs = require('fs');
const minimist = require('minimist');
const { listPosts, loadPost, savePost, slidePath } = require('../lib/posts');
const { slideCount } = require('../lib/slides');
const { contentProblems, approvalFingerprint, publishProblems } = require('../lib/checks');
const { isValidAsin } = require('../lib/amazon');

const args = minimist(process.argv.slice(2), {
  string: ['approve', 'resolve', 'published'],
  boolean: ['not-published'],
});

const no = (i) => String(i + 1).padStart(2, '0');

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function approve(id) {
  const post = loadPost(id);
  if (post.status !== 'written' && post.status !== 'ready') {
    fail(`${post.id} は status: ${post.status}（written か ready のものだけ承認できる）`);
  }
  const problems = contentProblems(post);
  if (problems.length > 0) fail(`${post.id} はまだ投稿待ちにできない:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  post.status = 'ready';
  post.approval = { fingerprint: approvalFingerprint(post), approvedAt: new Date().toISOString() };
  delete post.lastPublishError;
  savePost(post);
  console.log(`✓ ${post.id} を投稿待ち（ready）にした。このあと文章・商品リンク・画像を変えたら、もう一度 --approve が必要`);
}

function resolve(id) {
  const post = loadPost(id);
  if (post.status !== 'publishing') fail(`${post.id} は status: ${post.status}（publishing のものだけ解決できる）`);
  if (args['not-published']) {
    post.status = 'ready';
    delete post.publishAttempt;
    savePost(post);
    console.log(`✓ ${post.id} を投稿待ち（ready）に戻した。次の自動投稿で公開される（承認後に中身が変わっていれば止まる）`);
    return;
  }
  const value = args.published;
  if (!value) fail('--published <投稿のURL> か --not-published を指定して');
  post.status = 'published';
  if (/^https:\/\/(www\.)?instagram\.com\//.test(value)) post.permalink = value;
  else if (/^\d+$/.test(value)) post.mediaId = value;
  else fail('--published には Instagram の投稿URL（https://www.instagram.com/p/...）かメディアIDを指定して');
  post.publishedAt = post.publishedAt || (post.publishAttempt && post.publishAttempt.startedAt) || new Date().toISOString();
  delete post.publishAttempt;
  savePost(post);
  console.log(`✓ ${post.id} を投稿済み（published）として記録した`);
}

/** 投稿ごとの「次にやること」 */
function nextAction(post) {
  if (post.status === 'draft') return '文言を書く（Claude に「draft の文言を書いて」と頼む）';
  if (post.status === 'publishing') {
    return '⚠ 投稿結果が不明。Instagram を確認して --resolve <id> --published <URL> か --not-published（docs/operations.md）';
  }
  if (post.status === 'published') {
    const notes = [];
    const held = post.products.map((p, i) => (isValidAsin(p.asin) ? null : i + 1)).filter(Boolean);
    if (held.length > 0) {
      notes.push(`リンク保留 ${held.map((n) => no(n - 1)).join(', ')}：条件を満たす商品を確認して npm run links -- --post ${post.id} --item ${held[0]} <URL>`);
    }
    const unchecked = post.products
      .map((p, i) => (p.review && ['unverified', 'partial'].includes(p.review.result) ? no(i) : null)).filter(Boolean);
    if (unchecked.length > 0) notes.push(`チェックポイントを確認しきれていない商品 ${unchecked.join(', ')}（post.json の review を見て、Amazon の商品ページで確認）`);
    return notes.join('\n           → ');
  }
  if (post.status === 'ready') {
    const problems = publishProblems(post);
    return problems.length > 0 ? `⚠ このままだと公開されない: ${problems[0]}` : '投稿待ち（自動投稿で順番に公開される）';
  }
  // written
  const missingSlides = Array.from({ length: slideCount(post) }, (_, i) => i).filter((i) => !fs.existsSync(slidePath(post.id, i)));
  if (missingSlides.length > 0) return `スライドを作る: npm run images -- --post ${post.id}`;
  const noLink = post.products.filter((p) => !isValidAsin(p.asin)).length;
  if (noLink > 0) return `商品を選んでURLを登録（あと${noLink}個）: docs/picks-checklist.md → npm run links -- --post ${post.id} URL…`;
  return `確認して承認: npm run status -- --approve ${post.id}`;
}

if (args.approve) {
  approve(args.approve);
  process.exit(0);
}
if (args.resolve) {
  resolve(args.resolve);
  process.exit(0);
}

const posts = listPosts();
const counts = {};
for (const post of posts) {
  counts[post.status] = (counts[post.status] || 0) + 1;
  const linked = post.products.filter((p) => isValidAsin(p.asin)).length;
  const extra = post.status === 'published' ? ` ${post.permalink || post.mediaId || ''}` : '';
  console.log(`${post.status.padEnd(10)} 商品${linked}/${post.products.length} ${post.id} ${post.title}${extra}`);
  const action = nextAction(post);
  if (action) console.log(`           → ${action}`);
}
console.log(`\n合計${posts.length}本: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
const readyCount = posts.filter((p) => p.status === 'ready' && publishProblems(p).length === 0).length;
console.log(`投稿待ちの在庫: ${readyCount}日ぶん${readyCount < 3 ? ' ← そろそろ次の投稿の商品を選ぼう' : ''}`);
if (counts.publishing) console.log('⚠ 投稿結果が不明な投稿がある。解決するまで自動投稿は止まる（docs/operations.md）');
