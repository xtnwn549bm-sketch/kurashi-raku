/**
 * Supabase Storage へのアップロード
 *
 * Instagram API は画像を「公開URL」からしか受け取れないので、
 * 投稿直前に公開バケットへアップロードしてURLを渡す
 */

const fs = require('fs');
const { requireEnv } = require('./config');

function getEnv() {
  const env = requireEnv(['SUPABASE_URL', 'SUPABASE_SECRET_KEY']);
  // 管理画面の REST 用URL（…/rest/v1/）が貼られても動くように、ホスト部分だけ使う
  const SUPABASE_URL = new URL(env.SUPABASE_URL).origin;
  return { ...env, SUPABASE_URL, bucket: process.env.SUPABASE_BUCKET || 'ig-images' };
}

/**
 * ローカルのJPEGをアップロードして公開URLを返す
 * @param {string} localPath
 * @param {string} remotePath - バケット内のパス（例: posts/01_heyaboshi/slide1.jpg）
 * @returns {Promise<string>} 公開URL
 */
async function uploadImage(localPath, remotePath) {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, bucket } = getEnv();
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${remotePath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: fs.readFileSync(localPath),
  });
  if (!res.ok) {
    throw new Error(`Supabase アップロード失敗 (HTTP ${res.status}): ${await res.text()}`);
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${remotePath}`;
  // バケットが公開設定になっていないと Instagram 側で取得エラーになるので先に確かめる
  const check = await fetch(publicUrl, { method: 'HEAD' });
  if (!check.ok) {
    throw new Error(`公開URLにアクセスできない (HTTP ${check.status})。バケット「${bucket}」が Public になっているか確認して: ${publicUrl}`);
  }
  return publicUrl;
}

module.exports = { getEnv, uploadImage };
