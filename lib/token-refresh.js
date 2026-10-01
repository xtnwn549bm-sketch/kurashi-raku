/**
 * Instagram トークン更新の安全な保存
 *
 * 更新に成功し、新しいトークンが空でなく形もおかしくないと確認できたときだけ保存する。
 * 失敗したら保存処理を一切呼ばないので、既存の値（.env / GitHub Secret）は空で上書きされない
 */

// トークンは英数字と一部の記号だけ。空白・改行が混じるものや短すぎるものは保存しない
const TOKEN_PATTERN = /^[A-Za-z0-9._|-]{20,}$/;

function isUsableToken(token) {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

/**
 * @param {Object} deps
 * @param {Function} deps.refresh - () => Promise<{ access_token, expires_in }>
 * @param {Function} deps.store - (token) => Promise<void> | void。トークンを保存する
 * @returns {Promise<{ expiresIn: number }>}
 */
async function refreshAndStore({ refresh, store }) {
  const result = await refresh();
  const token = result && result.access_token;
  if (!isUsableToken(token)) {
    throw new Error('新しいトークンが空か形がおかしいので保存しない（今のトークンはそのまま）');
  }
  await store(token);
  return { expiresIn: Number(result.expires_in) || 0 };
}

module.exports = { refreshAndStore, isUsableToken };
