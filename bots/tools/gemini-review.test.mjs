import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {parseArgs, buildPrompt, stripFrontmatter, runGemini} from './gemini-review.mjs';

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
  const out = await runGemini('PROMPT', {spawnFn: fakeSpawn({stdout: '판정: 통과\n', onSpawn: (cmd, args, opts) => { seen = {cmd, args, opts}; }})});
  assert.equal(out, '판정: 통과');
  assert.ok(seen.args.includes('-p')); assert.match(seen.opts.cwd, /gemini-review-/);
});

test('runGemini explains a missing login', async () => {
  await assert.rejects(runGemini('P', {spawnFn: fakeSpawn({code: 41})}), /GEMINI_API_KEY/);
});
