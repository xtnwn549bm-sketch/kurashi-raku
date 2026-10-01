/**
 * プロフィールのリンク先になる「リンク集ページ」（site/index.html）を作る
 *
 * 投稿済み（published）の投稿を新しい順に、投稿と同じ見出し（listName）＋アイテムごとの「Amazonで見る」ボタンで並べる。
 * GitHub Actions（.github/workflows/pages.yml）が GitHub Pages に公開する。
 * 価格・星評価は載せない（Amazonの規約）。AI表記・PR表記・アソシエイト開示文はページ上部に入れる
 *
 * 使い方:
 *   node scripts/build-site.js             # 投稿済みだけ（本番と同じ）
 *   node scripts/build-site.js --preview   # まだ投稿してないものも入れて、見た目を確認する用
 */

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const sharp = require('sharp');
const { ROOT } = require('../lib/config');
const { listPosts, slidePath } = require('../lib/posts');
const { renderPage } = require('../lib/site');

const args = minimist(process.argv.slice(2), { boolean: ['preview'] });
const SITE_DIR = path.join(ROOT, 'site');

(async () => {
  const statuses = args.preview ? ['published', 'ready', 'written'] : ['published'];
  const posts = listPosts()
    .filter((p) => statuses.includes(p.status))
    .sort((a, b) => (b.publishedAt || b.id).localeCompare(a.publishedAt || a.id));

  fs.rmSync(SITE_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(SITE_DIR, 'covers'), { recursive: true });

  const covers = new Set();
  for (const post of posts) {
    const cover = slidePath(post.id, 0);
    if (!fs.existsSync(cover)) continue;
    await sharp(cover).resize(480, 600).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(SITE_DIR, 'covers', `${post.id}.jpg`));
    covers.add(post.id);
  }

  fs.writeFileSync(path.join(SITE_DIR, 'index.html'), renderPage(posts, covers), 'utf-8');
  // GitHub Pages の Jekyll 処理を止める
  fs.writeFileSync(path.join(SITE_DIR, '.nojekyll'), '');
  console.log(`保存: site/index.html（${posts.length}投稿${args.preview ? '・プレビュー' : ''}）`);
})().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
