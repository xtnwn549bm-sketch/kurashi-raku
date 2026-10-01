/**
 * 1投稿ぶんのイラスト生成とスライド合成
 *
 * useApi が false のときは、イラスト生成（課金あり）を一切呼ばない。
 * 足りないイラストがあれば何も作らずに、足りないファイルの一覧を返す
 */

const fs = require('fs');
const path = require('path');
const { slidePath } = require('./posts');
const { slideCount, missingTextFields, composeSlide } = require('./slides');
const { illustrationJobs, illustrationPath } = require('./illustrations');

/**
 * @param {Object} post
 * @param {Object} options
 * @param {boolean} options.useApi - false ならイラストを生成しない
 * @param {Set<string>} [options.redo] - 作り直すイラストの key（cover / item1〜）
 * @param {Function} [options.generate] - (prompt) => Promise<Buffer>。useApi のときだけ呼ぶ
 * @param {Function} [options.log]
 * @returns {Promise<{ ok: boolean, generated: number, missingText?: string[], missingIllustrations?: string[], error?: string }>}
 */
async function buildPostImages(post, { useApi, redo = new Set(), generate, log = () => {} }) {
  const missingText = missingTextFields(post);
  if (missingText.length > 0) return { ok: false, generated: 0, missingText };

  const jobs = illustrationJobs(post);
  if (!useApi) {
    if (redo.size > 0) return { ok: false, generated: 0, error: '--redo はイラストを作り直すので --no-api とは一緒に使えない' };
    const missing = jobs.map((job) => illustrationPath(post.id, job.key)).filter((file) => !fs.existsSync(file));
    if (missing.length > 0) return { ok: false, generated: 0, missingIllustrations: missing };
  }

  const illustrations = {};
  let generated = 0;
  for (const job of jobs) {
    const file = illustrationPath(post.id, job.key);
    if (fs.existsSync(file) && !redo.has(job.key)) {
      illustrations[job.key] = fs.readFileSync(file);
      continue;
    }
    try {
      const png = await generate(job.prompt);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, png);
      fs.writeFileSync(file.replace(/\.png$/, '.prompt.txt'), job.prompt);
      illustrations[job.key] = png;
      generated += 1;
      log(`  ✓ イラスト ${job.key} を生成`);
    } catch (err) {
      return { ok: false, generated, error: `イラスト ${job.key}: ${err.message}` };
    }
  }

  for (let i = 0; i < slideCount(post); i += 1) {
    fs.writeFileSync(slidePath(post.id, i), await composeSlide(post, i, illustrations));
  }
  log(`  ✓ スライド ${slideCount(post)}枚を合成`);
  return { ok: true, generated };
}

module.exports = { buildPostImages };
