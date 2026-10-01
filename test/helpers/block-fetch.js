/**
 * node --require で読み込むと、ネットワーク通信（fetch）をすべて止めて記録する
 * 「API を一切呼ばない」ことの確認用。記録先は環境変数 FETCH_LOG
 */

const fs = require('fs');

globalThis.fetch = async (url) => {
  if (process.env.FETCH_LOG) fs.appendFileSync(process.env.FETCH_LOG, `${String(url)}\n`);
  throw new Error('テスト中はネットワーク通信を止めている');
};
