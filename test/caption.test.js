const { setupTempEnv, samplePost, writePost } = require('./helpers/env');

const env = setupTempEnv();

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { CAPTION_HEADER, buildCaption } = require('../lib/posts');

const ROOT = path.resolve(__dirname, '..');
const runCaption = (args) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'caption.js'), ...args], { cwd: ROOT, env: process.env, encoding: 'utf-8' });

test('投稿される文章の最終形と、商品ごとのキャプションの行・チェックポイントを並べて出す（ファイルは変えない）', () => {
  const post = samplePost('31_caption', {
    caption: '片付けが続かない人へ。\n\n01 テストアイテム1 … 中身が見える\n03 テストアイテム3 … 重ねて置ける',
  });
  const file = path.join(writePost(env.postsDir, post), 'post.json');
  const before = fs.readFileSync(file, 'utf-8');

  const result = runCaption(['--post', post.id]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(CAPTION_HEADER), '1行目の #PR・AI表記');
  assert.match(result.stdout, /Amazonのアソシエイトとして、test\.accountは適格販売により収入を得ています/);
  assert.match(result.stdout, /#amazonで買えるもの #暮らしのアイデア #収納アイデア/);
  assert.match(result.stdout, /キャプション: 01 テストアイテム1 … 中身が見える/);
  assert.match(result.stdout, /02 テストアイテム2\n {3}キャプション: （この商品の行がない）/);
  assert.match(result.stdout, /チェックポイント: 重ねて置ける \/ 中身が見える \/ 持ち手が付いている/);
  assert.match(result.stdout, /規約チェック: OK/);
  assert.equal(fs.readFileSync(file, 'utf-8'), before);
});

test('規約に引っかかる文章なら、どこを直すかを出して終了コード 1', () => {
  const post = samplePost('32_caption_ng', { caption: '今だけ最安！使ってみたら最高だった' });
  writePost(env.postsDir, post);
  const result = runCaption(['--post', post.id]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /規約チェック: 直すところあり/);
  assert.match(result.stdout, /caption: 「最安」/);
});

const accountPath = path.join(env.contentDir, 'account.json');
const setSiteUrl = (siteUrl) => {
  const account = JSON.parse(fs.readFileSync(accountPath, 'utf-8'));
  fs.writeFileSync(accountPath, JSON.stringify({ ...account, siteUrl }));
};

test('キャプションに本文のあと・開示文の前でリンク集のURLが入る', () => {
  setSiteUrl('https://www.example.com/');
  const caption = buildCaption(samplePost());
  assert.ok(caption.startsWith(CAPTION_HEADER), '1行目は #PR・AI表記のまま');
  const link = caption.indexOf('🔗 リンク集 https://www.example.com/');
  assert.ok(link > caption.indexOf('5つまとめたよ'), '本文のあと');
  assert.ok(link < caption.indexOf('Amazonのアソシエイトとして'), '開示文の前');
});

test('siteUrl が空ならリンク集の行は付けない', () => {
  setSiteUrl('');
  assert.doesNotMatch(buildCaption(samplePost()), /リンク集/);
});
