/**
 * content/themes.json のテーマごとに posts/<id>/post.json の下書きを作る
 *
 * Creators API は「直近30日で適格販売10件」を満たすまで使えないので、ここでは商品を決めない。
 * keywords 1つ = 商品スライド1枚のスロットだけ作り、文言は Claude が書く（CLAUDE.md のルール）。
 * 実際の商品は、書いたチェックポイントを満たすものをユーザーが Amazon で選んで npm run links で登録する
 *
 * 使い方:
 *   node scripts/build-posts.js --all
 *   node scripts/build-posts.js --theme 01_heyaboshi [--force]
 */

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { CONTENT_DIR, readJson } = require('../lib/config');
const { postDir, loadPost, savePost } = require('../lib/posts');

const args = minimist(process.argv.slice(2), { boolean: ['all', 'force'], string: ['theme'] });

function buildPost(theme) {
  const exists = fs.existsSync(path.join(postDir(theme.id), 'post.json'));
  if (exists && !args.force) {
    const current = loadPost(theme.id);
    console.log(`- ${theme.id}: すでにある（status: ${current.status}）ので飛ばす。作り直すなら --force`);
    return;
  }

  savePost({
    id: theme.id,
    title: theme.title,
    listName: theme.listName,
    angle: theme.angle,
    status: 'draft',
    // Amazon で商品を選ぶときの目安（投稿には出さない）
    priceRange: { min: theme.minPrice, max: theme.maxPrice },
    cover: { title: theme.title, subtitle: '' },
    products: theme.keywords.map((keyword) => ({ keyword, shortName: '', points: [], illustration: '', asin: '' })),
    cta: { headline: '' },
    caption: '',
    hashtags: [],
  });
  console.log(`✓ ${theme.id}「${theme.title}」→ posts/${theme.id}/post.json（${theme.keywords.length}スロット）`);
}

const { themes } = readJson(path.join(CONTENT_DIR, 'themes.json'));
const targets = args.all ? themes : themes.filter((t) => [].concat(args.theme || []).includes(t.id));
if (targets.length === 0) {
  console.error('対象テーマがない。--all か --theme <id> を指定して');
  process.exit(1);
}
targets.forEach(buildPost);
