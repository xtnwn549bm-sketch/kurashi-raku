/**
 * Instagram の長期アクセストークン（有効期限60日）を更新する
 *
 * 使い方:
 *   node scripts/refresh-token.js           # ローカルの .env を書き換える
 *   node scripts/refresh-token.js --stdout  # 新しいトークンだけを標準出力に出す（GitHub Actions 用）
 */

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { ROOT } = require('../lib/config');
const { refreshAccessToken } = require('../lib/instagram');

const args = minimist(process.argv.slice(2), { boolean: ['stdout'] });

(async () => {
  const { access_token: token, expires_in: expiresIn } = await refreshAccessToken();
  const days = Math.floor(expiresIn / 86400);

  if (args.stdout) {
    process.stdout.write(token);
    console.error(`トークン更新OK（あと${days}日有効）`);
    return;
  }

  const envPath = path.join(ROOT, '.env');
  const env = fs.readFileSync(envPath, 'utf-8');
  fs.writeFileSync(envPath, env.replace(/^IG_ACCESS_TOKEN=.*$/m, `IG_ACCESS_TOKEN=${token}`), 'utf-8');
  console.log(`トークン更新OK（あと${days}日有効）。.env を書き換えた`);
  console.log('GitHub の Secrets（IG_ACCESS_TOKEN）も使ってるなら、そっちも更新してね');
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
