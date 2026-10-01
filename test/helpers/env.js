/**
 * テスト用の一時フォルダ（posts / content）を作り、lib/config.js がそちらを見るようにする
 *
 * 本物の .env（キー類）は読まない（SKIP_DOTENV=1）。lib を require する前に呼ぶこと
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

function setupTempEnv() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'amazon-ig-test-'));
  const postsDir = path.join(dir, 'posts');
  const contentDir = path.join(dir, 'content');
  fs.mkdirSync(postsDir, { recursive: true });
  fs.mkdirSync(contentDir, { recursive: true });
  fs.writeFileSync(path.join(contentDir, 'account.json'), JSON.stringify({
    name: 'test.account',
    handle: '@test.account',
    associateTag: 'testtag-22',
    siteUrl: '',
    storefrontUrl: '',
  }));

  process.env.SKIP_DOTENV = '1';
  process.env.POSTS_DIR = postsDir;
  process.env.CONTENT_DIR = contentDir;
  // 本物のキーが環境変数に入っていても使わない
  for (const name of ['OPENAI_API_KEY', 'IG_ACCESS_TOKEN', 'IG_USER_ID', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY']) {
    delete process.env[name];
  }
  return { dir, postsDir, contentDir };
}

/** 規約チェックを通る、文言がそろった投稿 */
function samplePost(id = '99_test', overrides = {}) {
  return {
    id,
    title: 'テスト用の収納アイテム5選',
    listName: 'テスト収納',
    angle: 'テスト用',
    status: 'written',
    priceRange: { min: 1000, max: 5000 },
    cover: { title: 'テスト用の\n収納アイテム5選', subtitle: '片付けがラクになる' },
    products: [1, 2, 3, 4, 5].map((n) => ({
      keyword: `テスト ${n}`,
      shortName: `テストアイテム${n}`,
      points: ['重ねて置ける', '中身が見える', '持ち手が付いている'],
      illustration: '一般的な形の収納ボックス',
      asin: `B0TEST000${n}`,
    })),
    cta: { headline: '保存して見返してね' },
    caption: '片付けが続かない人へ。\n\n選ぶときのチェックポイントつきで5つまとめたよ。',
    hashtags: ['#amazonで買えるもの', '#暮らしのアイデア', '#収納アイデア'],
    ...overrides,
  };
}

/** 投稿を一時フォルダに書く。slides: true ならダミーのスライドJPEGも置く */
function writePost(postsDir, post, { slides = true } = {}) {
  const dir = path.join(postsDir, post.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'post.json'), JSON.stringify(post, null, 2));
  if (slides) {
    for (let i = 1; i <= post.products.length + 2; i += 1) {
      fs.writeFileSync(path.join(dir, `slide${i}.jpg`), Buffer.from(`dummy slide ${i}`));
    }
  }
  return dir;
}

module.exports = { setupTempEnv, samplePost, writePost };
