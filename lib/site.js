/**
 * リンク集ページの HTML（scripts/build-site.js から使う）
 *
 * インスタから来た人が「見た投稿」をすぐ見つけられるように、上に表紙の一覧（プロフィールのグリッドと同じ並び）を置き、
 * 各まとめはキャプションで案内している『リスト名』を大見出しにする。番号バッジと ✓ はスライドと同じ形。
 *
 * 文字色と背景色は WCAG のコントラスト比 4.5:1 以上（通常サイズの文字）になる組み合わせだけを使う。
 * 色を変えるときは test/site-and-workflows.test.js のコントラストのテストも通ること
 */

const { loadAccount } = require('./config');
const { associateDisclosure } = require('./posts');
const { productLink, isValidAsin } = require('./amazon');

// スライドの「オフホワイト＋セージ」を、文字が読める濃さにしたもの。
// 地はうすいセージ、まとめ1つ分がオフホワイトの紙。テラコッタは「Amazonで見る」と PR 表記だけに使う（地の上には置かない）
const SITE_COLORS = {
  bg: '#E8EDE3',
  sheet: '#FBFAF6',
  text: '#2F352C',
  sub: '#5A6254',
  sage: '#46633E',
  terracotta: '#A85A32',
  'on-accent': '#FFFFFF',
  line: '#D7DFCF',
};

// 表紙の一覧に最初から並べる数（インスタのプロフィールの3列×3段）。それより前の投稿は「前の投稿も表示」で開く
const COVERS_SHOWN = 9;

const escapeHtml = (text) => String(text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// スライドの ✓（セージの丸に白いチェック）
const checkIcon = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><circle cx='10' cy='10' r='10' fill='${SITE_COLORS.sage}'/>`
  + "<path d='M5.6 10.3l3 3 5.8-6.3' fill='none' stroke='#fff' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/></svg>",
)}")`;

function postDate(post) {
  if (!post.publishedAt) return '投稿前';
  const date = new Date(post.publishedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric' });
  return `${date}の投稿`;
}

function renderCoverLink(post, hasCover) {
  const image = hasCover
    ? `<img src="covers/${escapeHtml(post.id)}.jpg" alt="" width="480" height="600" loading="lazy">`
    : '<span class="cover-blank"></span>';
  return `<li><a href="#${escapeHtml(post.id)}">${image}<span class="cover-name">${escapeHtml(post.listName)}</span></a></li>`;
}

function renderItem(post, product, index) {
  const button = isValidAsin(product.asin)
    ? `<a class="button" href="${escapeHtml(productLink(product.asin))}" target="_blank" rel="sponsored noopener" aria-label="${escapeHtml(product.shortName)}をAmazonで見る">Amazonで見る</a>`
    : `<span class="button disabled">${post.status === 'published' ? '条件に合う商品を確認中です' : '準備中'}</span>`;
  return `
        <li class="item">
          <span class="no" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
          <div class="item-body">
            <h3 class="item-name">${escapeHtml(product.shortName)}</h3>
            <ul class="points">${product.points.map((pt) => `<li>${escapeHtml(pt)}</li>`).join('')}</ul>
            ${button}
          </div>
        </li>`;
}

function renderPost(post) {
  const storefront = post.storefrontListUrl
    ? `<a class="outline-button" href="${escapeHtml(post.storefrontListUrl)}" target="_blank" rel="sponsored noopener">Amazonのリストでまとめて見る</a>`
    : '';
  return `
    <section class="list" id="${escapeHtml(post.id)}" aria-labelledby="${escapeHtml(post.id)}-name">
      <h2 class="list-name" id="${escapeHtml(post.id)}-name">『${escapeHtml(post.listName)}』</h2>
      <p class="list-meta">${escapeHtml(post.title)}<span class="date">${postDate(post)}</span></p>
      <ol class="items">${post.products.map((p, i) => renderItem(post, p, i)).join('')}
      </ol>
      ${storefront}
      <p class="back"><a href="#covers">表紙の一覧に戻る</a></p>
    </section>`;
}

function renderPage(posts, covers) {
  const account = loadAccount();
  const handle = (account.handle || '').replace(/^@/, '');
  const instagram = handle ? `https://www.instagram.com/${encodeURIComponent(handle)}/` : '';
  const disclosure = associateDisclosure();
  const storefront = account.storefrontUrl
    ? `<a class="outline-button" href="${escapeHtml(account.storefrontUrl)}" target="_blank" rel="sponsored noopener">Amazonのストアフロントを見る</a>`
    : '';
  const coverList = (list) => `<ol>${list.map((p) => renderCoverLink(p, covers.has(p.id))).join('')}</ol>`;
  const olderPosts = posts.slice(COVERS_SHOWN);
  const coverIndex = posts.length > 0
    ? `
  <nav class="covers" aria-labelledby="covers">
    <h2 id="covers">見た投稿の表紙をタップ</h2>
    ${coverList(posts.slice(0, COVERS_SHOWN))}
    ${olderPosts.length > 0 ? `<details><summary class="outline-button">前の投稿も表示（${olderPosts.length}件）</summary>${coverList(olderPosts)}</details>` : ''}
  </nav>`
    : '';
  const lists = posts.length > 0
    ? posts.map(renderPost).join('\n')
    : `
    <div class="empty">
      <p>公開中のまとめはまだありません。Instagram に投稿した日に、ここにも同じ名前で追加します。</p>
      ${instagram ? `<a class="outline-button" href="${escapeHtml(instagram)}" target="_blank" rel="noopener">Instagramの投稿を見る</a>` : ''}
    </div>`;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="${SITE_COLORS.bg}">
<title>${escapeHtml(account.name)}｜紹介アイテムまとめ</title>
<meta name="description" content="Instagram ${escapeHtml(account.handle)} で紹介した家事ラク・収納グッズのまとめ">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&display=swap">
<style>
  :root { ${Object.entries(SITE_COLORS).map(([k, v]) => `--${k}: ${v};`).join(' ')} }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; background: var(--bg); color: var(--text); font-weight: 500; line-height: 1.8;
    font-family: "Zen Maru Gothic", "Hiragino Maru Gothic ProN", "BIZ UDPGothic", "Hiragino Sans", "Meiryo", sans-serif; }
  /* 対応ブラウザ（Chromium 系）では文節で折り返す */
  h1, h2, h3, .cover-name { word-break: auto-phrase; }
  a:focus-visible, summary:focus-visible { outline: 3px solid var(--sage); outline-offset: 3px; }
  .page { max-width: 37.5rem; margin: 0 auto; padding: 32px 16px 40px; }

  .masthead h1 { margin: 0; font-size: 2rem; font-weight: 900; line-height: 1.2; color: var(--sage); }
  .lead { margin: 10px 0 0; font-size: 0.9375rem; }
  .disclosure { margin-top: 16px; font-size: 0.8125rem; line-height: 1.7; color: var(--sub); }
  .disclosure p { margin: 4px 0 0; }
  .tag { display: inline-block; padding: 1px 12px; border-radius: 999px; background: var(--sheet); font-weight: 700; }
  .tag strong { color: var(--terracotta); }

  .covers { margin-top: 32px; }
  .covers h2 { margin: 0 0 12px; font-size: 1rem; font-weight: 700; }
  .covers ol { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 8px; margin: 0; padding: 0; list-style: none; }
  .covers a { display: block; color: var(--text); text-decoration: none; border-radius: 10px; }
  .covers img, .cover-blank { display: block; width: 100%; height: auto; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 10px; background: var(--sheet); }
  .covers details { margin-top: 14px; }
  .covers details ol { margin-top: 14px; }
  .covers summary { cursor: pointer; list-style: none; }
  .covers summary::-webkit-details-marker { display: none; }
  .covers details[open] summary { display: none; }
  .cover-name { display: block; margin-top: 6px; font-size: 0.75rem; font-weight: 700; line-height: 1.5; }

  .list { margin-top: 24px; padding: 28px 20px 16px; border-radius: 28px; background: var(--sheet); scroll-margin-top: 16px; }
  /* 『 の左半分は空きなので、半文字ぶん左に出して下の行と左端をそろえる */
  .list-name { margin: 0; font-size: clamp(1.375rem, 6.2vw, 1.875rem); font-weight: 900; line-height: 1.35; color: var(--sage);
    text-indent: -0.5em; line-break: strict; }
  .list-meta { margin: 8px 0 0; font-size: 0.875rem; line-height: 1.6; }
  .date { display: block; font-size: 0.8125rem; color: var(--sub); }

  .items { margin: 20px 0 0; padding: 0; list-style: none; }
  .item { display: grid; grid-template-columns: 34px 1fr; column-gap: 14px; padding: 20px 0 22px; border-top: 1px solid var(--line); }
  .no { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--sage); color: var(--on-accent);
    font-size: 0.8125rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .item-name { margin: 1px 0 0; font-size: 1.125rem; font-weight: 700; line-height: 1.6; }
  .points { margin: 6px 0 14px; padding: 0; list-style: none; font-size: 0.9375rem; }
  .points li { padding-left: 1.6em; background: ${checkIcon} no-repeat 0 0.36em / 1.1em; }
  .button { display: flex; align-items: center; justify-content: center; max-width: 22rem; min-height: 48px; padding: 8px 20px;
    border-radius: 999px; background: var(--terracotta); color: var(--on-accent); font-weight: 700; text-decoration: none; }
  .button.disabled { border: 2px dashed var(--line); background: none; color: var(--sub); font-size: 0.875rem; }
  .outline-button { display: flex; align-items: center; justify-content: center; max-width: 22rem; min-height: 48px; margin-top: 16px; padding: 8px 20px;
    border: 2px solid var(--sage); border-radius: 999px; color: var(--sage); font-weight: 700; text-decoration: none; }
  .back { margin: 4px 0 0; text-align: right; font-size: 0.8125rem; }
  .back a { color: var(--sage); }

  .empty { margin-top: 32px; padding: 28px 20px; border-radius: 28px; background: var(--sheet); }
  .empty p { margin: 0; }
  .site-foot { margin-top: 40px; font-size: 0.8125rem; color: var(--sub); }
  .site-foot p { margin: 4px 0 0; }
  .site-foot a { color: var(--sage); font-weight: 700; }

  @media (min-width: 560px) {
    .covers ol { gap: 18px 12px; }
    .list { padding: 32px 28px 20px; }
  }
  /* 表紙をタップして飛んだ先を一瞬だけ縁取る */
  @media (prefers-reduced-motion: no-preference) {
    html { scroll-behavior: smooth; }
    .list:target { animation: landed 1.8s ease-out; }
  }
  @media (prefers-reduced-motion: reduce) {
    .list:target { box-shadow: 0 0 0 3px var(--sage); }
  }
  @keyframes landed {
    0%, 35% { box-shadow: 0 0 0 4px var(--sage); }
    100% { box-shadow: 0 0 0 4px transparent; }
  }
</style>
</head>
<body>
<div class="page">
  <header class="masthead">
    <h1>${escapeHtml(account.name)}</h1>
    <p class="lead">Instagramで紹介した家事ラク・収納グッズを、投稿と同じ名前でまとめています。✓ は選ぶときのチェックポイントです。</p>
    <div class="disclosure">
      <span class="tag"><strong>PR</strong>｜AIにより作成</span>
      <p>このページには Amazon アソシエイトのリンクが含まれています。${escapeHtml(disclosure)}</p>
      <p>ページの文章と画像は AI により作成しています。</p>
      <p>価格・在庫・レビューは、リンク先の Amazon の商品ページで最新の情報を確認してください。</p>
    </div>
    ${storefront}
  </header>
  ${coverIndex}
  <main>
  ${lists}
  </main>
  <footer class="site-foot">
    ${instagram ? `<p><a href="${escapeHtml(instagram)}" target="_blank" rel="noopener">Instagram @${escapeHtml(handle)}</a></p>` : ''}
    <p>${escapeHtml(disclosure)}</p>
  </footer>
</div>
</body>
</html>
`;
}

module.exports = { SITE_COLORS, renderPage, escapeHtml };
