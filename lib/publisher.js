/**
 * Instagram への公開（重複投稿を防ぐ流れ）
 *
 * 1. prepare: 公開直前チェック → 「投稿中（publishing）」を記録（GitHub Actions はここで一度 push する）
 * 2. execute: 画像アップロード → コンテナ作成 → 公開 → 「投稿済み（published）」を記録
 *
 * - 公開APIを呼ぶ前に失敗したら、確実に未投稿なので ready に戻す
 * - 公開APIの呼び出し中・後に失敗したら、結果が不明なので publishing のまま残す
 * - 次の実行で publishing が残っていたら、Instagram の最近の投稿とキャプションを照合する。
 *   見つかれば投稿済みとして記録、見つからなければ「確認が必要」で止める（自動で再投稿しない）
 *
 * Instagram・画像置き場・保存処理は引数で受け取る（テストで偽物に差し替えるため）
 */

const fs = require('fs');
const crypto = require('crypto');
const { slidePath, buildCaption } = require('./posts');
const { slideCount } = require('./slides');
const { publishProblems } = require('./checks');

const RECENT_MEDIA_LIMIT = 25;

const normalize = (text) => String(text || '').replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();

/** Instagram の最近の投稿から、この投稿と同じキャプションのものを探す */
function findPublishedMatch(post, recentMedia) {
  const caption = normalize(buildCaption(post));
  return recentMedia.find((media) => normalize(media.caption) === caption) || null;
}

function markPublished(post, { id, permalink, timestamp }, now) {
  post.status = 'published';
  post.mediaId = id;
  post.permalink = permalink || post.permalink || null;
  post.publishedAt = timestamp ? new Date(timestamp).toISOString() : now().toISOString();
  delete post.publishAttempt;
}

class NeedsReviewError extends Error {}

/**
 * 公開の準備
 * @param {Object} deps
 * @param {Object[]} deps.posts - 全投稿（投稿順）
 * @param {Object} deps.instagram - getRecentMedia(limit) を持つもの
 * @param {Function} deps.save - post を保存する
 * @param {string} [deps.onlyId] - この投稿だけを対象にする
 * @param {Function} [deps.now]
 * @returns {Promise<{ action: 'none'|'publish'|'reconciled', post?: Object, message: string }>}
 * @throws {NeedsReviewError} 結果が不明な投稿がある・チェックに引っかかった（人の確認が必要）
 */
async function prepare({ posts, instagram, save, onlyId, now = () => new Date() }) {
  const pending = posts.filter((p) => p.status === 'publishing');
  if (pending.length > 0) {
    const recent = await instagram.getRecentMedia(RECENT_MEDIA_LIMIT);
    const unresolved = [];
    const reconciled = [];
    for (const post of pending) {
      const match = findPublishedMatch(post, recent);
      if (match) {
        markPublished(post, match, now);
        save(post);
        reconciled.push(post);
      } else {
        unresolved.push(post);
      }
    }
    if (unresolved.length > 0) {
      throw new NeedsReviewError(
        `投稿結果が不明なまま残っている: ${unresolved.map((p) => p.id).join(', ')}\n`
        + '  Instagram に同じ投稿が見つからなかった。自動では再投稿しないので、Instagram を確認して次のどちらかを実行して:\n'
        + '    投稿されていた → npm run status -- --resolve <id> --published <投稿のURL>\n'
        + '    投稿されていない → npm run status -- --resolve <id> --not-published',
      );
    }
    return {
      action: 'reconciled',
      post: reconciled[0],
      message: `前回の投稿結果を Instagram で確認できたので投稿済みとして記録した: ${reconciled.map((p) => p.id).join(', ')}（今回は新しく投稿しない）`,
    };
  }

  const post = onlyId ? posts.find((p) => p.id === onlyId) : posts.find((p) => p.status === 'ready');
  if (!post) return { action: 'none', message: '投稿待ち（ready）の投稿がないので何もしない' };

  const problems = publishProblems(post);
  if (problems.length > 0) {
    throw new NeedsReviewError(`${post.id} は公開できない:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }

  // 記録が消えた場合に備えて、同じキャプションの投稿がすでにないかも確認する
  const recent = await instagram.getRecentMedia(RECENT_MEDIA_LIMIT);
  const already = findPublishedMatch(post, recent);
  if (already) {
    markPublished(post, already, now);
    save(post);
    return { action: 'reconciled', post, message: `${post.id} は Instagram に同じ投稿がすでにあったので、投稿済みとして記録した（再投稿しない）` };
  }

  post.status = 'publishing';
  post.publishAttempt = { id: crypto.randomUUID(), startedAt: now().toISOString(), phase: 'prepared' };
  save(post);
  return { action: 'publish', post, message: `${post.id} を「投稿中」にした` };
}

/** スライドを公開URLに上げて、公開待ちのコンテナを作る */
async function createContainer(post, { instagram, uploadImage }) {
  const caption = buildCaption(post);
  const limit = await instagram.getPublishingLimit();
  if (limit && limit.config && limit.quota_usage >= limit.config.quota_total) {
    throw new Error(`24時間の投稿上限に達してる（${limit.quota_usage}/${limit.config.quota_total}）`);
  }

  const version = Date.now();
  const imageUrls = [];
  for (let i = 0; i < slideCount(post); i += 1) {
    const localPath = slidePath(post.id, i);
    if (!fs.existsSync(localPath)) throw new Error(`slide${i + 1}.jpg がない`);
    // 同じパスだと Instagram 側のキャッシュで古い画像が使われることがあるので毎回別名にする
    imageUrls.push(await uploadImage(localPath, `posts/${post.id}/${version}/slide${i + 1}.jpg`));
  }

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
  return { creationId, caption, imageCount: imageUrls.length };
}

/**
 * 「投稿中」の投稿を公開する
 * @returns {Promise<Object>} 保存後の post
 */
async function execute(post, { instagram, uploadImage, save, now = () => new Date() }) {
  if (post.status !== 'publishing' || !post.publishAttempt) {
    throw new Error(`${post.id} は「投稿中」じゃない（今: ${post.status}）。先に prepare を通して`);
  }

  let phase = 'before-publish';
  try {
    // prepare のあとで中身が変わっていないか、公開直前にもう一度確かめる
    const problems = publishProblems({ ...post, status: 'ready' });
    if (problems.length > 0) throw new Error(`公開直前のチェックに引っかかった:\n${problems.map((p) => `  - ${p}`).join('\n')}`);

    const { creationId } = await createContainer(post, { instagram, uploadImage });

    phase = 'publish-call';
    post.publishAttempt.phase = 'publishing';
    save(post);
    const mediaId = await instagram.publishContainer(creationId);

    phase = 'after-publish';
    markPublished(post, { id: mediaId }, now);
    save(post);
    const permalink = await instagram.getPermalink(mediaId).catch(() => null);
    if (permalink) {
      post.permalink = permalink;
      save(post);
    }
    return post;
  } catch (err) {
    if (phase === 'before-publish') {
      // 公開APIを呼ぶ前なので、確実に未投稿。投稿待ちに戻す
      post.status = 'ready';
      post.lastPublishError = { at: now().toISOString(), message: err.message };
      delete post.publishAttempt;
      save(post);
    } else if (post.status === 'publishing') {
      // 公開されたかどうか分からない。次の実行で Instagram と照合する
      post.publishAttempt.phase = phase;
      post.publishAttempt.error = err.message;
      save(post);
    }
    throw err;
  }
}

/** ドライラン: コンテナ作成まで（状態は変えない） */
async function dryRun(post, { instagram, uploadImage }) {
  const problems = publishProblems(post);
  if (problems.length > 0) throw new NeedsReviewError(`${post.id} は公開できない:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  return createContainer(post, { instagram, uploadImage });
}

module.exports = { prepare, execute, dryRun, findPublishedMatch, NeedsReviewError };
