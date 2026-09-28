/**
 * 投稿データ（posts/<id>/post.json）の読み書き
 *
 * status の流れ: draft（商品スロットだけ）→ written（文言済み）→ ready（画像・ストアフロント確認済み）→ published
 */

const fs = require('fs');
const path = require('path');
const { POSTS_DIR, readJson, writeJson, loadAccount } = require('./config');

// キャプション1行目（「…続きを読む」で隠れない位置）。ステマ規制の #PR と、Amazonアソシエイトの AI 利用表記
const CAPTION_HEADER = '#PR｜画像・文章はAIにより作成';

function postDir(id) {
  return path.join(POSTS_DIR, id);
}

function loadPost(id) {
  return readJson(path.join(postDir(id), 'post.json'));
}

function savePost(post) {
  writeJson(path.join(postDir(post.id), 'post.json'), post);
}

/** 全投稿をフォルダ名順（=投稿順）で返す */
function listPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(POSTS_DIR, d.name, 'post.json')))
    .map((d) => d.name)
    .sort()
    .map(loadPost);
}

function slidePath(postId, index) {
  return path.join(postDir(postId), `slide${index + 1}.jpg`);
}

/** Amazonアソシエイト・プログラム運営規約 第5条の開示文 */
function associateDisclosure() {
  const { name } = loadAccount();
  if (!name) throw new Error('content/account.json の name が空（開示文に入れるアカウント名）');
  return `Amazonのアソシエイトとして、${name}は適格販売により収入を得ています。`;
}

/**
 * Instagram に載せるキャプション全文
 * 1行目の表記・開示文・ハッシュタグはここで付けるので、post.caption には本文だけを書く
 */
function buildCaption(post) {
  const tags = (post.hashtags || []).map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
  return [CAPTION_HEADER, post.caption.trim(), associateDisclosure(), tags].filter(Boolean).join('\n\n');
}

module.exports = { CAPTION_HEADER, postDir, loadPost, savePost, listPosts, slidePath, associateDisclosure, buildCaption };
