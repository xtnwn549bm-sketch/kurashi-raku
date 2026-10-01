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
    'PR 表記（テラコッタ / 紙）': [c.terracotta, c.sheet],
    'リスト名・サブボタン・リンク（セージ / 紙）': [c.sage, c.sheet],
    'ページ名・サブボタン（セージ / 地）': [c.sage, c.bg],
    '補足文字・準備中ボタン（グレー / 紙）': [c.sub, c.sheet],
    '開示文（グレー / 地）': [c.sub, c.bg],
    '本文（濃い色 / 紙）': [c.text, c.sheet],
    '本文・表紙の名前（濃い色 / 地）': [c.text, c.bg],
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

test('表紙の一覧は新しい9件を並べ、それより前は「前の投稿も表示」の中に入れる', () => {
  const posts = Array.from({ length: 11 }, (_, i) => samplePost(`${String(11 - i).padStart(2, '0')}_site`, { status: 'published' }));
  const html = renderPage(posts, new Set(['11_site']));
  const [shown, older] = html.split('<details>');

  assert.equal((shown.match(/<li><a href="#\d\d_site">/g) || []).length, 9);
  assert.match(older, /前の投稿も表示（2件）/);
  assert.match(older, /href="#02_site"/);
  assert.match(older, /href="#01_site"/);
  assert.match(shown, /<img src="covers\/11_site\.jpg"/, '表紙があればその画像を使う');
  // まとめは表紙の数にかかわらず全部載る。見出しはキャプションで案内している『リスト名』
  assert.equal((html.match(/<section class="list"/g) || []).length, 11);
  assert.match(html, /『テスト収納』/);
});

test('公開中の投稿がないときは、表紙の一覧を出さずに次に何が起きるかを書く', () => {
  const html = renderPage([], new Set());
  assert.doesNotMatch(html, /class="covers"/);
  assert.match(html, /公開中のまとめはまだありません/);
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
