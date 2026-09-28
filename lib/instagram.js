/**
 * Instagram API with Instagram Login（graph.instagram.com）クライアント
 *
 * 仕様: https://developers.facebook.com/docs/instagram-platform/content-publishing/
 * 必要な権限: instagram_business_basic, instagram_business_content_publish
 */

const { requireEnv, sleep } = require('./config');

function base() {
  return `https://graph.instagram.com/${process.env.IG_API_VERSION || 'v25.0'}`;
}

async function request(method, path, params = {}) {
  const { IG_ACCESS_TOKEN } = requireEnv(['IG_ACCESS_TOKEN']);
  const query = new URLSearchParams({ ...params, access_token: IG_ACCESS_TOKEN });

  const res = method === 'GET'
    ? await fetch(`${base()}${path}?${query}`)
    : await fetch(`${base()}${path}`, { method, body: query });

  const body = await res.json().catch(() => null);
  if (!res.ok || (body && body.error)) {
    const err = body && body.error;
    const detail = err ? `${err.message}（code ${err.code}${err.error_subcode ? `/${err.error_subcode}` : ''}）` : `HTTP ${res.status}`;
    throw new Error(`Instagram API エラー [${method} ${path}]: ${detail}`);
  }
  return body;
}

function userId() {
  return requireEnv(['IG_USER_ID']).IG_USER_ID;
}

async function getMe() {
  return request('GET', '/me', { fields: 'user_id,username,account_type' });
}

/** 画像コンテナ作成（カルーセルの子 or 単体投稿） */
async function createImageContainer(imageUrl, { isCarouselItem = false, caption } = {}) {
  const params = { image_url: imageUrl };
  if (isCarouselItem) params.is_carousel_item = 'true';
  if (caption) params.caption = caption;
  const { id } = await request('POST', `/${userId()}/media`, params);
  return id;
}

/** カルーセルコンテナ作成（子は最大10個） */
async function createCarouselContainer(childIds, caption) {
  if (childIds.length < 2 || childIds.length > 10) {
    throw new Error(`カルーセルは2〜10枚まで（今は${childIds.length}枚）`);
  }
  const { id } = await request('POST', `/${userId()}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
  });
  return id;
}

/** コンテナが FINISHED になるまで待つ */
async function waitUntilFinished(containerId, { timeoutMs = 120000, intervalMs = 3000 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const { status_code: status } = await request('GET', `/${containerId}`, { fields: 'status_code' });
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`コンテナ ${containerId} が ${status} になった（画像URL・形式を確認して）`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`コンテナ ${containerId} の処理が ${timeoutMs / 1000} 秒で終わらなかった`);
}

async function publishContainer(creationId) {
  const { id } = await request('POST', `/${userId()}/media_publish`, { creation_id: creationId });
  return id;
}

async function getPermalink(mediaId) {
  const { permalink } = await request('GET', `/${mediaId}`, { fields: 'permalink' });
  return permalink;
}

/** 直近24時間のAPI投稿数（上限100） */
async function getPublishingLimit() {
  const { data } = await request('GET', `/${userId()}/content_publishing_limit`, { fields: 'quota_usage,config' });
  return data && data[0];
}

/**
 * 長期トークン（60日）を更新。発行から24時間以上経っていて、期限切れ前のトークンのみ更新できる
 * @returns {Promise<{ access_token: string, expires_in: number }>}
 */
async function refreshAccessToken() {
  const { IG_ACCESS_TOKEN } = requireEnv(['IG_ACCESS_TOKEN']);
  const query = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: IG_ACCESS_TOKEN });
  const res = await fetch(`https://graph.instagram.com/refresh_access_token?${query}`);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !body.access_token) {
    throw new Error(`トークン更新失敗 (HTTP ${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

module.exports = {
  getMe,
  createImageContainer,
  createCarouselContainer,
  waitUntilFinished,
  publishContainer,
  getPermalink,
  getPublishingLimit,
  refreshAccessToken,
};
