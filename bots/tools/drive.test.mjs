import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {parseArgs, safeDrivePath, resolveSendFile, send, read, docLink, settings} from './drive.mjs';

const exec = promisify(execFile);
const git = async (cwd, ...args) => (await exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-C', cwd, ...args])).stdout.trim();

async function fixture(t) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'hq-drive-')));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const repo = path.join(root, 'project');
  fs.mkdirSync(path.join(repo, 'docs', 'product'), {recursive: true});
  fs.mkdirSync(path.join(repo, 'docs', 'qa'), {recursive: true});
  await git(repo, 'init', '-b', 'main');
  fs.writeFileSync(path.join(repo, 'docs', 'product', 'PLAN.md'), '# 기획\n');
  fs.writeFileSync(path.join(repo, 'docs', 'qa', 'cases.csv'), 'id,expected\n1,ok\n');
  fs.writeFileSync(path.join(repo, 'docs', 'notes.txt'), 'txt');
  fs.writeFileSync(path.join(repo, '.gitignore'), '.env\n');
  await git(repo, 'add', '.'); await git(repo, 'commit', '-m', 'init');
  fs.writeFileSync(path.join(repo, '.env'), 'SECRET=x\n');
  fs.writeFileSync(path.join(repo, 'docs', 'product', 'NEW.md'), '# 새 문서\n');
  fs.writeFileSync(path.join(root, 'outside.md'), '# 밖\n');
  return {root, repo, project: {slug: 'demo', localPath: repo}};
}

const fakeRclone = (responses = {}) => {
  const calls = [];
  const fn = async args => { calls.push(args); const r = responses[args[0] + (args[1] === '--stat' ? ':stat' : '')]; return typeof r === 'function' ? r(args) : (r ?? ''); };
  fn.calls = calls; return fn;
};
const realGit = args => exec('git', args).then(r => r.stdout);

function readTempRoot(t) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-drive-read-test-'));
  t.after(() => fs.rmSync(tmpRoot, {recursive: true, force: true}));
  return tmpRoot;
}

test('parseArgs accepts send and read only', () => {
  assert.deepEqual(parseArgs(['send', 'demo', 'a.md', 'b.csv']), {cmd: 'send', slug: 'demo', files: ['a.md', 'b.csv']});
  assert.deepEqual(parseArgs(['read']), {cmd: 'read', target: ''});
  assert.deepEqual(parseArgs(['read', '기획/PLAN.md']), {cmd: 'read', target: '기획/PLAN.md'});
  assert.throws(() => parseArgs(['send', 'demo']), /사용/);
  assert.throws(() => parseArgs(['read', 'a', 'b']), /사용/);
  assert.throws(() => parseArgs(['copy', 'x']), /사용/);
  assert.throws(() => parseArgs([]), /사용/);
});

test('safeDrivePath blocks parent paths and other remotes', () => {
  assert.equal(safeDrivePath('/기획//PLAN.md/'), '기획/PLAN.md');
  assert.equal(safeDrivePath(''), '');
  for (const bad of ['../x', 'a/../../b', './a', 'gdrive:HQ', 'other:', 'a\nb']) assert.throws(() => safeDrivePath(bad), /올바르지 않습니다/, bad);
});

test('settings default to gdrive, gdrive-ro and HQ', () => {
  assert.deepEqual(settings({}), {write: 'gdrive', read: 'gdrive-ro', root: 'HQ'});
  assert.equal(settings({HQ_DRIVE_ROOT: 'X'}).root, 'X');
});

test('resolveSendFile allows only committed md/csv inside the project', async t => {
  const {root, repo, project} = await fixture(t);
  const ok = await resolveSendFile(project, 'docs/product/PLAN.md', {git: realGit, cwd: repo});
  assert.equal(ok.drivePath, 'docs/product/PLAN.md');
  assert.equal((await resolveSendFile(project, path.join(repo, 'docs', 'qa', 'cases.csv'), {git: realGit})).drivePath, 'docs/qa/cases.csv');
  await assert.rejects(resolveSendFile(project, 'docs/notes.txt', {git: realGit, cwd: repo}), /형식/);
  await assert.rejects(resolveSendFile(project, '.env', {git: realGit, cwd: repo}), /형식/);
  await assert.rejects(resolveSendFile(project, 'docs/product/NEW.md', {git: realGit, cwd: repo}), /추적하지 않는/);
  await assert.rejects(resolveSendFile(project, path.join(root, 'outside.md'), {git: realGit}), /저장소 밖/);
  await assert.rejects(resolveSendFile(project, 'missing.md', {git: realGit, cwd: repo}), /없습니다/);
  fs.appendFileSync(path.join(repo, 'docs', 'product', 'PLAN.md'), '수정\n');
  await assert.rejects(resolveSendFile(project, 'docs/product/PLAN.md', {git: realGit, cwd: repo}), /커밋되지 않은/);
});

test('resolveSendFile rejects a symlink that escapes the project', async t => {
  const {root, repo, project} = await fixture(t);
  try { fs.symlinkSync(path.join(root, 'outside.md'), path.join(repo, 'docs', 'link.md')); } catch { t.skip('symlink not permitted'); return; }
  await assert.rejects(resolveSendFile(project, 'docs/link.md', {git: realGit, cwd: repo}), /저장소 밖/);
});

test('resolveSendFile maps a worktree file to its repo-relative drive path', async t => {
  const {repo, project} = await fixture(t);
  const wt = path.join(repo, '.worktrees', 'service');
  await git(repo, 'worktree', 'add', '-b', 'service/demo', wt, 'main');
  const r = await resolveSendFile(project, 'docs/product/PLAN.md', {git: realGit, cwd: wt});
  assert.equal(r.drivePath, 'docs/product/PLAN.md');
});

test('send converts md/csv into HQ/<slug>/ and reports Google links', async t => {
  const {repo, project} = await fixture(t);
  const rclone = fakeRclone({'lsjson:stat': args => JSON.stringify(args[2].endsWith('.md') ? {ID: 'D1', MimeType: 'application/vnd.google-apps.document'} : {ID: 'S1', MimeType: 'application/vnd.google-apps.spreadsheet'})});
  const out = await send({project, files: ['docs/product/PLAN.md', 'docs/qa/cases.csv'], rclone, git: realGit, cwd: repo, env: {}});
  const copies = rclone.calls.filter(a => a[0] === 'copyto');
  assert.equal(copies.length, 2);
  assert.equal(copies[0][2], 'gdrive:HQ/demo/docs/product/PLAN.md');
  assert.ok(copies[0].includes('--drive-import-formats') && copies[0].includes('--drive-export-formats'));
  assert.match(out, /docs\.google\.com\/document\/d\/D1/);
  assert.match(out, /docs\.google\.com\/spreadsheets\/d\/S1/);
});

test('send uploads nothing when any file is rejected', async t => {
  const {repo, project} = await fixture(t);
  const rclone = fakeRclone();
  await assert.rejects(send({project, files: ['docs/product/PLAN.md', '.env'], rclone, git: realGit, cwd: repo, env: {}}), /형식/);
  assert.equal(rclone.calls.length, 0);
});

test('read lists visible files and rejects unsafe paths', async () => {
  const list = fakeRclone({'lsjson': JSON.stringify([{Path: 'PLAN.md', ModTime: '2026-11-27T01:00:00Z', Size: 10}])});
  assert.match(await read({target: '', rclone: list, env: {}}), /PLAN\.md \| 2026-11-27/);
  assert.ok(list.calls[0].includes('gdrive-ro:'));
  await assert.rejects(read({target: '../secret', rclone: fakeRclone(), env: {}}), /올바르지 않습니다/);
});

test('read lists a folder at the depth limit when deeper files are outside the listing', async () => {
  const listing = fakeRclone({'lsjson': JSON.stringify([
    {Path: 'hq', IsDir: true},
    {Path: 'hq/bots', IsDir: true},
    {Path: 'hq/bots/oauth-site', IsDir: true},
  ])});
  const out = await read({rclone: listing, env: {}});
  assert.deepEqual(listing.calls, [['lsjson', '-R', '--max-depth', '3', 'gdrive-ro:', '--drive-export-formats', 'md,csv']]);
  assert.match(out, /^hq\/bots\/oauth-site\/$/m);
  assert.doesNotMatch(out, /파일 없음/);
  assert.match(await read({rclone: fakeRclone({lsjson: '[]'}), env: {}}), /파일 없음/);
});

test('read exports a Google document with unknown size and no copyto filters', async t => {
  const tmpRoot = readTempRoot(t);
  const file = fakeRclone({
    'lsjson:stat': JSON.stringify({IsDir: false, Size: -1}),
    copyto: args => fs.writeFileSync(args[2], '# OAuth 사이트'),
  });
  const target = 'hq/bots/oauth-site/README.md';
  const out = await read({target, rclone: file, env: {}, tmpRoot});
  const local = file.calls[1][2];
  assert.deepEqual(file.calls, [
    ['lsjson', '--stat', `gdrive-ro:${target}`, '--drive-export-formats', 'md,csv'],
    ['copyto', `gdrive-ro:${target}`, local, '--drive-export-formats', 'md,csv'],
  ]);
  assert.equal(path.dirname(path.dirname(local)), tmpRoot);
  assert.equal(path.basename(local), 'README.md');
  assert.equal(fs.readFileSync(local, 'utf8'), '# OAuth 사이트');
  assert.match(out, /신뢰하지 않는 데이터/);
});

test('read rejects a known oversized file before starting a copy', async t => {
  const tmpRoot = readTempRoot(t);
  const file = fakeRclone({'lsjson:stat': JSON.stringify({IsDir: false, Size: 20 * 1024 * 1024 + 1})});
  await assert.rejects(read({target: 'large.pdf', rclone: file, env: {}, tmpRoot}), /20 MiB.*large\.pdf/);
  assert.equal(file.calls.length, 1);
  assert.deepEqual(fs.readdirSync(tmpRoot), []);
});

test('read removes temporary files after an oversized export or failed copy', async t => {
  const tmpRoot = readTempRoot(t);
  const metadata = JSON.stringify({IsDir: false, Size: -1});
  const oversized = fakeRclone({
    'lsjson:stat': metadata,
    copyto: args => {
      fs.writeFileSync(args[2], '');
      fs.truncateSync(args[2], 20 * 1024 * 1024 + 1);
    },
  });
  const failed = fakeRclone({
    'lsjson:stat': metadata,
    copyto: args => {
      fs.writeFileSync(args[2], 'partial');
      throw new Error('copy failed');
    },
  });
  await assert.rejects(read({target: 'large.md', rclone: oversized, env: {}, tmpRoot}), /20 MiB.*large\.md/);
  assert.deepEqual(fs.readdirSync(tmpRoot), []);
  await assert.rejects(read({target: 'failed.md', rclone: failed, env: {}, tmpRoot}), /copy failed/);
  assert.deepEqual(fs.readdirSync(tmpRoot), []);
});

test('docLink builds Docs, Sheets and plain file links', () => {
  assert.equal(docLink({}), null);
  assert.match(docLink({ID: 'x', MimeType: 'application/pdf'}), /drive\.google\.com\/file\/d\/x/);
});
