const { setupTempEnv, samplePost, writePost } = require('./helpers/env');

const env = setupTempEnv();

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPost, savePost, listPosts, buildCaption } = require('../lib/posts');
const { approvalFingerprint, publishProblems } = require('../lib/checks');
const { prepare, execute, NeedsReviewError } = require('../lib/publisher');

let seq = 0;

/** 承認済み（ready）の投稿を作る。他の投稿と混ざらないよう毎回別の id */
function readyPost(overrides = {}) {
  seq += 1;
  const post = samplePost(`${String(seq).padStart(2, '0')}_pub`, overrides);
  writePost(env.postsDir, post);
  post.status = 'ready';
  post.approval = { fingerprint: approvalFingerprint(post), approvedAt: '2026-10-01T00:00:00.000Z' };
  savePost(post);
  return loadPost(post.id);
}

/** 偽の Instagram。publishContainer の呼び出し回数を数える */
function fakeInstagram({ recent = [], publishError } = {}) {
  const calls = { publish: 0, containers: 0 };
  return {
    calls,
    getRecentMedia: async () => recent,
    getPublishingLimit: async () => ({ quota_usage: 0, config: { quota_total: 100 } }),
    createImageContainer: async () => { calls.containers += 1; return `child${calls.containers}`; },
    createCarouselContainer: async () => 'carousel1',
    waitUntilFinished: async () => {},
    publishContainer: async () => {
      calls.publish += 1;
      if (publishError) throw new Error(publishError);
      return 'media123';
    },
    getPermalink: async () => 'https://www.instagram.com/p/TEST/',
  };
}
const uploadImage = async (local, remote) => `https://storage.invalid/${remote}`;

/** その投稿だけを対象にする（他のテストの投稿の影響を受けない） */
const only = (post) => listPosts().filter((p) => p.id === post.id);

test('通常: 「投稿中」を記録してから公開し、投稿済みを記録する', async () => {
  const post = readyPost();
  const instagram = fakeInstagram();

  const prepared = await prepare({ posts: only(post), instagram, save: savePost });
  assert.equal(prepared.action, 'publish');
  assert.equal(loadPost(post.id).status, 'publishing', '公開前に「投稿中」がファイルに残っていること');

  await execute(loadPost(post.id), { instagram, uploadImage, save: savePost });
  const saved = loadPost(post.id);
  assert.equal(saved.status, 'published');
  assert.equal(saved.mediaId, 'media123');
  assert.equal(saved.permalink, 'https://www.instagram.com/p/TEST/');
  assert.equal(saved.publishAttempt, undefined);
  assert.equal(instagram.calls.publish, 1);
});

test('公開後の記録が失われても、次の実行では Instagram と照合して再投稿しない', async () => {
  const post = readyPost();
  await prepare({ posts: only(post), instagram: fakeInstagram(), save: savePost });
  // ここで公開には成功したが、投稿済みの記録（push）が失われた状態
  const caption = buildCaption(loadPost(post.id));
  const instagram = fakeInstagram({ recent: [{ id: 'media999', caption, timestamp: '2026-10-01T12:00:00+0000', permalink: 'https://www.instagram.com/p/OLD/' }] });

  const result = await prepare({ posts: only(post), instagram, save: savePost });
  assert.equal(result.action, 'reconciled');
  const saved = loadPost(post.id);
  assert.equal(saved.status, 'published');
  assert.equal(saved.mediaId, 'media999');
  assert.equal(instagram.calls.publish, 0);
});

test('投稿結果が不明で Instagram にも見つからないなら、自動で再投稿せず止める', async () => {
  const post = readyPost();
  await prepare({ posts: only(post), instagram: fakeInstagram(), save: savePost });
  const instagram = fakeInstagram({ recent: [{ id: 'x', caption: '別の投稿' }] });

  await assert.rejects(prepare({ posts: only(post), instagram, save: savePost }), NeedsReviewError);
  assert.equal(loadPost(post.id).status, 'publishing');
  assert.equal(instagram.calls.publish, 0);
});

test('結果不明の投稿があるあいだは、他の投稿待ちも公開しない', async () => {
  const stuck = readyPost();
  await prepare({ posts: only(stuck), instagram: fakeInstagram(), save: savePost });
  const next = readyPost();
  const instagram = fakeInstagram();

  await assert.rejects(prepare({ posts: [loadPost(stuck.id), loadPost(next.id)], instagram, save: savePost }), NeedsReviewError);
  assert.equal(loadPost(next.id).status, 'ready');
});

test('公開APIの呼び出しで失敗したら、結果不明として publishing のまま残す', async () => {
  const post = readyPost();
  const instagram = fakeInstagram({ publishError: 'タイムアウト' });
  await prepare({ posts: only(post), instagram, save: savePost });

  await assert.rejects(execute(loadPost(post.id), { instagram, uploadImage, save: savePost }), /タイムアウト/);
  const saved = loadPost(post.id);
  assert.equal(saved.status, 'publishing');
  assert.equal(saved.publishAttempt.phase, 'publish-call');
});

test('公開APIを呼ぶ前に失敗したら、確実に未投稿なので ready に戻す', async () => {
  const post = readyPost();
  const instagram = fakeInstagram();
  await prepare({ posts: only(post), instagram, save: savePost });

  const failingUpload = async () => { throw new Error('アップロード失敗'); };
  await assert.rejects(execute(loadPost(post.id), { instagram, uploadImage: failingUpload, save: savePost }), /アップロード失敗/);
  const saved = loadPost(post.id);
  assert.equal(saved.status, 'ready');
  assert.equal(saved.publishAttempt, undefined);
  assert.equal(instagram.calls.publish, 0);
});

test('投稿待ちでも、同じキャプションの投稿がすでにあれば再投稿しない', async () => {
  const post = readyPost();
  const instagram = fakeInstagram({ recent: [{ id: 'media777', caption: `${buildCaption(post)}\n` }] });

  const result = await prepare({ posts: only(post), instagram, save: savePost });
  assert.equal(result.action, 'reconciled');
  assert.equal(loadPost(post.id).status, 'published');
  assert.equal(instagram.calls.publish, 0);
});

test('承認後に文章・商品リンク・画像が変わったら公開しない', async () => {
  const changes = {
    文章: (p) => { p.caption = `${p.caption}\n追記`; savePost(p); },
    商品リンク: (p) => { p.products[2].asin = 'B0TESTXXXX'; savePost(p); },
    画像: (p) => { fs.writeFileSync(path.join(env.postsDir, p.id, 'slide3.jpg'), Buffer.from('changed')); },
  };
  for (const [label, change] of Object.entries(changes)) {
    const post = readyPost();
    change(loadPost(post.id));
    const instagram = fakeInstagram();
    await assert.rejects(prepare({ posts: only(post), instagram, save: savePost }), /承認後/, label);
    assert.equal(loadPost(post.id).status, 'ready', label);
    assert.equal(instagram.calls.publish, 0, label);
  }
});

test('公開直前チェック: 画像・ASIN全件・トラッキングID・承認の記録が欠けていたら公開しない', async () => {
  const noSlide = readyPost();
  fs.rmSync(path.join(env.postsDir, noSlide.id, 'slide7.jpg'));
  assert.ok(publishProblems(loadPost(noSlide.id)).some((p) => p.includes('slide7.jpg')));

  const noAsin = readyPost();
  const p = loadPost(noAsin.id);
  p.products[4].asin = '';
  savePost(p);
  assert.ok(publishProblems(loadPost(noAsin.id)).some((m) => m.includes('05')));

  const noApproval = readyPost();
  const q = loadPost(noApproval.id);
  delete q.approval;
  savePost(q);
  await assert.rejects(prepare({ posts: only(q), instagram: fakeInstagram(), save: savePost }), /承認の記録がない/);

  const accountPath = path.join(env.contentDir, 'account.json');
  const account = JSON.parse(fs.readFileSync(accountPath, 'utf-8'));
  fs.writeFileSync(accountPath, JSON.stringify({ ...account, associateTag: '' }));
  try {
    const noTag = readyPost();
    assert.ok(publishProblems(loadPost(noTag.id)).some((m) => m.includes('トラッキングID')));
  } finally {
    fs.writeFileSync(accountPath, JSON.stringify(account));
  }
});

test('prepare のあとで中身が変わったら、execute も公開APIを呼ばない', async () => {
  const post = readyPost();
  const instagram = fakeInstagram();
  await prepare({ posts: only(post), instagram, save: savePost });
  const p = loadPost(post.id);
  p.caption = `${p.caption}\nあとから追記`;
  savePost(p);

  await assert.rejects(execute(loadPost(post.id), { instagram, uploadImage, save: savePost }), /公開直前のチェック/);
  assert.equal(instagram.calls.publish, 0);
  assert.equal(loadPost(post.id).status, 'ready');
});
