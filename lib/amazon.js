/**
 * Amazon の商品URL → ASIN（商品番号）→ 自分のアソシエイトリンク
 *
 * 商品データAPI（Creators API）は売上条件を満たすまで使えないので、
 * ユーザーが Amazon で選んだ商品のURLから ASIN を取り出して、トラッキングIDつきのリンクを作る
 */

const { loadAccount } = require('./config');

const ASIN_IN_PATH = /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN|o\/ASIN)\/([A-Z0-9]{10})(?:[/?#]|$)/i;
const BARE_ASIN = /^[A-Z0-9]{10}$/i;
// スマホアプリの「共有」や SiteStripe で出てくる短縮URL
const SHORT_HOSTS = ['amzn.asia', 'amzn.to', 'a.co'];
const TAG_PATTERN = /^[a-z0-9-]+-22$/i;

function asinFromUrl(url) {
  const match = url.pathname.match(ASIN_IN_PATH);
  return match ? match[1].toUpperCase() : null;
}

/**
 * URL（短縮URL可）や ASIN そのものから ASIN を取り出す
 * @param {string} input
 * @returns {Promise<string>}
 */
async function resolveAsin(input) {
  const text = input.trim();
  if (BARE_ASIN.test(text)) return text.toUpperCase();

  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`URLとして読めない: ${text}`);
  }

  for (let hop = 0; hop < 5; hop += 1) {
    if (url.hostname.endsWith('amazon.co.jp')) {
      const asin = asinFromUrl(url);
      if (asin) return asin;
      throw new Error(`商品ページのURLじゃないみたい（/dp/ の入ったURLを貼って）: ${text}`);
    }
    if (/(^|\.)amazon\./.test(url.hostname)) {
      throw new Error(`amazon.co.jp 以外の Amazon は対象外: ${text}`);
    }
    if (!SHORT_HOSTS.includes(url.hostname)) {
      throw new Error(`Amazon のURLじゃない: ${text}`);
    }
    // 短縮URLはリダイレクト先を見る（ページ本体は取りにいかない）
    const res = await fetch(url, { method: 'GET', redirect: 'manual' });
    const location = res.headers.get('location');
    if (!location) throw new Error(`短縮URLの転送先がわからない（HTTP ${res.status}）。商品ページを開いてURLをコピーして: ${text}`);
    url = new URL(location, url);
  }
  throw new Error(`転送が多すぎる: ${text}`);
}

/** content/account.json のトラッキングID（xxxx-22） */
function associateTag() {
  const { associateTag: tag } = loadAccount();
  if (!tag || !TAG_PATTERN.test(tag)) {
    throw new Error('content/account.json の associateTag にトラッキングID（xxxx-22 の形）を入れて');
  }
  return tag;
}

/** 商品ページへのアソシエイトリンク */
function productLink(asin) {
  return `https://www.amazon.co.jp/dp/${asin}?tag=${encodeURIComponent(associateTag())}`;
}

module.exports = { resolveAsin, associateTag, productLink };
