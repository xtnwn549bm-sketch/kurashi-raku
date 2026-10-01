const { setupTempEnv, samplePost, writePost } = require('./helpers/env');

const env = setupTempEnv();

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const sharp = require('sharp');
const { buildPostImages } = require('../lib/image-pipeline');

const ROOT = path.resolve(__dirname, '..');
const BLOCK_FETCH = path.join(__dirname, 'helpers', 'block-fetch.js');

function runImages(args) {
  const fetchLog = path.join(env.dir, `fetch-${Date.now()}-${Math.random().toString(16).slice(2)}.log`);
  const result = spawnSync(process.execPath, ['--require', BLOCK_FETCH, path.join(ROOT, 'scripts', 'images.js'), ...args], {
    cwd: ROOT,
    env: { ...process.env, FETCH_LOG: fetchLog, OPENAI_API_KEY: '' },
    encoding: 'utf-8',
  });
  return { ...result, fetched: fs.existsSync(fetchLog) ? fs.readFileSync(fetchLog, 'utf-8') : '' };
}

test('--no-api でイラストがなければ API を呼ばずにエラーで終わる', () => {
  const post = samplePost('11_no_illust');
  writePost(env.postsDir, post, { slides: false });

  const result = runImages(['--post', post.id, '--no-api']);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /イラストがないので合成できない/);
  assert.match(result.stderr, /cover\.png/);
  assert.equal(result.fetched, '', `通信してはいけない: ${result.fetched}`);
  assert.equal(fs.existsSync(path.join(env.postsDir, post.id, 'slide1.jpg')), false);
});

test('--no-api でイラストがそろっていれば、通信せずにスライドだけ合成する', async () => {
  const post = samplePost('12_with_illust');
  const dir = writePost(env.postsDir, post, { slides: false });
  fs.mkdirSync(path.join(dir, 'illust'));
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#E6EDE3' } }).png().toBuffer();
  for (const key of ['cover', 'item1', 'item2', 'item3', 'item4', 'item5']) fs.writeFileSync(path.join(dir, 'illust', `${key}.png`), png);

  const result = runImages(['--post', post.id, '--no-api']);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.fetched, '');
  for (let i = 1; i <= 7; i += 1) assert.ok(fs.existsSync(path.join(dir, `slide${i}.jpg`)), `slide${i}.jpg`);
});

test('useApi: false のとき生成関数は一度も呼ばれない（--redo も拒否）', async () => {
  const post = samplePost('13_unit');
  writePost(env.postsDir, post, { slides: false });
  let called = 0;
  const generate = async () => {
    called += 1;
    throw new Error('呼ばれてはいけない');
  };

  const missing = await buildPostImages(post, { useApi: false, generate });
  assert.equal(missing.ok, false);
  assert.equal(missing.missingIllustrations.length, 6);

  const redo = await buildPostImages(post, { useApi: false, redo: new Set(['item1']), generate });
  assert.equal(redo.ok, false);
  assert.match(redo.error, /--redo/);
  assert.equal(called, 0);
});
