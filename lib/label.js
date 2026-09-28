/**
 * スライド下端に「PR｜AIにより作成」（左）とアカウント名（右）を焼き込む
 *
 * Amazonアソシエイトの AI 利用表記は「閲覧前に目立つ場所」が条件なので、
 * 画像生成まかせにせず毎回同じ位置・同じ文字で確実に入れる
 */

const fs = require('fs');
const sharp = require('sharp');
const { loadAccount } = require('./config');

const LABEL_TEXT = 'PR｜AIにより作成';

// 日本語が出るフォント（Pango のファミリー名はファイル内の名前と一致させる）
const FONT_CANDIDATES = [
  { file: 'C:/Windows/Fonts/BIZ-UDGothicB.ttc', family: 'BIZ UDGothic Bold' },
  { file: 'C:/Windows/Fonts/meiryob.ttc', family: 'Meiryo Bold' },
  { file: 'C:/Windows/Fonts/YuGothB.ttc', family: 'Yu Gothic Bold' },
  { file: '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc', family: 'Hiragino Sans W6' },
  { file: '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', family: 'Noto Sans CJK JP Bold' },
];

const TEXT_COLOR = '#5B5B5B';
const PILL_COLOR = 'rgba(255,255,255,0.82)';

function findFont() {
  const font = FONT_CANDIDATES.find((f) => fs.existsSync(f.file));
  if (!font) throw new Error(`ラベル用の日本語フォントが見つからない（探した場所: ${FONT_CANDIDATES.map((f) => f.file).join(', ')}）`);
  return font;
}

function escapeMarkup(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 角丸の半透明背景つきの文字画像を作る */
async function renderPill(text, fontSize) {
  const font = findFont();
  const { data: textPng, info } = await sharp({
    text: {
      text: `<span foreground="${TEXT_COLOR}">${escapeMarkup(text)}</span>`,
      font: `${font.family} ${fontSize}`,
      fontfile: font.file,
      rgba: true,
      dpi: 72,
    },
  }).png().toBuffer({ resolveWithObject: true });

  const padX = Math.round(fontSize * 0.6);
  const padY = Math.round(fontSize * 0.35);
  const width = info.width + padX * 2;
  const height = info.height + padY * 2;
  const pill = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
    + `<rect width="${width}" height="${height}" rx="${height / 2}" fill="${PILL_COLOR}"/></svg>`,
  );
  const data = await sharp(pill).composite([{ input: textPng, left: padX, top: padY }]).png().toBuffer();
  return { data, width, height };
}

/**
 * sharp の composite に渡すレイヤー（左下: PR・AI表記 / 右下: アカウント名）
 * @param {number} width - スライドの幅
 * @param {number} height - スライドの高さ
 */
async function labelLayers(width, height) {
  const fontSize = Math.round(width * 0.028);
  const margin = Math.round(width * 0.03);
  const layers = [];

  const left = await renderPill(LABEL_TEXT, fontSize);
  layers.push({ input: left.data, left: margin, top: height - margin - left.height });

  const { handle } = loadAccount();
  if (handle) {
    const right = await renderPill(handle, fontSize);
    layers.push({ input: right.data, left: width - margin - right.width, top: height - margin - right.height });
  }
  return layers;
}

module.exports = { LABEL_TEXT, labelLayers, findFont };
