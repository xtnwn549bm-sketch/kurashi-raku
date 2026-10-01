/**
 * 投稿してよいかのチェック（承認時と公開直前の両方で使う）と、承認の指紋
 *
 * 承認（status --approve）のとき、文章・商品リンク・スライド画像・トラッキングIDから指紋を作って保存する。
 * 公開直前に指紋を作り直し、違っていれば「承認後に中身が変わった」として公開しない
 */

const fs = require('fs');
const crypto = require('crypto');
const { loadAccount } = require('./config');
const { CAPTION_HEADER, slidePath, buildCaption } = require('./posts');
const { slideCount, missingTextFields } = require('./slides');
const { findViolations } = require('./compliance');
const { associateTag, isValidAsin } = require('./amazon');

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const no = (i) => String(i + 1).padStart(2, '0');

/**
 * 中身のチェック（状態は見ない）。問題点の一覧を返す（空ならOK）
 */
function contentProblems(post) {
  const problems = [];
  if (!post.caption || !post.caption.trim()) problems.push('キャプションの本文が空');
  problems.push(...missingTextFields(post).map((m) => `文言が足りない: ${m}`));
  problems.push(...findViolations(post));

  for (let i = 0; i < slideCount(post); i += 1) {
    if (!fs.existsSync(slidePath(post.id, i))) problems.push(`slide${i + 1}.jpg がない`);
  }

  const noLink = post.products.map((p, i) => (isValidAsin(p.asin) ? null : no(i))).filter(Boolean);
  if (noLink.length > 0) problems.push(`商品URLが未登録か形がおかしい: ${noLink.join(', ')}（npm run links で登録）`);

  try {
    associateTag();
  } catch (err) {
    problems.push(err.message);
  }
  try {
    if (!buildCaption(post).startsWith(CAPTION_HEADER)) problems.push('キャプション1行目の #PR・AI表記がない');
  } catch (err) {
    problems.push(err.message);
  }
  return problems;
}

/**
 * 承認の指紋。投稿される文章・商品リンク・画像・トラッキングIDのどれかが変わると値が変わる
 */
function approvalFingerprint(post) {
  const slides = [];
  for (let i = 0; i < slideCount(post); i += 1) {
    const file = slidePath(post.id, i);
    slides.push(fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null);
  }
  let caption = null;
  try {
    caption = buildCaption(post);
  } catch {
    // 開示文の名前がないなど。contentProblems 側で引っかかる
  }
  return sha256(JSON.stringify({
    title: post.title,
    listName: post.listName,
    cover: post.cover,
    cta: post.cta,
    caption,
    products: post.products.map((p) => ({ shortName: p.shortName, points: p.points, asin: p.asin })),
    associateTag: loadAccount().associateTag || null,
    slides,
  }));
}

/**
 * 公開直前のチェック。承認済み（ready）で、承認後に中身が変わっていないこと
 */
function publishProblems(post) {
  const problems = [];
  if (post.status !== 'ready') problems.push(`status が ready じゃない（今: ${post.status}）`);
  problems.push(...contentProblems(post));
  if (!post.approval || !post.approval.fingerprint) {
    problems.push('承認の記録がない。npm run status -- --approve で承認し直して');
  } else if (post.approval.fingerprint !== approvalFingerprint(post)) {
    problems.push('承認後に文章・商品リンク・画像・トラッキングIDのどれかが変わった。確認して npm run status -- --approve で承認し直して');
  }
  return problems;
}

module.exports = { contentProblems, approvalFingerprint, publishProblems };
