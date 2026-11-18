import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {parseArgs, buildPrompt, stripFrontmatter, runGemini, reviewModel, geminiCommand} from './gemini-review.mjs';

test('parseArgs requires criteria and at least one file', () => {
  assert.deepEqual(parseArgs(['--criteria', 'c.md', 'a.md', 'b.md']), {criteria: 'c.md', files: ['a.md', 'b.md']});
  assert.throws(() => parseArgs(['a.md']), /--criteria/);
  assert.throws(() => parseArgs(['--criteria', 'c.md']), /--criteria/);
});

test('buildPrompt carries rubric without frontmatter, criteria, and files', () => {
  const p = buildPrompt({rubric: '---\nname: reviewer\n---\n# 리뷰어\n판정: 통과 | 반려', criteria: {name: 'c.md', text: '문제 정의 30'}, files: [{name: 'MVP.md', text: '내용'}]});
  assert.ok(!p.includes('name: reviewer'));
  assert.match(p, /판정: 통과 \| 반려/); assert.match(p, /문제 정의 30/); assert.match(p, /### 파일: MVP\.md/);
  assert.throws(() => buildPrompt({rubric: '', criteria: {name: 'c', text: ''}, files: [{name: 'big', text: 'x'.repeat(400_001)}]}), /너무 큽니다/);
  assert.equal(stripFrontmatter('no fm'), 'no fm');
});

const fakeSpawn = ({code = 0, stdout = '', onSpawn = () => {}} = {}) => (cmd, args, opts) => {
  onSpawn(cmd, args, opts);
  const c = new EventEmitter(); c.stdout = new PassThrough(); c.stderr = new PassThrough();
  let input = ''; c.stdin = new PassThrough(); c.stdin.on('data', d => { input += d; });
  c.stdin.on('finish', () => { c.input = input; c.stdout.end(stdout); setImmediate(() => c.emit('close', code)); });
  c.kill = () => {}; return c;
};

test('runGemini sends the prompt on stdin from an empty temp folder and returns the answer', async () => {
  let seen;
  const out = await runGemini('PROMPT', {command: {cmd: 'gemini', pre: []}, spawnFn: fakeSpawn({stdout: '판정: 통과\n', onSpawn: (cmd, args, opts) => { seen = {cmd, args, opts}; }})});
  assert.equal(out, '판정: 통과');
  assert.ok(seen.args.includes('-p')); assert.equal(seen.opts.shell, undefined); assert.ok(seen.args.includes('--skip-trust')); assert.equal(seen.args[seen.args.indexOf('-p') + 1], '위 입력의 지침대로 채점하라.'); assert.equal(seen.args[seen.args.indexOf('-m') + 1], reviewModel()); assert.match(seen.opts.cwd, /gemini-review-/);
});

test('runGemini explains a missing login', async () => {
  await assert.rejects(runGemini('P', {command: {cmd: 'gemini', pre: []}, spawnFn: fakeSpawn({code: 41})}), /GEMINI_API_KEY/);
});

test('reviewModel defaults to flash for the free tier and can be overridden', () => {
  assert.equal(reviewModel({}), 'flash');
  assert.equal(reviewModel({GEMINI_REVIEW_MODEL: 'pro'}), 'pro');
});

test('geminiCommand runs the installed entry with node on Windows, without a shell', () => {
  const c = geminiCommand({platform: 'win32', env: {APPDATA: 'C:/AppData'}, exists: () => true, readFile: () => JSON.stringify({bin: {gemini: 'bundle/gemini.js'}})});
  assert.equal(c.cmd, process.execPath);
  assert.match(c.pre[0].replaceAll('\\', '/'), /@google\/gemini-cli\/bundle\/gemini\.js$/);
  assert.deepEqual(geminiCommand({platform: 'linux'}), {cmd: 'gemini', pre: []});
  assert.throws(() => geminiCommand({platform: 'win32', env: {APPDATA: 'X'}, exists: () => false, readFile: () => '{}'}), /찾지 못했습니다/);
});
