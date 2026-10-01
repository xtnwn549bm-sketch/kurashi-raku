require('./helpers/env').setupTempEnv();

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const { samplePost, writePost } = require('./helpers/env');

const ROOT = path.resolve(__dirname, '..');
const runStatus = (args) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'status.js'), ...args], { cwd: ROOT, env: process.env, encoding: 'utf-8' });

const CODES = [
  'write_copy', 'generate_slides', 'pick_products', 'approve', 'reapprove',
  'wait_publish', 'resolve_unknown', 'replace_held_link', 'verify_checkpoints', 'nothing',
];

test('--json は人が読む文言不出しのJSONを出す', () => {
  const post = samplePost('30_json_ok');
  writePost(path.join(process.env.POSTS_DIR), post);
  const result = runStatus(['--json']);
  assert.equal(result.status, 0, result.stderr);

  const data = JSON.parse(result.stdout);
  assert.equal(data.schemaVersion, 1);
  assert.ok(Array.isArray(data.posts));
  assert.ok(Number.isInteger(data.readyStock));
  assert.equal(typeof data.autoPublishBlocked, 'boolean');
  // 人が読む行（合計の行など）が混ざっていない
  assert.doesNotMatch(result.stdout, /次にやること|投稿待ちの在庫/);
});

test('--json の nextAction.code は閉じじた集合で、approve / 商品登録 系は blockedBy: user', () => {
  writePost(process.env.POSTS_DIR, samplePost('31_json_written'));

  const publishing = samplePost('32_json_publishing', { status: 'publishing', publishAttempt: { id: 'x', startedAt: '2026-10-01T12:00:00.000Z', phase: 'publish-call' } });
  writePost(process.env.POSTS_DIR, publishing);

  const approved = samplePost('33_json_approved');
  writePost(process.env.POSTS_DIR, approved);
  assert.equal(runStatus(['--approve', approved.id]).status, 0);

  const data = JSON.parse(runStatus(['--json']).stdout);
  assert.ok(data.posts.length >= 3);
  for (const post of data.posts) {
    assert.ok(CODES.includes(post.nextAction.code), `${post.id}: 未知の code ${post.nextAction.code}`);
    assert.ok(['user', 'none'].includes(post.nextAction.blockedBy));
  }

  const byId = Object.fromEntries(data.posts.map((p) => [p.id, p]));
  // 商品リンクがそろうまで → 商品選定は人がやる
  assert.equal(byId['31_json_written'].nextAction.code, 'approve');
  assert.equal(byId['31_json_written'].nextAction.blockedBy, 'user');
  // 結果が不明な投稿の復旧は必ず人
  assert.equal(byId['32_json_publishing'].nextAction.code, 'resolve_unknown');
  assert.equal(byId['32_json_publishing'].nextAction.blockedBy, 'user');
  assert.deepEqual(data.publishingUnresolved, ['32_json_publishing']);
  assert.equal(data.autoPublishBlocked, true);
  // 承認済み → 待つだけ（人手は不要）
  assert.equal(byId['33_json_approved'].nextAction.code, 'wait_publish');
  assert.equal(byId['33_json_approved'].nextAction.blockedBy, 'none');
  assert.equal(byId['33_json_approved'].approval.approved, true);
  assert.equal(byId['33_json_approved'].approval.fingerprintMatch, true);
});

test('投稿済みのリンク保留は replace_held_link（人がやる）として出る', () => {
  const post = samplePost('34_json_held', { status: 'published', publishedAt: '2026-10-01T03:00:00.000Z' });
  post.products[2].asin = '';
  post.products[2].linkHold = { since: '2026-10-01', reason: '条件に合う商品を確認中' };
  writePost(process.env.POSTS_DIR, post);

  const data = JSON.parse(runStatus(['--json']).stdout);
  const found = data.posts.find((p) => p.id === '34_json_held');
  assert.equal(found.nextAction.code, 'replace_held_link');
  assert.equal(found.nextAction.blockedBy, 'user');
  assert.deepEqual(found.products.heldItems, ['03']);
  assert.match(found.nextAction.command, /--item 3/);
});

test('--json は --approve / --resolve と同時には指定しない', () => {
  const withApprove = runStatus(['--json', '--approve', '31_json_written']);
  assert.equal(withApprove.status, 1);
  assert.match(withApprove.stderr, /同時に指定しない/);

  const withResolve = runStatus(['--json', '--resolve', '31_json_written']);
  assert.equal(withResolve.status, 1);
  assert.match(withResolve.stderr, /同時に指定しない/);
});