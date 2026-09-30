/**
 * 投稿データ＋イラスト → スライド画像（1080x1350 JPEG）の合成
 *
 * スライド構成: 1枚目=表紙 / 2〜6枚目=アイテム1つずつ（選ぶときのチェックポイント） / 最後=保存・プロフのリンクへ誘導
 * 価格・星評価は載せない（Amazonの規約でレビュー・星評価の表示は Creators API 経由以外禁止、古い価格の掲載も禁止）
 */

const sharp = require('sharp');
const {
  WIDTH, HEIGHT, CONTENT_BOTTOM, COLORS,
  renderText, roundedRect, circle, checkIcon, bookmarkIcon, pill, roundedIllustration, centerLeft,
} = require('./draw');
const { labelLayers } = require('./label');

/** 投稿のスライド枚数（表紙＋アイテム＋まとめ） */
function slideCount(post) {
  return post.products.length + 2;
}

/** スライドに必要な文言がそろっているか。足りない項目名を返す */
function missingTextFields(post) {
  const missing = [];
  if (!post.cover || !post.cover.title || !post.cover.subtitle) missing.push('cover.title / cover.subtitle');
  if (!post.cta || !post.cta.headline) missing.push('cta.headline');
  post.products.forEach((p, i) => {
    if (!p.shortName || !p.illustration || !p.points || p.points.length !== 3) {
      missing.push(`products[${i}] の shortName / illustration / points(3つ)`);
    }
  });
  return missing;
}

/** レイヤーを背景に重ねて、ラベル入りのJPEGにする */
async function flatten(layers) {
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: COLORS.background } })
    .composite([...layers, ...(await labelLayers())])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

/**
 * 表紙タイトルは cover.title の「\n」の位置で改行する。1行が幅に収まらなければ文字を小さくする
 * （自動の折り返しだと「洗／濯」のように単語の途中で切れるため）
 */
async function fitTitle(text, maxWidth) {
  for (let size = 84; size > 56; size -= 4) {
    const title = await renderText(text, { size, weight: 'bold', align: 'center' });
    if (title.width <= maxWidth) return title;
  }
  return renderText(text, { size: 56, weight: 'bold', width: maxWidth, align: 'center' });
}

async function coverSlide(post, illustration) {
  const layers = [];
  let y = 80;

  const tag = await pill('保存版', { size: 34, fill: COLORS.terracotta });
  layers.push({ input: tag.data, left: centerLeft(tag.width), top: y });
  y += tag.height + 36;

  const title = await fitTitle(post.cover.title, 940);
  layers.push({ input: title.data, left: centerLeft(title.width), top: y });
  y += title.height + 24;

  const subtitle = await renderText(post.cover.subtitle, { size: 44, color: COLORS.sage, width: 940, align: 'center' });
  layers.push({ input: subtitle.data, left: centerLeft(subtitle.width), top: y });
  y += subtitle.height + 44;

  const swipe = await renderText('スワイプ →', { size: 30, color: COLORS.subText });
  const swipeTop = CONTENT_BOTTOM - swipe.height - 20;
  const size = Math.min(660, swipeTop - 24 - y);
  layers.push({ input: await roundedIllustration(illustration, size), left: centerLeft(size), top: y });
  layers.push({ input: swipe.data, left: WIDTH - 70 - swipe.width, top: swipeTop });

  return flatten(layers);
}

async function productSlide(post, index, illustration) {
  const product = post.products[index];
  const layers = [];

  const badgeSize = 112;
  const badgeTop = 64;
  const no = await renderText(String(index + 1).padStart(2, '0'), { size: 50, weight: 'bold', color: '#FFFFFF' });
  layers.push({ input: circle(badgeSize, COLORS.sage), left: 64, top: badgeTop });
  layers.push({ input: no.data, left: 64 + Math.round((badgeSize - no.width) / 2), top: badgeTop + Math.round((badgeSize - no.height) / 2) });

  const nameLeft = 64 + badgeSize + 28;
  const name = await renderText(product.shortName, { size: 64, weight: 'bold', width: WIDTH - nameLeft - 60 });
  const nameTop = badgeTop + Math.max(0, Math.round((badgeSize - name.height) / 2));
  layers.push({ input: name.data, left: nameLeft, top: nameTop });
  let y = Math.max(badgeTop + badgeSize, nameTop + name.height) + 36;

  const size = 580;
  layers.push({ input: await roundedIllustration(illustration, size), left: centerLeft(size), top: y });
  y += size + 36;

  // チェックポイントは白いカードにまとめる
  const cardLeft = 90;
  const cardWidth = WIDTH - cardLeft * 2;
  const heading = await renderText('選ぶときのチェックポイント', { size: 36, weight: 'bold', color: COLORS.terracotta });
  const rows = [];
  for (const point of product.points) {
    rows.push(await renderText(point, { size: 42, width: cardWidth - 160 }));
  }
  const iconSize = 46;
  const rowGap = 18;
  const rowsHeight = rows.reduce((sum, r) => sum + Math.max(iconSize, r.height), 0) + rowGap * (rows.length - 1);
  const cardHeight = 36 + heading.height + 24 + rowsHeight + 36;
  layers.push({ input: roundedRect(cardWidth, cardHeight, 36, COLORS.card), left: cardLeft, top: y });

  let rowTop = y + 36;
  layers.push({ input: heading.data, left: centerLeft(heading.width), top: rowTop });
  rowTop += heading.height + 24;
  for (const row of rows) {
    const rowHeight = Math.max(iconSize, row.height);
    layers.push({ input: checkIcon(iconSize), left: cardLeft + 60, top: rowTop + Math.round((rowHeight - iconSize) / 2) });
    layers.push({ input: row.data, left: cardLeft + 60 + iconSize + 24, top: rowTop + Math.round((rowHeight - row.height) / 2) });
    rowTop += rowHeight + rowGap;
  }
  y += cardHeight + 28;

  const footer = await renderText('選んだ商品はプロフのリンクから', { size: 30, color: COLORS.subText });
  layers.push({ input: footer.data, left: centerLeft(footer.width), top: Math.min(y, CONTENT_BOTTOM - footer.height - 12) });

  return flatten(layers);
}

async function ctaSlide(post) {
  const iconSize = 170;
  // [画像, 次との間隔] を並べて、全体を上下中央に置く
  const blocks = [
    [await renderText(post.cta.headline, { size: 80, weight: 'bold', width: 940, align: 'center' }), 80],
    [await renderText('紹介したアイテムは', { size: 46 }), 20],
    [await renderText('プロフィールのリンクの', { size: 46 }), 20],
    [await renderText(`『${post.listName}』`, { size: 54, weight: 'bold', color: COLORS.sage, width: 960, align: 'center' }), 20],
    [await renderText('から見られるよ', { size: 46 }), 90],
    [{ data: bookmarkIcon(iconSize), width: iconSize, height: iconSize }, 40],
    [await renderText('あとで見返せるように\n保存してね', { size: 42, color: COLORS.subText, align: 'center' }), 0],
  ];
  const total = blocks.reduce((sum, [block, gap]) => sum + block.height + gap, 0);
  let y = Math.max(120, Math.round((CONTENT_BOTTOM - total) / 2));
  const layers = [];
  for (const [block, gap] of blocks) {
    layers.push({ input: block.data, left: centerLeft(block.width), top: y });
    y += block.height + gap;
  }
  return flatten(layers);
}

/**
 * 1枚分のスライドを合成する
 * @param {Object} post
 * @param {number} index - 0始まり（0=表紙、1〜5=アイテム、最後=まとめ）
 * @param {Object} illustrations - { cover: Buffer, item1: Buffer, ... }
 * @returns {Promise<Buffer>} JPEG
 */
async function composeSlide(post, index, illustrations) {
  if (index === 0) return coverSlide(post, illustrations.cover);
  if (index <= post.products.length) return productSlide(post, index - 1, illustrations[`item${index}`]);
  return ctaSlide(post);
}

module.exports = { slideCount, missingTextFields, composeSlide };
