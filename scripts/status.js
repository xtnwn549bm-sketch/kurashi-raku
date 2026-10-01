/**
 * 投稿の進み具合と「次にやること」の一覧、承認、結果不明な投稿の解決
 *
 * 使い方:
 *   npm run status                                                   # 一覧と次にやること
 *   npm run status -- --json                                         # 同じ情報をJSONで（人が読む文言は出さない）
 *   npm run status -- --approve 01_heyaboshi                         # チェックを通れば投稿待ち（ready）にする
 *   npm run status -- --resolve 01_heyaboshi --published <投稿URL>   # 結果不明（publishing）→ 投稿済みとして記録
 *   npm run status -- --resolve 01_heyaboshi --not-published         # 結果不明（publishing）→ 未投稿なので投稿待ちに戻す
 */

const minimist = require('minimist');
const { listPosts, loadPost, savePost } = require('../lib/posts');
const { contentProblems, approvalFingerprint, publishProblems } = require('../lib/checks');
const { isValidAsin } = require('../lib/amazon');
const { nextAction, buildReport } = require('../lib/status-report');

const args = minimist(process.argv.slice(2), {
  string: ['approve', 'resolve', 'published'],
  boolean: ['not-published', 'json'],
});

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

/** 投稿ごとの「次にやること」は lib/status-report.js（--json と同じ判定を共有） */

if (args.json) {
  // 読むだけの出力。承認・解決とは併用できない（片方を誤って実行するのを防ぐ）
  if (args.approve || args.resolve) fail('--json は --approve / --resolve とは同時に指定しない');
  console.log(JSON.stringify(buildReport(listPosts()), null, 2));
  process.exit(0);
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
