/**
 * 投稿待ち（ready）の先頭1本を Instagram にカルーセル投稿する
 *
 * 流れ: 規約チェック → スライドをSupabaseにアップ → 子コンテナ作成 → カルーセルコンテナ作成 → FINISHED待ち → 公開
 *
 * 使い方:
 *   node scripts/publish.js                 # 次の1本を投稿（GitHub Actions から毎日実行）
 *   node scripts/publish.js --dry-run       # コンテナ作成まで（公開しない）
 *   node scripts/publish.js --post <id>     # 指定の投稿（status: ready のもの）
 */

const fs = require('fs');
const minimist = require('minimist');
const instagram = require('../lib/instagram');
const { uploadImage } = require('../lib/storage');
const { CAPTION_HEADER, listPosts, loadPost, savePost, slidePath, buildCaption } = require('../lib/posts');
const { buildSlides } = require('../lib/prompts');
const { findViolations } = require('../lib/compliance');

const args = minimist(process.argv.slice(2), { boolean: ['dry-run'], string: ['post'] });
const dryRun = args['dry-run'];

function pickPost() {
  if (args.post) {
    const post = loadPost(args.post);
    if (post.status !== 'ready') throw new Error(`${post.id} は status: ${post.status}（ready のものだけ投稿できる）`);
    return post;
  }
  return listPosts().find((p) => p.status === 'ready');
}

(async () => {
  const post = pickPost();
  if (!post) {
    console.log('投稿待ち（ready）の投稿がないので何もしない');
    return;
  }

  // 承認後に post.json を手で直した場合もあるので、投稿直前にもう一度チェックする
  const violations = findViolations(post);
  if (violations.length > 0) {
    throw new Error(`規約チェックに引っかかったので中止:\n${violations.map((v) => `  - ${v}`).join('\n')}`);
  }
  const caption = buildCaption(post);
  if (!caption.startsWith(CAPTION_HEADER)) throw new Error('キャプション1行目の #PR・AI表記がないので中止');

  const limit = await instagram.getPublishingLimit();
  if (limit && limit.config && limit.quota_usage >= limit.config.quota_total) {
    throw new Error(`24時間の投稿上限に達してる（${limit.quota_usage}/${limit.config.quota_total}）`);
  }

  console.log(`▶ ${post.id}「${post.title}」${dryRun ? '（ドライラン）' : ''}`);

  const slideCount = buildSlides(post).length;
  const version = Date.now();
  const imageUrls = [];
  for (let i = 0; i < slideCount; i += 1) {
    const localPath = slidePath(post.id, i);
    if (!fs.existsSync(localPath)) throw new Error(`slide${i + 1}.jpg がない`);
    // 同じパスだと Instagram 側のキャッシュで古い画像が使われることがあるので毎回別名にする
    imageUrls.push(await uploadImage(localPath, `posts/${post.id}/${version}/slide${i + 1}.jpg`));
  }
  console.log(`  ✓ 画像アップロード ${imageUrls.length}枚`);

  let creationId;
  if (imageUrls.length === 1) {
    creationId = await instagram.createImageContainer(imageUrls[0], { caption });
  } else {
    const childIds = [];
    for (const url of imageUrls) {
      childIds.push(await instagram.createImageContainer(url, { isCarouselItem: true }));
    }
    creationId = await instagram.createCarouselContainer(childIds, caption);
  }
  await instagram.waitUntilFinished(creationId);
  console.log(`  ✓ コンテナ準備完了: ${creationId}`);

  if (dryRun) {
    console.log('  ドライランなので公開はしない（コンテナは24時間で自動的に失効する）');
    console.log(`\n--- キャプション ---\n${caption}`);
    return;
  }

  const mediaId = await instagram.publishContainer(creationId);
  const permalink = await instagram.getPermalink(mediaId).catch(() => null);

  post.status = 'published';
  post.mediaId = mediaId;
  post.permalink = permalink;
  post.publishedAt = new Date().toISOString();
  savePost(post);
  console.log(`  ✓ 投稿完了: ${permalink || mediaId}`);
})().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
