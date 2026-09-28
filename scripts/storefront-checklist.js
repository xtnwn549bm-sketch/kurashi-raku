/**
 * Amazonストアフロントのアイデアリストに入れる商品のチェックリスト（docs/storefront-checklist.md）を作る
 *
 * ストアフロントには公開APIがないので登録は手作業。
 * 投稿と同じ名前のアイデアリストを作ると、インスタ → プロフのリンク → リスト の導線がつながる。
 * スライドには「選ぶときのチェックポイント」しか書いていないので、3つとも満たす商品を選べばスライドと食い違わない
 *
 * 使い方: npm run storefront
 */

const fs = require('fs');
const path = require('path');
const { ROOT, loadAccount } = require('../lib/config');
const { listPosts } = require('../lib/posts');

const account = loadAccount();
const pending = listPosts().filter((p) => !p.storefrontDone);
const posts = pending.filter((p) => p.status !== 'draft');
const drafts = pending.filter((p) => p.status === 'draft');

const yen = (n) => `${Number(n).toLocaleString('ja-JP')}円`;

const lines = [
  '# Amazonストアフロント 登録チェックリスト',
  '',
  `生成日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
  `ストアフロント: ${account.storefrontUrl || '（content/account.json の storefrontUrl が未設定）'}`,
  '',
  '## やり方',
  '1. ストアフロントの編集画面で「アイデアリストを作成」',
  '2. リスト名は下の「リスト名」と**完全に同じ**にする（インスタの投稿を見た人が探せるように）',
  '3. 説明文は下の「リストの説明文」をコピペ',
  '4. 各アイテムの「Amazonで探す」を開いて、チェックポイントを**3つとも満たす**商品を1つ選んでリストに追加',
  '5. 公開したら post.json の `"storefrontDone"` を `true` にする（リストのURLを `"listUrl"` に入れておくとストーリーズで使える）',
  '',
  '## 商品の選び方（投稿には書かない。選ぶときの基準）',
  '- 評価が高く、レビューの数も多いもの（目安: ★4.0以上・レビュー数百件以上）',
  '- 「スポンサー」表示の広告枠ではなく、ふつうの検索結果から選ぶ',
  '- 販売元が Amazon かメーカー公式、または評価の高い出品者',
  '- 価格はテーマの目安の範囲内',
  '- 同じ商品ページの色違い・サイズ違いは1つのリストに1つまで（アイデアリストの仕様）',
  '- 自分で買ってもこちらの紹介料にはならないので、動作確認のための購入はしない',
  '',
];

for (const post of posts) {
  const range = post.priceRange ? `${yen(post.priceRange.min)}〜${yen(post.priceRange.max)}` : '指定なし';
  lines.push(
    `## ${post.id}（status: ${post.status}）`,
    '',
    `- リスト名: **${post.listName}**`,
    '- リストの説明文:',
    `  > インスタの投稿「${post.title}」で紹介したアイテムです。選ぶときのチェックポイントは投稿で図解しています。（この説明文はAIにより作成）`,
    `- 価格の目安: ${range}`,
    '',
  );
  post.products.forEach((p, i) => {
    lines.push(
      `- [ ] ${String(i + 1).padStart(2, '0')} ${p.shortName || p.keyword}`,
      `  - チェックポイント: ${(p.points || []).join(' ／ ') || '（未作成）'}`,
      `  - Amazonで探す: https://www.amazon.co.jp/s?k=${encodeURIComponent(p.keyword)}`,
    );
  });
  lines.push('');
}

if (drafts.length > 0) {
  lines.push(`> 文言がまだの下書き（${drafts.map((p) => p.id).join(', ')}）はチェックポイントが決まってないので載せてない`, '');
}

const outPath = path.join(ROOT, 'docs', 'storefront-checklist.md');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
console.log(`保存: docs/storefront-checklist.md（${posts.length}投稿ぶん${drafts.length ? ` / 下書き${drafts.length}本は対象外` : ''}）`);
