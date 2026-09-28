/**
 * post.json の文言から、スライド画像（1080x1350 JPEG）を生成する
 * 生成後、下端に「PR｜AIにより作成」とアカウント名を焼き込む（lib/label.js）
 *
 * 使い方:
 *   node scripts/gen-images.js --post 01_heyaboshi            # 未生成のスライドだけ作る
 *   node scripts/gen-images.js --post 01_heyaboshi --slide 3  # 3枚目だけ作り直す
 *   node scripts/gen-images.js --post 01_heyaboshi --force    # 全部作り直す
 *   node scripts/gen-images.js --all                          # status: written の投稿を全部
 *   node scripts/gen-images.js --all --relabel                # 生成済みPNGからラベルだけ焼き直す（API代なし）
 */

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const sharp = require('sharp');
const { generateImage, MODEL_NAME } = require('../lib/image_gen');
const { buildSlides, missingTextFields } = require('../lib/prompts');
const { postDir, loadPost, listPosts, slidePath } = require('../lib/posts');
const { labelLayers } = require('../lib/label');

const args = minimist(process.argv.slice(2), { boolean: ['all', 'force', 'relabel'], string: ['post'] });

const WIDTH = 1080;
const HEIGHT = 1350;

function rawPaths(postId, index) {
  const rawDir = path.join(postDir(postId), 'raw');
  return {
    rawDir,
    png: path.join(rawDir, `slide${index + 1}.png`),
    prompt: path.join(rawDir, `slide${index + 1}.prompt.txt`),
  };
}

/** 生成元PNG → ラベル入りの最終JPEG */
async function finalizeSlide(png, target) {
  await sharp(png)
    .resize(WIDTH, HEIGHT, { fit: 'cover' })
    .composite(await labelLayers(WIDTH, HEIGHT))
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(target);
}

async function renderSlide(post, slide, index) {
  const png = await generateImage(slide.prompt, { aspectRatio: '4:5' });

  // 生成元のPNGとプロンプトも残しておく（作り直し・ラベルの焼き直し用、コミットはしない）
  const raw = rawPaths(post.id, index);
  fs.mkdirSync(raw.rawDir, { recursive: true });
  fs.writeFileSync(raw.png, png);
  fs.writeFileSync(raw.prompt, slide.prompt);

  await finalizeSlide(png, slidePath(post.id, index));
}

async function generateForPost(post) {
  const missing = missingTextFields(post);
  if (missing.length > 0) {
    console.error(`✗ ${post.id}: 文言が足りない → ${missing.join(', ')}`);
    return false;
  }

  const slides = buildSlides(post);
  console.log(`\n▶ ${post.id}（${slides.length}枚 / model: ${MODEL_NAME}）`);
  let ok = true;
  for (const [index, slide] of slides.entries()) {
    const target = slidePath(post.id, index);
    if (args.slide && Number(args.slide) !== index + 1) continue;
    if (!args.slide && !args.force && !args.relabel && fs.existsSync(target)) {
      console.log(`  - slide${index + 1}（${slide.kind}）: 生成済みなので飛ばす`);
      continue;
    }
    try {
      if (args.relabel) {
        const raw = rawPaths(post.id, index);
        if (!fs.existsSync(raw.png)) throw new Error('生成元の raw PNG がない（--relabel は生成済みのスライドだけ）');
        await finalizeSlide(fs.readFileSync(raw.png), target);
      } else {
        await renderSlide(post, slide, index);
      }
      console.log(`  ✓ slide${index + 1}（${slide.kind}）${args.relabel ? ' ラベル焼き直し' : ''}`);
    } catch (err) {
      ok = false;
      console.error(`  ✗ slide${index + 1}（${slide.kind}）: ${err.message}`);
    }
  }
  return ok;
}

(async () => {
  const posts = args.all
    ? listPosts().filter((p) => p.status === 'written' || (args.relabel && p.status === 'ready'))
    : [].concat(args.post || []).map(loadPost);
  if (posts.length === 0) {
    console.error('対象の投稿がない。--post <id> か --all を指定して');
    process.exit(1);
  }

  let allOk = true;
  for (const post of posts) {
    allOk = (await generateForPost(post)) && allOk;
  }
  console.log(allOk
    ? '\n画像を目視チェックして、文字化けや誤字がなければ npm run storefront でストアフロントの登録に進んでね'
    : '\n失敗したスライドがある。--slide <番号> で作り直せるよ');
  process.exit(allOk ? 0 : 1);
})();
