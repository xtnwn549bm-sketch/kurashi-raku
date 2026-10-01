/**
 * Instagram の長期アクセストークン（有効期限60日）を更新する
 *
 * 新しいトークンを確認できたときだけ保存する（lib/token-refresh.js）。トークンの値は画面にもログにも出さない
 *
 * 使い方:
 *   node scripts/refresh-token.js                                              # ローカルの .env を書き換える
 *   node scripts/refresh-token.js --github-secret IG_ACCESS_TOKEN --repo o/r   # GitHub Secret を書き換える（Actions 用、gh と GH_TOKEN が必要）
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const minimist = require('minimist');
const { ROOT } = require('../lib/config');
const { refreshAccessToken } = require('../lib/instagram');
const { refreshAndStore } = require('../lib/token-refresh');

const args = minimist(process.argv.slice(2), { string: ['github-secret', 'repo'] });

function storeInEnvFile(token) {
  const envPath = path.join(ROOT, '.env');
  const env = fs.readFileSync(envPath, 'utf-8');
  if (!/^IG_ACCESS_TOKEN=.*$/m.test(env)) throw new Error('.env に IG_ACCESS_TOKEN の行がない');
  fs.writeFileSync(envPath, env.replace(/^IG_ACCESS_TOKEN=.*$/m, `IG_ACCESS_TOKEN=${token}`), 'utf-8');
}

function storeInGithubSecret(name, repo) {
  return (token) => {
    // 値は標準入力で渡す（コマンドライン引数やログに出さない）
    const result = spawnSync('gh', ['secret', 'set', name, '--repo', repo], { input: token, stdio: ['pipe', 'inherit', 'inherit'] });
    if (result.error) throw new Error(`gh を実行できない: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`gh secret set が失敗した（終了コード ${result.status}）`);
  };
}

(async () => {
  const secretName = args['github-secret'];
  if (secretName && !args.repo) throw new Error('--github-secret を使うときは --repo <owner/repo> も指定して');

  const store = secretName ? storeInGithubSecret(secretName, args.repo) : storeInEnvFile;
  const { expiresIn } = await refreshAndStore({ refresh: refreshAccessToken, store });
  const days = Math.floor(expiresIn / 86400);
  console.log(`トークン更新OK（あと${days}日有効）。${secretName ? `GitHub Secret ${secretName}` : '.env'} を書き換えた`);
  if (!secretName) console.log('GitHub の Secrets（IG_ACCESS_TOKEN）も使ってるなら、そっちも更新してね');
})().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
