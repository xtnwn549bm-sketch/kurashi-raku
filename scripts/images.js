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

const path = require('path');
const minimist = require('minimist');
const { loadPost, listPosts } = require('../lib/posts');
const { illustrationJobs, illustrationPath } = require('../lib/illustrations');
const { buildPostImages } = require('../lib/image-pipeline');

// minimist は --no-api を「api を false にする」と解釈するので、api（既定 true）として受け取る
const args = minimist(process.argv.slice(2), {
  boolean: ['all', 'api', 'prompts'],
  string: ['post', 'redo'],
  default: { api: true },
});
const useApi = args.api !== false;
const redo = new Set([].concat(args.redo || []).flatMap((r) => String(r).split(',')).filter(Boolean));

function printPrompts(post) {
  console.log(`\n▶ ${post.id} のイラスト用プロンプト（ChatGPT で作ったら、書いてある場所にPNGで保存 → --no-api で合成）`);
  for (const job of illustrationJobs(post)) {
    console.log(`\n----- 保存先: ${path.relative(process.cwd(), illustrationPath(post.id, job.key))}\n${job.prompt}`);
  }
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

  // 課金のある生成モジュールは、API を使うときだけ読み込む
  const openai = useApi ? require('../lib/openai-image') : null;

  let allOk = true;
  let generated = 0;
  for (const post of posts) {
    console.log(`\n▶ ${post.id}「${post.title}」${useApi ? '' : '（--no-api: イラストは生成しない）'}`);
    const result = await buildPostImages(post, {
      useApi,
      redo,
      generate: openai ? openai.generateIllustration : undefined,
      log: (line) => console.log(line),
    });
    generated += result.generated;
    if (result.ok) continue;
    allOk = false;
    if (result.missingText) console.error(`  ✗ 文言が足りない → ${result.missingText.join(', ')}`);
    if (result.missingIllustrations) {
      console.error('  ✗ イラストがないので合成できない（--no-api なので生成もしない）:');
      result.missingIllustrations.forEach((file) => console.error(`      ${path.relative(process.cwd(), file)}`));
      console.error('    → 生成するなら --no-api を外す。手作りするなら --prompts で出るプロンプトを ChatGPT に貼って、上の場所に保存');
    }
    if (result.error) console.error(`  ✗ ${result.error}`);
  }

  if (generated > 0) console.log(`\n生成したイラスト: ${generated}枚（${openai.MODEL} / quality: ${openai.QUALITY}）`);
  console.log(allOk
    ? '\nスライドを目視チェックして、イラストが微妙なら --redo item<番号> で作り直してね。次は npm run picks で商品選び'
    : '\n失敗したものがある。上のメッセージを見て直してね');
  process.exit(allOk ? 0 : 1);
})();
