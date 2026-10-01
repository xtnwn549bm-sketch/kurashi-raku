/**
 * Amazon の商品URL → ASIN（商品番号）→ 自分のアソシエイトリンク
 *
 * 商品データAPI（Creators API）は売上条件を満たすまで使えないので、
 * ユーザーが Amazon で選んだ商品のURLから ASIN を取り出して、トラッキングIDつきのリンクを作る
 */

const { loadAccount } = require('./config');

const ASIN_IN_PATH = /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN|o\/ASIN)\/([A-Z0-9]{10})(?:[/?#]|$)/i;
const ASIN_PATTERN = /^[A-Z0-9]{10}$/;
// スマホアプリの「共有」や SiteStripe で出てくる短縮URL（このホスト名ちょうどのものだけ）
const SHORT_HOSTS = ['amzn.asia', 'amzn.to', 'a.co'];
const TAG_PATTERN = /^[a-z0-9-]+-22$/i;

/** amazon.co.jp 本体か、その正規のサブドメイン（www. など）か。notamazon.co.jp は通さない */
function isAmazonJpHost(hostname) {
  const host = hostname.toLowerCase();
  return host === 'amazon.co.jp' || host.endsWith('.amazon.co.jp');
}

function isValidAsin(asin) {
  return typeof asin === 'string' && ASIN_PATTERN.test(asin);
}

function asinFromUrl(url) {
  const match = url.pathname.match(ASIN_IN_PATH);
  return match ? match[1].toUpperCase() : null;
}

function parseHttpsUrl(text, original) {
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`URLとして読めない: ${original}`);
  }
  if (url.protocol !== 'https:') throw new Error(`https のURLだけ受け付ける: ${original}`);
  return url;
}

/**
 * URL（短縮URL可）や ASIN そのものから ASIN を取り出す
 * @param {string} input
 * @param {Object} [deps]
 * @param {typeof fetch} [deps.fetch] - テスト用に差し替える
 * @returns {Promise<string>}
 */
async function resolveAsin(input, { fetch: fetchFn = fetch } = {}) {
  const text = input.trim();
  if (ASIN_PATTERN.test(text.toUpperCase())) return text.toUpperCase();

  let url = parseHttpsUrl(text, text);
  for (let hop = 0; hop < 5; hop += 1) {
    if (isAmazonJpHost(url.hostname)) {
      const asin = asinFromUrl(url);
      if (asin) return asin;
      throw new Error(`商品ページのURLじゃないみたい（/dp/ の入ったURLを貼って）: ${text}`);
    }
    if (/(^|\.)amazon\./i.test(url.hostname)) {
      throw new Error(`amazon.co.jp 以外の Amazon は対象外: ${text}`);
    }
    if (!SHORT_HOSTS.includes(url.hostname.toLowerCase())) {
      throw new Error(`Amazon のURLじゃない: ${text}`);
    }
    // 短縮URLはリダイレクト先を見る（ページ本体は取りにいかない）。転送先も https と正規ホストだけ許す
    const res = await fetchFn(url, { method: 'GET', redirect: 'manual' });
    const location = res.headers.get('location');
    if (!location) throw new Error(`短縮URLの転送先がわからない（HTTP ${res.status}）。商品ページを開いてURLをコピーして: ${text}`);
    url = parseHttpsUrl(new URL(location, url).href, text);
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
  if (!isValidAsin(asin)) throw new Error(`ASIN の形がおかしい: ${asin}`);
  return `https://www.amazon.co.jp/dp/${asin}?tag=${encodeURIComponent(associateTag())}`;
}

module.exports = { resolveAsin, associateTag, productLink, isValidAsin, isAmazonJpHost };
