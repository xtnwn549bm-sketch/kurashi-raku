/**
 * 投稿の進み具合の一覧表示と、投稿待ち（ready）への承認
 *
 * 使い方:
 *   npm run status
 *   npm run status -- --approve 01_heyaboshi
 */

const fs = require('fs');
const minimist = require('minimist');
const { listPosts, loadPost, savePost, slidePath } = require('../lib/posts');
const { buildSlides, missingTextFields } = require('../lib/prompts');
const { findViolations } = require('../lib/compliance');

const args = minimist(process.argv.slice(2), { string: ['approve'] });

/** 投稿待ちにしていいかのチェック。問題点の一覧を返す */
function problemsBeforeReady(post) {
  const problems = [];
  if (post.status !== 'written') problems.push(`status が written じゃない（今: ${post.status}）`);
  if (!post.caption.trim()) problems.push('キャプションの本文が空');
  problems.push(...missingTextFields(post).map((m) => `文言が足りない: ${m}`));
  problems.push(...findViolations(post));
  const slideCount = buildSlides(post).length;
  for (let i = 0; i < slideCount; i += 1) {
    if (!fs.existsSync(slidePath(post.id, i))) problems.push(`slide${i + 1}.jpg がない`);
  }
  if (!post.storefrontDone) problems.push('ストアフロントのアイデアリスト登録が終わってない（storefrontDone: true にする）');
  return problems;
}

if (args.approve) {
  const post = loadPost(args.approve);
  const problems = problemsBeforeReady(post);
  if (problems.length > 0) {
    console.error(`✗ ${post.id} はまだ投稿待ちにできない:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  post.status = 'ready';
  savePost(post);
  console.log(`✓ ${post.id} を投稿待ち（ready）にした`);
  process.exit(0);
}

const posts = listPosts();
const counts = {};
for (const post of posts) {
  counts[post.status] = (counts[post.status] || 0) + 1;
  const extra = post.status === 'published' ? ` ${post.publishedAt} ${post.permalink || ''}` : '';
  console.log(`${post.status.padEnd(9)} ${post.storefrontDone ? 'リスト済' : 'リスト未'} ${post.id} ${post.title}${extra}`);
}
console.log(`\n合計${posts.length}本: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
const readyCount = counts.ready || 0;
console.log(`投稿待ちの在庫: ${readyCount}日ぶん${readyCount < 3 ? ' ← そろそろ次の投稿を作ろう' : ''}`);
