const { setupTempEnv, samplePost, writePost } = require('./helpers/env');

const env = setupTempEnv();

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadPost, savePost } = require('../lib/posts');
const { approvalFingerprint } = require('../lib/checks');

const ROOT = path.resolve(__dirname, '..');
const runStatus = (args) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'status.js'), ...args], { cwd: ROOT, env: process.env, encoding: 'utf-8' });

test('承認すると指紋が保存され、商品リンクが欠けていれば承認しない', () => {
  const ok = samplePost('21_approve');
  writePost(env.postsDir, ok);
  const approved = runStatus(['--approve', ok.id]);
  assert.equal(approved.status, 0, approved.stderr);
  const saved = loadPost(ok.id);
  assert.equal(saved.status, 'ready');
  assert.equal(saved.approval.fingerprint, approvalFingerprint(saved));

  const missing = samplePost('22_missing');
  missing.products[1].asin = '';
  writePost(env.postsDir, missing);
  const rejected = runStatus(['--approve', missing.id]);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /商品URLが未登録/);
  assert.equal(loadPost(missing.id).status, 'written');
});

test('結果不明の投稿は、確認結果に合わせて投稿済み / 投稿待ちに解決できる', () => {
  for (const id of ['23_resolved_pub', '24_resolved_not']) {
    const post = samplePost(id, { status: 'publishing', publishAttempt: { id: 'a', startedAt: '2026-10-01T12:00:00.000Z', phase: 'publish-call' } });
    writePost(env.postsDir, post);
  }
  const published = runStatus(['--resolve', '23_resolved_pub', '--published', 'https://www.instagram.com/p/ABC/']);
  assert.equal(published.status, 0, published.stderr);
  const a = loadPost('23_resolved_pub');
  assert.equal(a.status, 'published');
  assert.equal(a.permalink, 'https://www.instagram.com/p/ABC/');
  assert.equal(a.publishAttempt, undefined);

  const notPublished = runStatus(['--resolve', '24_resolved_not', '--not-published']);
  assert.equal(notPublished.status, 0, notPublished.stderr);
  assert.equal(loadPost('24_resolved_not').status, 'ready');

  const wrong = runStatus(['--resolve', '21_approve', '--not-published']);
  assert.equal(wrong.status, 1, 'publishing 以外は解決できない');
});

test('一覧に「次にやること」と、結果不明の警告が出る', () => {
  const stuck = samplePost('25_stuck', { status: 'publishing', publishAttempt: { id: 'b', startedAt: '2026-10-01T12:00:00.000Z' } });
  writePost(env.postsDir, stuck);
  const noLinks = samplePost('26_nolinks');
  noLinks.products.forEach((p) => { p.asin = ''; });
  writePost(env.postsDir, noLinks);
  const changed = loadPost('21_approve');
  changed.caption = `${changed.caption}\n変更`;
  savePost(changed);

  const result = runStatus([]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /投稿結果が不明/);
  assert.match(result.stdout, /商品を選んでURLを登録（あと5個）/);
  assert.match(result.stdout, /承認後に/);
});
