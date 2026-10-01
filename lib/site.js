/**
 * リンク集ページの HTML（scripts/build-site.js から使う）
 *
 * 文字色と背景色は WCAG のコントラスト比 4.5:1 以上（通常サイズの文字）になる組み合わせだけを使う。
 * 色を変えるときは test/site.test.js のコントラストのテストも通ること
 */

const { loadAccount } = require('./config');
const { associateDisclosure } = require('./posts');
const { productLink, isValidAsin } = require('./amazon');

// インスタのスライドと同じ配色の、文字が読める濃さ版（テラコッタ・セージは文字や白文字の背景に使うので濃いめ）
const SITE_COLORS = {
  bg: '#FAF7F2',
  card: '#FFFFFF',
  text: '#3D3A36',
  sub: '#6B655C',
  sage: '#4F6B4B',
  terracotta: '#A85A32',
  'on-accent': '#FFFFFF',
  line: '#ECE6DC',
};

const escapeHtml = (text) => String(text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function postDate(post) {
  if (!post.publishedAt) return '投稿前';
  return new Date(post.publishedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric' });
}

function renderPost(post, hasCover) {
  const items = post.products.map((p, i) => `
        <li class="item">
          <div class="item-head"><span class="no">${String(i + 1).padStart(2, '0')}</span><span class="name">${escapeHtml(p.shortName)}</span></div>
          <ul class="points">${p.points.map((pt) => `<li>${escapeHtml(pt)}</li>`).join('')}</ul>
          ${isValidAsin(p.asin)
    ? `<a class="button" href="${escapeHtml(productLink(p.asin))}" target="_blank" rel="sponsored noopener">Amazonで見る</a>`
    : `<span class="button disabled">${post.status === 'published' ? '条件に合う商品を確認中です' : '準備中'}</span>`}
        </li>`).join('');
  const storefront = post.storefrontListUrl
    ? `<a class="sub-button" href="${escapeHtml(post.storefrontListUrl)}" target="_blank" rel="sponsored noopener">Amazonのリストでまとめて見る</a>`
    : '';
  return `
    <section class="post" id="${escapeHtml(post.id)}">
      <div class="post-head">
        ${hasCover ? `<img class="cover" src="covers/${escapeHtml(post.id)}.jpg" alt="${escapeHtml(post.title)}" width="480" height="600" loading="lazy">` : ''}
        <div>
          <h2>${escapeHtml(post.listName)}</h2>
          <p class="meta">${escapeHtml(post.title)}（${postDate(post)}の投稿）</p>
        </div>
      </div>
      <ol class="items">${items}
      </ol>
      ${storefront}
    </section>`;
}

function renderPage(posts, covers) {
  const account = loadAccount();
  const handle = (account.handle || '').replace(/^@/, '');
  const disclosure = associateDisclosure();
  const toc = posts.map((p) => `<li><a href="#${escapeHtml(p.id)}">${escapeHtml(p.listName)}</a></li>`).join('');
  const storefront = account.storefrontUrl
    ? `<a class="sub-button" href="${escapeHtml(account.storefrontUrl)}" target="_blank" rel="sponsored noopener">Amazonのストアフロントを見る</a>`
    : '';

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(account.name)}｜紹介アイテムまとめ</title>
<meta name="description" content="Instagram ${escapeHtml(account.handle)} で紹介した家事ラク・収納グッズのまとめ">
<style>
  :root { ${Object.entries(SITE_COLORS).map(([k, v]) => `--${k}: ${v};`).join(' ')} }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); line-height: 1.7;
    font-family: "Hiragino Maru Gothic ProN", "Zen Maru Gothic", "BIZ UDPGothic", "Hiragino Sans", "Meiryo", sans-serif; }
  main { max-width: 640px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { font-size: 1.5rem; margin: 0 0 4px; }
  .lead { margin: 0 0 16px; color: var(--sub); font-size: 0.95rem; }
  .notice { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 12px 16px; font-size: 0.85rem; color: var(--sub); }
  .notice p { margin: 4px 0; }
  .notice strong { color: var(--terracotta); }
  .toc { margin: 24px 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 8px; }
  .toc a { display: inline-block; padding: 6px 12px; border-radius: 999px; background: var(--card); border: 1px solid var(--line); color: var(--text); text-decoration: none; font-size: 0.85rem; }
  .post { background: var(--card); border-radius: 20px; padding: 16px; margin: 20px 0; border: 1px solid var(--line); scroll-margin-top: 12px; }
  .post-head { display: flex; gap: 14px; align-items: center; margin-bottom: 8px; }
  .cover { width: 96px; height: 120px; object-fit: cover; border-radius: 12px; flex-shrink: 0; }
  h2 { font-size: 1.2rem; margin: 0; }
  .meta { margin: 4px 0 0; font-size: 0.8rem; color: var(--sub); }
  .items { list-style: none; margin: 0; padding: 0; }
  .item { padding: 14px 0; border-top: 1px solid var(--line); }
  .item-head { display: flex; align-items: center; gap: 10px; font-weight: bold; }
  .no { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--sage); color: var(--on-accent); font-size: 0.8rem; flex-shrink: 0; }
  .points { margin: 8px 0 12px; padding-left: 1.2em; font-size: 0.88rem; color: var(--sub); }
  .button { display: block; text-align: center; padding: 12px; border-radius: 12px; background: var(--terracotta); color: var(--on-accent); font-weight: bold; text-decoration: none; }
  .button.disabled { background: var(--line); color: var(--sub); }
  .sub-button { display: block; text-align: center; margin-top: 12px; padding: 10px; border-radius: 12px; border: 2px solid var(--sage); color: var(--sage); font-weight: bold; text-decoration: none; }
  .empty { text-align: center; color: var(--sub); padding: 40px 0; }
  footer { margin-top: 32px; font-size: 0.8rem; color: var(--sub); text-align: center; }
  footer a { color: var(--sub); }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(account.name)}</h1>
  <p class="lead">Instagramで紹介した家事ラク・収納グッズを、投稿と同じ名前でまとめています。</p>
  <div class="notice">
    <p><strong>PR</strong>｜このページには Amazon アソシエイトのリンクが含まれています。${escapeHtml(disclosure)}</p>
    <p>ページの文章と画像は AI により作成しています。</p>
    <p>価格・在庫・レビューは、リンク先の Amazon の商品ページで最新の情報を確認してください。</p>
  </div>
  ${storefront}
  ${posts.length > 0 ? `<ul class="toc">${toc}</ul>` : '<p class="empty">最初の投稿を準備中です。</p>'}
  ${posts.map((p) => renderPost(p, covers.has(p.id))).join('\n')}
  <footer>
    ${handle ? `<p><a href="https://www.instagram.com/${escapeHtml(handle)}/" target="_blank" rel="noopener">Instagram @${escapeHtml(handle)}</a></p>` : ''}
    <p>${escapeHtml(disclosure)}</p>
  </footer>
</main>
</body>
</html>
`;
}

module.exports = { SITE_COLORS, renderPage, escapeHtml };
