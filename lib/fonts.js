/**
 * 同梱フォント（assets/fonts の Zen Maru Gothic、OFL ライセンス）を sharp の text 入力で使う準備
 *
 * Windows の Pango は日本語を含むパス（C:\Users\わい\... など）のフォントファイルを読めず、
 * エラーも出さずに別の書体へすり替える。なので英数字だけのフォルダにコピーしてから渡す
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { ROOT } = require('./config');

const FONTS = {
  medium: { file: 'ZenMaruGothic-Medium.ttf', family: 'Zen Maru Gothic Medium' },
  bold: { file: 'ZenMaruGothic-Bold.ttf', family: 'Zen Maru Gothic Bold' },
};

const isAscii = (text) => /^[\x20-\x7e]*$/.test(text);

function cacheDir() {
  const candidates = [
    process.env.FONT_CACHE_DIR,
    process.platform === 'win32' ? 'C:/Users/Public/amazon-ig-fonts' : null,
    path.join(os.tmpdir(), 'amazon-ig-fonts'),
  ].filter(Boolean);
  const dir = candidates.find(isAscii);
  if (!dir) throw new Error('フォントを置ける英数字だけのフォルダがない。.env に FONT_CACHE_DIR=C:/fonts のように指定して');
  return dir;
}

const resolved = {};

/**
 * @param {'medium'|'bold'} weight
 * @returns {{ family: string, file: string }} Pango のファミリー名と、読めるパスに置いたフォントファイル
 */
function font(weight) {
  if (resolved[weight]) return resolved[weight];
  const { file, family } = FONTS[weight];
  const src = path.join(ROOT, 'assets', 'fonts', file);
  let target = src;
  if (!isAscii(src)) {
    const dir = cacheDir();
    fs.mkdirSync(dir, { recursive: true });
    target = path.join(dir, file);
    if (!fs.existsSync(target) || fs.statSync(target).size !== fs.statSync(src).size) {
      fs.copyFileSync(src, target);
    }
  }
  resolved[weight] = { family, file: target.replace(/\\/g, '/') };
  return resolved[weight];
}

module.exports = { font };
