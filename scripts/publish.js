/**
 * 投稿待ち（ready）の先頭1本を Instagram にカルーセル投稿する（重複投稿を防ぐ流れは lib/publisher.js）
 *
 * 使い方:
 *   node scripts/publish.js --prepare           # 公開前チェック → 「投稿中」を記録（GitHub Actions 用。次に push する）
 *   node scripts/publish.js --execute <id>      # 「投稿中」の投稿を公開して「投稿済み」を記録（GitHub Actions 用）
 *   node scripts/publish.js                     # 手元で prepare と execute を続けて行う
 *   node scripts/publish.js --dry-run           # コンテナ作成まで（公開しない・状態も変えない）
 *   node scripts/publish.js --post <id> [...]   # 指定の投稿だけを対象にする
 *
 * GitHub Actions では prepare の結果を $GITHUB_OUTPUT に action=publish|reconciled|none と post=<id> で渡す
 */

const fs = require('fs');
const minimist = require('minimist');
const instagram = require('../lib/instagram');
const { uploadImage } = require('../lib/storage');
const { listPosts, loadPost, savePost, buildCaption } = require('../lib/posts');
const { prepare, execute, dryRun, NeedsReviewError } = require('../lib/publisher');

const args = minimist(process.argv.slice(2), { boolean: ['dry-run', 'prepare'], string: ['post', 'execute'] });

function setOutput(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(values).map(([k, v]) => `${k}=${v}\n`).join(''));
}

async function runPrepare() {
  const result = await prepare({ posts: listPosts(), instagram, save: savePost, onlyId: args.post });
  console.log(result.message);
  setOutput({ action: result.action, post: result.post ? result.post.id : '' });
  return result;
}

async function runExecute(id) {
  const post = await execute(loadPost(id), { instagram, uploadImage, save: savePost });
  console.log(`✓ 投稿完了: ${post.id} ${post.permalink || post.mediaId}`);
}

(async () => {
  if (args['dry-run']) {
    const post = args.post ? loadPost(args.post) : listPosts().find((p) => p.status === 'ready');
    if (!post) {
      console.log('投稿待ち（ready）の投稿がないので何もしない');
      return;
    }
    const { creationId, imageCount } = await dryRun(post, { instagram, uploadImage });
    console.log(`▶ ${post.id}（ドライラン）: 画像${imageCount}枚 / コンテナ ${creationId}`);
    console.log('  公開はしない（コンテナは24時間で自動的に失効する）');
    console.log(`\n--- キャプション ---\n${buildCaption(post)}`);
    return;
  }

  if (args.prepare) {
    await runPrepare();
    return;
  }
  if (args.execute) {
    await runExecute(args.execute);
    return;
  }

  const result = await runPrepare();
  if (result.action === 'publish') await runExecute(result.post.id);
})().catch((err) => {
  console.error(`✗ ${err.message}`);
  if (err instanceof NeedsReviewError) console.error('（人の確認が必要。docs/operations.md を見て）');
  process.exit(1);
});
