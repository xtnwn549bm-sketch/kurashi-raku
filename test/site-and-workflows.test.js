require('./helpers/env').setupTempEnv();

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { SITE_COLORS, renderPage } = require('../lib/site');
const { samplePost } = require('./helpers/env');

/** WCAG 2.x のコントラスト比 */
function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, bl] = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('リンク集ページの文字色はどれも背景とのコントラスト比 4.5:1 以上', () => {
  const c = SITE_COLORS;
  const pairs = {
    'Amazonで見る ボタン（白文字 / テラコッタ）': [c['on-accent'], c.terracotta],
    '番号バッジ（白文字 / セージ）': [c['on-accent'], c.sage],
    'PR 表記・サブボタン（テラコッタ・セージ / カード）': [c.terracotta, c.card],
    'サブボタン（セージ / カード）': [c.sage, c.card],
    '補足文字（グレー / カード）': [c.sub, c.card],
    '補足文字（グレー / 背景）': [c.sub, c.bg],
    '準備中ボタン（グレー / 線色）': [c.sub, c.line],
    '本文（濃いグレー / 背景）': [c.text, c.bg],
  };
  for (const [label, [fg, bg]] of Object.entries(pairs)) {
    assert.ok(contrast(fg, bg) >= 4.5, `${label}: ${contrast(fg, bg).toFixed(2)}:1`);
  }
  // 修正前の組み合わせは基準を満たしていなかった
  assert.ok(contrast('#FFFFFF', '#D98B5F') < 4.5);
});

test('投稿済みで商品リンクを保留にした商品は、リンクを出さず「確認中」と表示する', () => {
  const post = samplePost('01_site', { status: 'published', publishedAt: '2026-10-01T03:36:37.056Z' });
  post.products[0].asin = '';
  post.products[0].linkHold = { since: '2026-10-01', reason: 'テスト' };
  const html = renderPage([post], new Set());

  assert.match(html, /条件に合う商品を確認中です/);
  assert.equal((html.match(/class="button" href=/g) || []).length, 4);
  assert.match(html, /dp\/B0TEST0002\?tag=testtag-22/);
  assert.match(html, /--terracotta: #A85A32;/);
});

const workflow = (name) => fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', name), 'utf-8');
const indexOrFail = (text, needle) => {
  const i = text.indexOf(needle);
  assert.ok(i >= 0, `ワークフローに「${needle}」がない`);
  return i;
};

test('自動投稿ワークフロー: 最新の main で判断し、「投稿中」を push してから公開する', () => {
  const yml = workflow('publish.yml');
  assert.match(yml, /ref: main/, '再実行でも最新の投稿状態を使う');
  const prepareAt = indexOrFail(yml, 'node scripts/publish.js --prepare');
  const pushAt = indexOrFail(yml, 'name: 投稿状態を push');
  const executeAt = indexOrFail(yml, 'node scripts/publish.js --execute');
  const recordAt = indexOrFail(yml, 'name: 投稿結果を push');
  assert.ok(prepareAt < pushAt && pushAt < executeAt && executeAt < recordAt, '準備 → push → 公開 → 記録 の順');
  assert.match(yml.slice(executeAt - 200, executeAt), /steps\.prepare\.outputs\.action == 'publish'/);
  assert.match(yml.slice(recordAt, recordAt + 300), /always\(\)/, '公開に失敗しても記録は残す');
});
