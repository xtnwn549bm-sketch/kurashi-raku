/**
 * 投稿一覧の「次にやること」の判定。
 *
 * 人が読む文字列（status.js の既存出力）と、Hermes などが読む JSON（--json）が
 * 同じ判定を共有するようにしておく。文言を二重管理すると食い違うので。
 *
 * nextAction.code は Hermes が次に何をすべきか判断するための閉じじた集合。
 * blockedBy が 'user' の code は、人が実行する操作なので自動では進めない。
 */

const fs = require('fs');
const { slidePath } = require('./posts');
const { slideCount } = require('./slides');
const { contentProblems, publishProblems } = require('./checks');
const { isValidAsin } = require('./amazon');

const SCHEMA_VERSION = 1;

const no = (i) => String(i + 1).padStart(2, '0');

/** 投稿ごとの「次にやること」（人が読む文言。status.js の出力はここをそのまま使う） */
function nextAction(post) {
  if (post.status === 'draft') return '文言を書く（Claude に「draft の文言を書いて」と頼む）';
  if (post.status === 'publishing') {
    return '⚠ 投稿結果が不明。Instagram を確認して --resolve <id> --published <URL> か --not-published（docs/operations.md）';
  }
  if (post.status === 'published') {
    const notes = [];
    const held = post.products.map((p, i) => (isValidAsin(p.asin) ? null : i + 1)).filter(Boolean);
    if (held.length > 0) {
      notes.push(`リンク保留 ${held.map((n) => no(n - 1)).join(', ')}：条件を満たす商品を確認して npm run links -- --post ${post.id} --item ${held[0]} <URL>`);
    }
    const unchecked = post.products
      .map((p, i) => (p.review && ['unverified', 'partial'].includes(p.review.result) ? no(i) : null)).filter(Boolean);
    if (unchecked.length > 0) notes.push(`チェックポイントを確認しきれていない商品 ${unchecked.join(', ')}（post.json の review を見て、Amazon の商品ページで確認）`);
    return notes.join('\n           → ');
  }
  if (post.status === 'ready') {
    const problems = publishProblems(post);
    return problems.length > 0 ? `⚠ このままだと公開されない: ${problems[0]}` : '投稿待ち（自動投稿で順番に公開される）';
  }
  // written
  const missingSlides = Array.from({ length: slideCount(post) }, (_, i) => i).filter((i) => !fs.existsSync(slidePath(post.id, i)));
  if (missingSlides.length > 0) return `スライドを作る: npm run images -- --post ${post.id}`;
  const noLink = post.products.filter((p) => !isValidAsin(p.asin)).length;
  if (noLink > 0) return `商品を選んでURLを登録（あと${noLink}個）: docs/picks-checklist.md → npm run links -- --post ${post.id} URL…`;
  return `確認して承認: npm run status -- --approve ${post.id}`;
}

/**
 * 「次にやること」を機械可読にする。
 * blockedBy: 'user' なら人が実行する操作（Hermes などは自動で進めない）
 * @returns {{code: string, blockedBy: string, command: (string|null)}}
 */
function nextActionCode(post) {
  if (post.status === 'draft') return { code: 'write_copy', blockedBy: 'none', command: null };

  if (post.status === 'publishing') {
    return { code: 'resolve_unknown', blockedBy: 'user', command: `npm run status -- --resolve ${post.id} --published <URL>` };
  }

  if (post.status === 'published') {
    const held = post.products.filter((p) => !isValidAsin(p.asin));
    if (held.length > 0) {
      return { code: 'replace_held_link', blockedBy: 'user', command: `npm run links -- --post ${post.id} --item ${post.products.indexOf(held[0]) + 1} <URL>` };
    }
    const unchecked = post.products.filter((p) => p.review && ['unverified', 'partial'].includes(p.review.result));
    if (unchecked.length > 0) return { code: 'verify_checkpoints', blockedBy: 'user', command: null };
    return { code: 'nothing', blockedBy: 'none', command: null };
  }

  if (post.status === 'ready') {
    const problems = publishProblems(post);
    // 承認後に中身が変わった／承認の記録がない → 承認し直し（人がやる）
    if (problems.length > 0) return { code: 'reapprove', blockedBy: 'user', command: `npm run status -- --approve ${post.id}` };
    return { code: 'wait_publish', blockedBy: 'none', command: null };
  }

  // written
  const missingSlides = Array.from({ length: slideCount(post) }, (_, i) => i)
    .filter((i) => !fs.existsSync(slidePath(post.id, i)));
  if (missingSlides.length > 0) {
    return { code: 'generate_slides', blockedBy: 'none', command: `npm run images -- --post ${post.id}` };
  }
  const noLink = post.products.filter((p) => !isValidAsin(p.asin)).length;
  if (noLink > 0) {
    return { code: 'pick_products', blockedBy: 'user', command: `npm run links -- --post ${post.id} URL…` };
  }
  return { code: 'approve', blockedBy: 'user', command: `npm run status -- --approve ${post.id}` };
}

/** 1投稿ぶんのJSON */
function postReport(post) {
  const action = nextActionCode(post);
  const slides = Array.from({ length: slideCount(post) }, (_, i) => fs.existsSync(slidePath(post.id, i)));
  const approved = Boolean(post.approval && post.approval.fingerprint);

  return {
    id: post.id,
    title: post.title,
    status: post.status,
    slideCount: slides.length,
    slidesPresent: slides.filter(Boolean).length,
    products: {
      total: post.products.length,
      linked: post.products.filter((p) => isValidAsin(p.asin)).length,
      missingItems: post.products.map((p, i) => (isValidAsin(p.asin) ? null : no(i))).filter(Boolean),
      heldItems: post.products.map((p, i) => (p.linkHold && !isValidAsin(p.asin) ? no(i) : null)).filter(Boolean),
      items: post.products.map((p, i) => ({
        index: i + 1,
        shortName: p.shortName || null,
        keyword: p.keyword,
        asin: p.asin || null,
        linked: isValidAsin(p.asin),
        linkHold: p.linkHold || null,
        rejectedAsins: (p.rejectedAsins || []).map((r) => ({ asin: r.asin, reason: r.reason })),
        review: (p.review && p.review.result) || null,
      })),
    },
    approval: {
      approved,
      approvedAt: (post.approval && post.approval.approvedAt) || null,
      // 承認があるときだけ、承認時到现在の中身が変わっていないか
      fingerprintMatch: approved ? publishProblems(post).every((p) => !p.includes('承認')) : null,
    },
    publishAttempt: post.publishAttempt ? {
      phase: post.publishAttempt.phase || null,
      startedAt: post.publishAttempt.startedAt || null,
      error: post.publishAttempt.error || null,
    } : null,
    lastPublishError: post.lastPublishError || null,
    problems: {
      content: contentProblems(post),
      publish: post.status === 'ready' || post.status === 'publishing' ? publishProblems(post) : [],
    },
    nextAction: {
      code: action.code,
      blockedBy: action.blockedBy,
      command: action.command,
      text: nextAction(post),
    },
    publishedAt: post.publishedAt || null,
    permalink: post.permalink || null,
    mediaId: post.mediaId || null,
  };
}

/** 全投稿ぶんのJSON（--json の出力） */
function buildReport(posts) {
  const reports = posts.map(postReport);
  const counts = {};
  for (const post of posts) counts[post.status] = (counts[post.status] || 0) + 1;

  const publishingIds = posts.filter((p) => p.status === 'publishing').map((p) => p.id);
  const readyStock = posts.filter((p) => p.status === 'ready' && publishProblems(p).length === 0).length;

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    counts,
    readyStock,
    readyStockWarn: readyStock < 3,
    publishingUnresolved: publishingIds,
    autoPublishBlocked: publishingIds.length > 0,
    posts: reports,
  };
}

module.exports = { SCHEMA_VERSION, no, nextAction, nextActionCode, postReport, buildReport };