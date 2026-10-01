require('./helpers/env').setupTempEnv();

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveAsin, isAmazonJpHost, productLink } = require('../lib/amazon');

/** 短縮URLの転送先を返す偽の fetch。呼ばれたURLを記録する */
function fakeRedirect(location) {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(String(url));
    return { status: 301, headers: { get: (name) => (name.toLowerCase() === 'location' ? location : null) } };
  };
  return { fetchFn, calls };
}

const noNetwork = async () => {
  throw new Error('ネットワークを使ってはいけない');
};

test('amazon.co.jp の https 商品URLから ASIN を取り出せる', async () => {
  assert.equal(await resolveAsin('https://www.amazon.co.jp/%E5%95%86%E5%93%81/dp/B0TEST0001/ref=sr_1_1', { fetch: noNetwork }), 'B0TEST0001');
  assert.equal(await resolveAsin('https://amazon.co.jp/gp/product/B0TEST0002', { fetch: noNetwork }), 'B0TEST0002');
  assert.equal(await resolveAsin('b0test0003', { fetch: noNetwork }), 'B0TEST0003');
});

test('https 以外の URL は拒否する', async () => {
  await assert.rejects(resolveAsin('ftp://www.amazon.co.jp/dp/B0TEST0001', { fetch: noNetwork }), /https/);
  await assert.rejects(resolveAsin('http://www.amazon.co.jp/dp/B0TEST0001', { fetch: noNetwork }), /https/);
  await assert.rejects(resolveAsin('http://amzn.asia/d/abc', { fetch: noNetwork }), /https/);
});

test('amazon.co.jp と正規のサブドメイン以外は拒否する', async () => {
  await assert.rejects(resolveAsin('https://notamazon.co.jp/dp/B0TEST0001', { fetch: noNetwork }), /Amazon のURLじゃない/);
  await assert.rejects(resolveAsin('https://www.amazon.co.jp.evil.example/dp/B0TEST0001', { fetch: noNetwork }), /対象外|Amazon のURLじゃない/);
  await assert.rejects(resolveAsin('https://www.amazon.com/dp/B0TEST0001', { fetch: noNetwork }), /amazon.co.jp 以外/);
  assert.equal(isAmazonJpHost('www.amazon.co.jp'), true);
  assert.equal(isAmazonJpHost('amazon.co.jp'), true);
  assert.equal(isAmazonJpHost('notamazon.co.jp'), false);
  assert.equal(isAmazonJpHost('amazon.co.jp.evil.example'), false);
});

test('正規の短縮URLは転送先をたどって ASIN を取り出せる', async () => {
  const { fetchFn, calls } = fakeRedirect('https://www.amazon.co.jp/dp/B0TEST0004?ref=share');
  assert.equal(await resolveAsin('https://amzn.asia/d/abcdefg', { fetch: fetchFn }), 'B0TEST0004');
  assert.deepEqual(calls, ['https://amzn.asia/d/abcdefg']);
});

test('短縮URLの転送先が https でない・正規ホストでないなら拒否する', async () => {
  await assert.rejects(resolveAsin('https://amzn.to/xyz', { fetch: fakeRedirect('http://www.amazon.co.jp/dp/B0TEST0005').fetchFn }), /https/);
  await assert.rejects(resolveAsin('https://a.co/d/xyz', { fetch: fakeRedirect('https://notamazon.co.jp/dp/B0TEST0005').fetchFn }), /Amazon のURLじゃない/);
});

test('商品リンクはトラッキングID付き、ASIN がおかしければ作らない', () => {
  assert.equal(productLink('B0TEST0001'), 'https://www.amazon.co.jp/dp/B0TEST0001?tag=testtag-22');
  assert.throws(() => productLink(''), /ASIN/);
  assert.throws(() => productLink('B0TEST0001/../x'), /ASIN/);
});
