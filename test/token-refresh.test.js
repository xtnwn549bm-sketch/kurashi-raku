require('./helpers/env').setupTempEnv();

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { refreshAndStore, isUsableToken } = require('../lib/token-refresh');

// 実在しない、形だけそれらしいダミー値
const DUMMY_TOKEN = 'TESTDUMMYTOKENabcdefghijklmnopqrstuvwxyz0123456789';

function recorder() {
  const stored = [];
  return { stored, store: async (token) => { stored.push(token); } };
}

test('更新に失敗したら保存しない（既存の Secret を上書きしない）', async () => {
  const { stored, store } = recorder();
  await assert.rejects(refreshAndStore({ refresh: async () => { throw new Error('API エラー'); }, store }), /API エラー/);
  assert.deepEqual(stored, []);
});

test('新しいトークンが空・形がおかしいなら保存しない', async () => {
  for (const bad of [undefined, null, '', '   ', 'short', `${DUMMY_TOKEN}\n`, `${DUMMY_TOKEN} x`]) {
    const { stored, store } = recorder();
    await assert.rejects(refreshAndStore({ refresh: async () => ({ access_token: bad, expires_in: 5184000 }), store }), /保存しない/);
    assert.deepEqual(stored, [], `保存してはいけない: ${JSON.stringify(bad)}`);
  }
  const { stored, store } = recorder();
  await assert.rejects(refreshAndStore({ refresh: async () => null, store }), /保存しない/);
  assert.deepEqual(stored, []);
});

test('有効なトークンのときだけ、1回だけ保存する', async () => {
  const { stored, store } = recorder();
  const result = await refreshAndStore({ refresh: async () => ({ access_token: DUMMY_TOKEN, expires_in: 5184000 }), store });
  assert.deepEqual(stored, [DUMMY_TOKEN]);
  assert.equal(result.expiresIn, 5184000);
  assert.equal(isUsableToken(DUMMY_TOKEN), true);
});

test('ワークフローは更新結果をパイプで直接 Secret に流さない', () => {
  const yml = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'refresh-token.yml'), 'utf-8');
  assert.doesNotMatch(yml, /\|\s*gh secret set/, 'パイプで流すと、更新失敗時に空の値で上書きされる');
  assert.doesNotMatch(yml, /--stdout/);
  assert.match(yml, /node scripts\/refresh-token\.js --github-secret IG_ACCESS_TOKEN/);
});
