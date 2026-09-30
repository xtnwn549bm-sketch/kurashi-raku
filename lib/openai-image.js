/**
 * OpenAI Image API（POST /v1/images/generations）でイラストを1枚作る
 *
 * ChatGPT のサブスクとは別の従量課金（platform.openai.com で前払い）。
 * GPT Image モデルは「API組織の本人確認（Organization Verification）」を済ませないと使えない
 * 仕様: https://developers.openai.com/api/docs/guides/image-generation
 */

const { requireEnv } = require('./config');

const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'medium';
const API_BASE = 'https://api.openai.com/v1';

function authHeaders() {
  const { OPENAI_API_KEY } = requireEnv(['OPENAI_API_KEY']);
  return { Authorization: `Bearer ${OPENAI_API_KEY}` };
}

function explain(status, body) {
  const message = (body && body.error && body.error.message) || `HTTP ${status}`;
  let hint = '';
  if (/verif/i.test(message)) hint = '（OpenAI の組織の本人確認がまだかも。docs/setup-guide.md の手順3を見て）';
  else if (status === 401) hint = '（OPENAI_API_KEY が違うか無効）';
  else if (status === 429 || /quota|billing|credit/i.test(message)) hint = '（残高切れか上限。platform.openai.com の Billing を確認して）';
  return `OpenAI 画像生成エラー (HTTP ${status}): ${message}${hint}`;
}

/**
 * @param {string} prompt
 * @returns {Promise<Buffer>} PNG（1024x1024）
 */
async function generateIllustration(prompt) {
  const res = await fetch(`${API_BASE}/images/generations`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, size: '1024x1024', quality: QUALITY, output_format: 'png', n: 1 }),
    signal: AbortSignal.timeout(300000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(explain(res.status, body));
  const b64 = body && body.data && body.data[0] && body.data[0].b64_json;
  if (!b64) throw new Error(`画像が返ってこなかった（model: ${MODEL}）`);
  return Buffer.from(b64, 'base64');
}

/** APIキーでモデルにアクセスできるか（check-setup 用。画像は作らないので料金はかからない） */
async function checkModelAccess() {
  const res = await fetch(`${API_BASE}/models/${MODEL}`, { headers: authHeaders() });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(explain(res.status, body));
  return MODEL;
}

module.exports = { MODEL, QUALITY, generateIllustration, checkModelAccess };
