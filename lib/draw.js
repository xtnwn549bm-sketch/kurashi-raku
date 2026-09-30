/**
 * スライド合成用の部品: 配色、文字画像、図形（SVG）、角丸イラスト
 *
 * 文字はすべてここで描く（AIには文字を描かせない）ので、誤字・文字化けが起きない
 */

const sharp = require('sharp');
const { font } = require('./fonts');

const WIDTH = 1080;
const HEIGHT = 1350;
// 下端の帯（下から8%）は「PR｜AIにより作成」とアカウント名のラベル用に空けておく
const CONTENT_BOTTOM = Math.round(HEIGHT * 0.92);

const COLORS = {
  background: '#FAF7F2',
  text: '#3D3A36',
  subText: '#7A746B',
  sage: '#7F9C7A',
  terracotta: '#D98B5F',
  card: '#FFFFFF',
};

function escapeMarkup(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 文字を透過PNGにする。返る width / height は実際に描かれた範囲
 * @param {string} text
 * @param {Object} options
 * @param {number} options.size - 文字サイズ（px）
 * @param {'medium'|'bold'} [options.weight='medium']
 * @param {string} [options.color]
 * @param {number} [options.width] - 折り返す幅（px）
 * @param {'left'|'center'} [options.align='left']
 */
async function renderText(text, { size, weight = 'medium', color = COLORS.text, width, align = 'left' }) {
  const { family, file } = font(weight);
  const options = {
    text: `<span foreground="${color}">${escapeMarkup(text)}</span>`,
    font: `${family} ${size}`,
    fontfile: file,
    rgba: true,
    dpi: 72,
    wrap: 'word-char',
    align: align === 'center' ? 'centre' : align,
  };
  if (width) options.width = width;
  const { data, info } = await sharp({ text: options }).png().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function svg(width, height, body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`);
}

function roundedRect(width, height, radius, fill) {
  return svg(width, height, `<rect width="${width}" height="${height}" rx="${radius}" fill="${fill}"/>`);
}

function circle(size, fill) {
  const r = size / 2;
  return svg(size, size, `<circle cx="${r}" cy="${r}" r="${r}" fill="${fill}"/>`);
}

/** 丸の中にチェックマーク */
function checkIcon(size) {
  const s = size / 46;
  return svg(size, size, `<circle cx="${23 * s}" cy="${23 * s}" r="${23 * s}" fill="${COLORS.sage}"/>`
    + `<path d="M${13 * s} ${24 * s} L${20 * s} ${31 * s} L${34 * s} ${16 * s}" stroke="#FFFFFF" stroke-width="${5 * s}"`
    + ' fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
}

/** しおり（保存）アイコン */
function bookmarkIcon(size) {
  const w = size * 0.7;
  const x = (size - w) / 2;
  return svg(size, size, `<path d="M${x} ${size * 0.08} h${w} v${size * 0.86} l${-w / 2} ${-size * 0.22} l${-w / 2} ${size * 0.22} z"`
    + ` fill="${COLORS.sage}" stroke="${COLORS.sage}" stroke-width="${size * 0.06}" stroke-linejoin="round"/>`);
}

/** 文字入りの角丸ラベル（背景色つき） */
async function pill(text, { size, weight = 'bold', color = '#FFFFFF', fill }) {
  const label = await renderText(text, { size, weight, color });
  const padX = Math.round(size * 0.7);
  const padY = Math.round(size * 0.35);
  const width = label.width + padX * 2;
  const height = label.height + padY * 2;
  const data = await sharp(roundedRect(width, height, height / 2, fill))
    .composite([{ input: label.data, left: padX, top: padY }])
    .png()
    .toBuffer();
  return { data, width, height };
}

/** イラストを正方形の角丸カードにする */
async function roundedIllustration(image, size) {
  const radius = Math.round(size * 0.08);
  return sharp(image)
    .resize(size, size, { fit: 'cover' })
    .ensureAlpha()
    .composite([{ input: roundedRect(size, size, radius, '#000'), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

const centerLeft = (width) => Math.round((WIDTH - width) / 2);

module.exports = {
  WIDTH,
  HEIGHT,
  CONTENT_BOTTOM,
  COLORS,
  renderText,
  roundedRect,
  circle,
  checkIcon,
  bookmarkIcon,
  pill,
  roundedIllustration,
  centerLeft,
};
