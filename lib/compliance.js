/**
 * 投稿の文言が Amazonアソシエイトの規約・ステマ規制に引っかからないかのチェック
 *
 * status --approve と publish の両方で使う。1つでも引っかかったら投稿しない
 */

const RULES = [
  {
    pattern: /[¥￥]|[0-9０-９][0-9０-９,，]*\s*円|円台|税込|送料/,
    reason: '価格・送料は書かない（Amazonの価格はすぐ変わり、古い価格の掲載は規約違反）',
  },
  {
    pattern: /[★☆]|星\s*[0-9０-９]|(評価|レビュー|口コミ)\s*[0-9０-９]|[0-9０-９][0-9０-９,，]*\s*件|高評価|ベストセラー|ランキング|[0-9０-９]+\s*位/,
    reason: 'レビュー・星評価・順位は書かない（Creators API 経由以外の表示は規約違反）',
  },
  {
    pattern: /最安|No\.?\s*1|ナンバーワン|日本一|業界初|必ず|絶対|100\s*[%％]|完璧/i,
    reason: '断定・誇大表現は使わない',
  },
  {
    pattern: /使ってみた|使ってる|使っています|愛用|買ってよかった|購入品|リピ|実際に使/,
    reason: '使っていない商品の体験談にあたる表現は使わない',
  },
  {
    pattern: /(Amazon|アマゾン)\s*(公式|認定|推奨|おすすめ)/i,
    reason: 'Amazon公式・Amazonのおすすめと誤解される表現は使わない',
  },
  {
    pattern: /プライム対象|翌日(配送|着|届)|お急ぎ便|即日/,
    reason: '配送条件は商品ごとに変わるので書かない',
  },
];

const MAX_HASHTAGS = 5;
// キャプションは全体で2,200文字まで。1行目の表記・開示文・タグのぶんを残しておく
const MAX_CAPTION_BODY = 1800;

/** チェック対象の文言を [項目名, 文字列] の一覧にする */
function textFields(post) {
  const fields = [
    ['title', post.title],
    ['listName', post.listName],
    ['cover.title', post.cover && post.cover.title],
    ['cover.subtitle', post.cover && post.cover.subtitle],
    ['cta.headline', post.cta && post.cta.headline],
    ['caption', post.caption],
    ...(post.hashtags || []).map((tag, i) => [`hashtags[${i}]`, tag]),
  ];
  (post.products || []).forEach((p, i) => {
    fields.push([`products[${i}].shortName`, p.shortName]);
    (p.points || []).forEach((point, j) => fields.push([`products[${i}].points[${j}]`, point]));
  });
  return fields.filter(([, text]) => typeof text === 'string' && text.length > 0);
}

/**
 * 規約違反になりそうな箇所の一覧を返す（空配列ならOK）
 * @returns {string[]}
 */
function findViolations(post) {
  const problems = [];
  for (const [field, text] of textFields(post)) {
    for (const rule of RULES) {
      const match = text.match(rule.pattern);
      if (match) problems.push(`${field}: 「${match[0]}」→ ${rule.reason}`);
    }
  }

  const caption = post.caption || '';
  if (/#PR|AIにより作成/.test(caption)) {
    problems.push('caption: #PR・AI表記は自動で1行目に付くので本文には書かない');
  }
  if (/アソシエイトとして/.test(caption)) {
    problems.push('caption: アソシエイトの開示文は自動で末尾に付くので本文には書かない');
  }
  if (caption.length > MAX_CAPTION_BODY) {
    problems.push(`caption: 本文が長すぎる（${caption.length}文字 / 上限${MAX_CAPTION_BODY}文字）`);
  }

  const hashtags = post.hashtags || [];
  if (hashtags.length > MAX_HASHTAGS) problems.push(`hashtags: ${MAX_HASHTAGS}個まで（今は${hashtags.length}個）`);
  hashtags.filter((t) => /\s/.test(t)).forEach((t) => problems.push(`hashtags: 「${t}」に空白が入ってる`));

  return problems;
}

module.exports = { findViolations };
