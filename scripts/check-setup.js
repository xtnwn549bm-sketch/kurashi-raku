/**
 * .env と content/account.json の設定が正しいか、各サービスに実際につないで確認する
 *
 * 使い方: npm run check
 */

const { loadAccount } = require('../lib/config');
const { associateDisclosure } = require('../lib/posts');
const { findFont } = require('../lib/label');
const instagram = require('../lib/instagram');

const checks = [
  {
    name: 'アカウント設定（content/account.json）',
    run: async () => {
      const account = loadAccount();
      if (!account.handle || !account.handle.startsWith('@')) throw new Error('handle を「@ユーザーネーム」の形で入れて');
      if (!/^https:\/\/www\.amazon\.co\.jp\/shop\/[^/\s]+/.test(account.storefrontUrl || '')) {
        throw new Error('storefrontUrl に ストアフロントのURL（https://www.amazon.co.jp/shop/...）を入れて');
      }
      return `OK: ${account.handle} / 開示文「${associateDisclosure()}」`;
    },
  },
  {
    name: 'ラベル用フォント',
    run: async () => `OK: ${findFont().file}`,
  },
  {
    name: 'Gemini（APIキーの有無）',
    run: async () => {
      if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY が未設定');
      return `設定あり（モデル: ${process.env.NANOBANANA_MODEL || 'gemini-3-pro-image-preview'}）※実際の生成は npm run images で確認`;
    },
  },
  {
    name: 'Supabase Storage（バケット）',
    run: async () => {
      const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
      const bucket = process.env.SUPABASE_BUCKET || 'ig-images';
      if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY が未設定');
      const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${bucket}`, {
        headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` },
      });
      if (!res.ok) throw new Error(`バケット「${bucket}」を取得できない (HTTP ${res.status}): ${await res.text()}`);
      const info = await res.json();
      if (!info.public) throw new Error(`バケット「${bucket}」が Public になってない`);
      return `OK: バケット「${bucket}」は Public`;
    },
  },
  {
    name: 'Instagram API',
    run: async () => {
      const me = await instagram.getMe();
      if (!process.env.IG_USER_ID) {
        throw new Error(`トークンはOK（@${me.username}）。.env の IG_USER_ID に ${me.user_id} を入れて`);
      }
      if (String(me.user_id) !== String(process.env.IG_USER_ID)) {
        throw new Error(`IG_USER_ID が違う。正しくは ${me.user_id}`);
      }
      const { handle } = loadAccount();
      const handleNote = handle && handle !== `@${me.username}` ? `（account.json の handle は ${handle} になってる。合わせて）` : '';
      const limit = await instagram.getPublishingLimit();
      return `OK: @${me.username}（${me.account_type}）/ 直近24時間の投稿数 ${limit ? limit.quota_usage : '?'}${handleNote}`;
    },
  },
];

(async () => {
  let failed = 0;
  for (const check of checks) {
    try {
      console.log(`✅ ${check.name}: ${await check.run()}`);
    } catch (err) {
      failed += 1;
      console.log(`❌ ${check.name}: ${err.message}`);
    }
  }
  console.log(failed === 0 ? '\nぜんぶOK！' : `\n${failed}件エラーあり。docs/setup-guide.md を見直してね`);
  process.exit(failed === 0 ? 0 : 1);
})();
