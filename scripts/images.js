/**
 * スライド画像（1080x1350 JPEG）を作る
 *
 * 1. 足りないイラスト（表紙・アイテム5つ）を OpenAI で生成 → posts/<id>/illust/*.png
 * 2. 文字・チェックポイント・「PR｜AIにより作成」ラベルをプログラムで合成 → posts/<id>/slide1〜7.jpg
 *
 * 使い方:
 *   node scripts/images.js --post 01_heyaboshi              # 足りないイラストだけ生成して、7枚を合成
 *   node scripts/images.js --all                            # status: written / ready の投稿を全部
 *   node scripts/images.js --post 01_heyaboshi --redo item3 # 3つ目のアイテムのイラストを作り直す（cover / item1〜item5）
 *   node scripts/images.js --all --no-api                   # イラストは作らず合成だけ（文言を直したとき。料金なし）
 *   node scripts/images.js --post 01_heyaboshi --prompts    # ChatGPT で手作りする用のプロンプトを表示
 */

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { loadPost, listPosts, slidePath } = require('../lib/posts');
const { slideCount, missingTextFields, composeSlide } = require('../lib/slides');
const { illustrationJobs, illustrationPath } = require('../lib/illustrations');
const { MODEL, QUALITY, generateIllustration } = require('../lib/openai-image');

const args = minimist(process.argv.slice(2), { boolean: ['all', 'no-api', 'prompts'], string: ['post', 'redo'] });
const redo = new Set([].concat(args.redo || []).flatMap((r) => String(r).split(',')));

function printPrompts(post) {
  console.log(`\n▶ ${post.id} のイラスト用プロンプト（ChatGPT で作ったら、書いてある場所にPNGで保存 → --no-api で合成）`);
  for (const job of illustrationJobs(post)) {
    console.log(`\n----- 保存先: ${path.relative(process.cwd(), illustrationPath(post.id, job.key))}\n${job.prompt}`);
  }
}

/** @returns {Promise<{ ok: boolean, generated: number }>} */
async function buildPost(post) {
  const missing = missingTextFields(post);
  if (missing.length > 0) {
    console.error(`✗ ${post.id}: 文言が足りない → ${missing.join(', ')}`);
    return { ok: false, generated: 0 };
  }

  console.log(`\n▶ ${post.id}「${post.title}」`);
  const illustrations = {};
  let generated = 0;
  for (const job of illustrationJobs(post)) {
    const file = illustrationPath(post.id, job.key);
    if (fs.existsSync(file) && !redo.has(job.key)) {
      illustrations[job.key] = fs.readFileSync(file);
      continue;
    }
    if (args['no-api']) {
      console.error(`  ✗ イラスト ${job.key} がない（--no-api なので生成しない）`);
      return { ok: false, generated };
    }
    try {
      const png = await generateIllustration(job.prompt);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, png);
      fs.writeFileSync(file.replace(/\.png$/, '.prompt.txt'), job.prompt);
      illustrations[job.key] = png;
      generated += 1;
      console.log(`  ✓ イラスト ${job.key} を生成`);
    } catch (err) {
      console.error(`  ✗ イラスト ${job.key}: ${err.message}`);
      return { ok: false, generated };
    }
  }

  for (let i = 0; i < slideCount(post); i += 1) {
    fs.writeFileSync(slidePath(post.id, i), await composeSlide(post, i, illustrations));
  }
  console.log(`  ✓ スライド ${slideCount(post)}枚を合成`);
  return { ok: true, generated };
}

(async () => {
  const posts = args.all
    ? listPosts().filter((p) => p.status === 'written' || p.status === 'ready')
    : [].concat(args.post || []).map(loadPost);
  if (posts.length === 0) {
    console.error('対象の投稿がない。--post <id> か --all を指定して');
    process.exit(1);
  }

  if (args.prompts) {
    posts.forEach(printPrompts);
    return;
  }

  let allOk = true;
  let generated = 0;
  for (const post of posts) {
    const result = await buildPost(post);
    allOk = result.ok && allOk;
    generated += result.generated;
  }

  if (generated > 0) console.log(`\n生成したイラスト: ${generated}枚（${MODEL} / quality: ${QUALITY}）`);
  console.log(allOk
    ? '\nスライドを目視チェックして、イラストが微妙なら --redo item<番号> で作り直してね。次は npm run picks で商品選び'
    : '\n失敗したものがある。上のメッセージを見て直してね');
  process.exit(allOk ? 0 : 1);
})();
