/**
 * 投稿データ → スライドごとの画像生成プロンプト
 *
 * スライド構成: 1枚目=表紙 / 2〜6枚目=商品1つずつ（選ぶときのチェックポイント） / 最後=保存・ストアフロント誘導
 * 価格・星評価は載せない（Amazonの規約でレビュー・星評価の表示は Creators API 経由以外禁止、古い価格の掲載も禁止）
 * 「PR｜AIにより作成」とアカウント名は lib/label.js があとから焼き込むので、プロンプトでは描かせない
 */

function styleGuide() {
  return `Instagramのカルーセル投稿に使う、縦長（4:5）のグラフィックを1枚作ってください。

## デザインルール（全スライド共通）
- 背景はあたたかみのあるオフホワイト（#FAF7F2）。アクセントカラーはセージグリーン（#7F9C7A）とやわらかいテラコッタ（#D98B5F）
- やさしいフラットイラスト調。写真・実写風・3Dレンダリング風にはしない
- 日本語の文字は太めの丸ゴシック体で大きく書く。「」で指定した文字列だけを一字一句正確に書き、それ以外の文字は入れない
- 余白を広くとり、スマホの小さい画面でも読める文字サイズにする
- 実在するブランドのロゴや、商品パッケージの文字は描かない。イラストは特定メーカーの製品に似せない
- 価格・星マーク・評価の数字は描かない
- 画像の一番下の帯（下から8%の高さ）は、左右とも文字もイラストも置かずに背景色のまま空けておく
`;
}

function coverPrompt(post) {
  return `${styleGuide()}
## このスライド（表紙）
- 上部に小さなラベル「保存版」
- 中央に大きなタイトル「${post.cover.title}」
- タイトルの下にサブタイトル「${post.cover.subtitle}」
- 下半分に、テーマ（${post.angle}）が伝わるやさしいイラスト
- 右端に「スワイプ →」の小さな表示
`;
}

function productPrompt(post, product, index) {
  const no = String(index + 1).padStart(2, '0');
  const points = product.points.map((p) => `  - 「${p}」`).join('\n');
  return `${styleGuide()}
## このスライド（アイテム紹介 ${no}）
- 左上に番号バッジ「${no}」
- 上部にアイテムの呼び名「${product.shortName}」を大きく
- 中央にイラスト: ${product.illustration}
- イラストの下に小見出し「選ぶときのチェックポイント」
- その下に、チェックマーク付きの箇条書きで3つ:
${points}
- 箇条書きの下に小さく「選んだ商品はプロフのリンクから」
`;
}

function ctaPrompt(post) {
  return `${styleGuide()}
## このスライド（最後のまとめ）
- 中央に大きく「${post.cta.headline}」
- その下に「紹介したアイテムは」「プロフィールのリンク（Amazon）の」「『${post.listName}』リストにまとめてるよ」の3行
- 下部に、しおり（保存）アイコンのイラストと「あとで見返せるように保存してね」
`;
}

/** 投稿のスライド一覧（プロンプト付き） */
function buildSlides(post) {
  return [
    { kind: 'cover', prompt: coverPrompt(post) },
    ...post.products.map((product, i) => ({ kind: `product${i + 1}`, prompt: productPrompt(post, product, i) })),
    { kind: 'cta', prompt: ctaPrompt(post) },
  ];
}

/** 画像生成に必要な文言がそろっているか。足りない項目名を返す */
function missingTextFields(post) {
  const missing = [];
  if (!post.cover || !post.cover.title || !post.cover.subtitle) missing.push('cover.title / cover.subtitle');
  if (!post.cta || !post.cta.headline) missing.push('cta.headline');
  post.products.forEach((p, i) => {
    if (!p.shortName || !p.illustration || !p.points || p.points.length !== 3) {
      missing.push(`products[${i}] の shortName / illustration / points(3つ)`);
    }
  });
  return missing;
}

module.exports = { buildSlides, missingTextFields };
