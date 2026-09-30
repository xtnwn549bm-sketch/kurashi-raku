/**
 * スライドに入れるイラスト（文字なし・正方形）のプロンプトと保存先
 *
 * 1投稿あたり 表紙1枚＋アイテム5枚。まとめスライドはイラストなし。
 * 文字はプログラムで描くので、AIには絶対に文字を描かせない
 */

const path = require('path');
const { postDir } = require('./posts');

const STYLE = `Instagram投稿のスライドに入れる、正方形のイラストを1枚描いてください。

## スタイル
- やさしいフラットイラスト。写真風・実写風・3Dレンダリング風にはしない
- 背景は無地のオフホワイト（#FAF7F2）。影はうすく控えめに
- 色はセージグリーン（#7F9C7A）、やわらかいテラコッタ（#D98B5F）、ベージュ、白を中心に
- 主題を中央に大きく描き、まわりに少し余白をとる
- 文字・数字・ロゴ・ラベル・値札・パッケージの表記は一切描かない（No text, no letters, no numbers, no logos）
- 実在するブランドや特定メーカーの製品に似せず、一般的な形で描く
- 人物を描くときは顔を簡略化する
`;

/**
 * 投稿に必要なイラストの一覧
 * @returns {{ key: string, prompt: string }[]} key は cover / item1〜item5
 */
function illustrationJobs(post) {
  return [
    {
      key: 'cover',
      prompt: `${STYLE}
## 描くもの
「${post.title}」という投稿の表紙。テーマ: ${post.angle}
テーマのアイテムがすっきり使われている、暮らしのワンシーン
`,
    },
    ...post.products.map((product, i) => ({
      key: `item${i + 1}`,
      prompt: `${STYLE}
## 描くもの
${product.illustration}
`,
    })),
  ];
}

function illustrationPath(postId, key) {
  return path.join(postDir(postId), 'illust', `${key}.png`);
}

module.exports = { illustrationJobs, illustrationPath };
