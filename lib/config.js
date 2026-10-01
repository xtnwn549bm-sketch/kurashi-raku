/**
 * 共通設定: .env の読み込みとパス定義
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// テストでは本物の .env（キー類）を読まない
if (process.env.SKIP_DOTENV !== '1') require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });

// テストでは一時フォルダに差し替える
const POSTS_DIR = process.env.POSTS_DIR || path.join(ROOT, 'posts');
const CONTENT_DIR = process.env.CONTENT_DIR || path.join(ROOT, 'content');

/**
 * 必須の環境変数を取得。未設定があればまとめてエラーにする
 * @param {string[]} names - 環境変数名
 * @returns {Object} 名前→値
 */
function requireEnv(names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length > 0) {
    throw new Error(`.env に未設定の項目があるよ: ${missing.join(', ')}（docs/setup-guide.md 参照）`);
  }
  return Object.fromEntries(names.map((n) => [n, process.env[n]]));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** content/account.json（アカウント名・ハンドル・ストアフロントURL） */
function loadAccount() {
  return readJson(path.join(CONTENT_DIR, 'account.json'));
}

module.exports = { ROOT, POSTS_DIR, CONTENT_DIR, requireEnv, readJson, writeJson, sleep, loadAccount };
