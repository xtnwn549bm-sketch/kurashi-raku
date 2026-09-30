/**
 * スライド下端に「PR｜AIにより作成」（左）とアカウント名（右）を入れるレイヤー
 *
 * Amazonアソシエイトの AI 利用表記は「閲覧前に目立つ場所」が条件なので、全スライドの同じ位置に必ず入れる
 */

const { loadAccount } = require('./config');
const { WIDTH, HEIGHT, COLORS, pill } = require('./draw');

const LABEL_TEXT = 'PR｜AIにより作成';

/** sharp の composite に渡すレイヤー */
async function labelLayers() {
  const style = { size: Math.round(WIDTH * 0.028), weight: 'medium', color: COLORS.subText, fill: 'rgba(255,255,255,0.85)' };
  const margin = Math.round(WIDTH * 0.03);
  const layers = [];

  const left = await pill(LABEL_TEXT, style);
  layers.push({ input: left.data, left: margin, top: HEIGHT - margin - left.height });

  const { handle } = loadAccount();
  if (handle) {
    const right = await pill(handle, style);
    layers.push({ input: right.data, left: WIDTH - margin - right.width, top: HEIGHT - margin - right.height });
  }
  return layers;
}

module.exports = { LABEL_TEXT, labelLayers };
