/**
 * Amazon で選んだ商品のURLを登録する（URL → ASIN → アソシエイトリンク）
 *
 * 使い方:
 *   node scripts/links.js --post 01_heyaboshi <URL1> <URL2> <URL3> <URL4> <URL5>   # 1〜5番を順に登録
 *   node scripts/links.js --post 01_heyaboshi --item 3 <URL>                        # 3番だけ登録し直す
 *   node scripts/links.js --post 01_heyaboshi                                       # 登録状況を表示
 *
 * URL は商品ページのURL、スマホアプリの「共有」で出る短縮URL（amzn.asia）、SiteStripe の短縮URL（amzn.to）、ASIN のどれでもOK
 */

const minimist = require('minimist');
const { loadPost, savePost } = require('../lib/posts');
const { resolveAsin, productLink } = require('../lib/amazon');

const args = minimist(process.argv.slice(2), { string: ['post', 'item', '_'] });

function printStatus(post) {
  post.products.forEach((p, i) => {
    const link = p.asin ? productLink(p.asin) : '（未登録）';
    console.log(`${String(i + 1).padStart(2, '0')} ${p.shortName || p.keyword}: ${link}`);
  });
  const rest = post.products.filter((p) => !p.asin).length;
  console.log(rest === 0 ? '\n全部そろった！' : `\nあと${rest}個`);
}

(async () => {
  if (!args.post) {
    console.error('--post <id> を指定して');
    process.exit(1);
  }
  const post = loadPost(args.post);
  const urls = args._.map(String);

  if (urls.length > 0) {
    const start = args.item ? Number(args.item) - 1 : 0;
    if (args.item && urls.length !== 1) throw new Error('--item を使うときはURLを1つだけ');
    if (start < 0 || start + urls.length > post.products.length) {
      throw new Error(`商品は${post.products.length}個まで（${start + urls.length}個目を指定してる）`);
    }
    for (const [offset, url] of urls.entries()) {
      const product = post.products[start + offset];
      product.asin = await resolveAsin(url);
      console.log(`✓ ${String(start + offset + 1).padStart(2, '0')} ${product.shortName}: ${product.asin}`);
    }
    savePost(post);
    console.log('');
  }
  printStatus(post);
})().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
