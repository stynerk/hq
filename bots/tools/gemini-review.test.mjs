import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {buildAgyPrompt, parseAgyArgs, parseResearchOutput, runAgy} from './agy-run.mjs';
import {parseArgs, buildPrompt, stripFrontmatter, runGemini, runAntigravity, runReview, reviewModel, geminiCommand, stripHeader, normalizeReviewOutput} from './gemini-review.mjs';

test('parseArgs requires criteria and at least one file', () => {
  assert.deepEqual(parseArgs(['--criteria', 'c.md', 'a.md', 'b.md']), {criteria: 'c.md', files: ['a.md', 'b.md']});
  assert.deepEqual(parseArgs(['--role', 'loki', '--criteria', 'c.md', 'a.md']), {criteria: 'c.md', files: ['a.md'], role: 'loki'});
  assert.throws(() => parseArgs(['--role', 'other', '--criteria', 'c.md', 'a.md']), /--role/);
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

test('buildPrompt distinguishes Loki challenges from Fury panel judging', () => {
  const criteria = {name: 'c.md', text: '근거 100점'};
  const files = [{name: 'a.md', text: '근거 없는 주장'}];
  assert.match(buildPrompt({role: 'loki', rubric: '반론', criteria, files}), /반대 심문관 Loki.*점수를 매기거나 대안을 설계하지 않는다/);
  assert.match(buildPrompt({role: 'fury', rubric: '채점', criteria, files}), /패널 Fury.*세 심사위원의 관점에서 각각 채점/);
});

const fakeSpawn = ({code = 0, stdout = '', stderr = '', init, onInput = () => {}, onSpawn = () => {}} = {}) => (cmd, args, opts) => {
  onSpawn(cmd, args, opts);
  const c = new EventEmitter(); c.stdout = new PassThrough(); c.stderr = new PassThrough();
  let input = '';
  c.stdin = new PassThrough();
  c.stdin.on('data', d => { input += d; onInput(input); });
  c.stdin.on('finish', () => { c.stdout.end(stdout); c.stderr.end(stderr); setImmediate(() => c.emit('close', code)); });
  if (init) setImmediate(() => c.stdout.write(init));
  c.kill = () => { c.stdin.destroy(); c.stdout.end(); c.stderr.end(); setImmediate(() => c.emit('close', null)); };
  return c;
};

test('runGemini sends the prompt on stdin from an empty temp folder and returns the answer', async () => {
  let seen, prompt;
  const out = await runGemini('PROMPT', {command: {cmd: 'gemini', pre: []}, spawnFn: fakeSpawn({
    stdout: '판정: 통과\n', onSpawn: (cmd, args, opts) => { seen = {cmd, args, opts}; },
    onInput: input => { prompt = input; },
  })});
  assert.equal(out, '판정: 통과');
  assert.equal(prompt, 'PROMPT');
  assert.ok(seen.args.includes('-p')); assert.equal(seen.opts.shell, undefined); assert.ok(seen.args.includes('--skip-trust')); assert.equal(seen.args[seen.args.indexOf('-p') + 1], '위 입력의 역할 지침을 따르라.'); assert.equal(seen.args[seen.args.indexOf('-m') + 1], reviewModel()); assert.match(seen.opts.cwd, /gemini-review-/);
});

test('runGemini explains a missing login', async () => {
  await assert.rejects(runGemini('P', {command: {cmd: 'gemini', pre: []}, spawnFn: fakeSpawn({code: 41})}), /GEMINI_API_KEY/);
});

test('runGemini does not surface raw process diagnostics', async () => {
  await assert.rejects(runGemini('P', {
    command: {cmd: 'gemini', pre: []}, spawnFn: fakeSpawn({code: 1, stderr: 'synthetic credential diagnostic'}),
  }), {message: 'Gemini 실패(종료 코드 1)'});
});

const initEvent = overrides => JSON.stringify({event: 'init', init: {
  agent: 'hq-review-agent', model: 'gemini-4-argon-medium', ...overrides,
}}) + '\n';
const resultEvent = (status, response) => JSON.stringify({event: 'result', result: {status, response}}) + '\n';

test('runAntigravity isolates tools and sends one prompt only on stdin after matching init', async () => {
  const bin = path.resolve('bin/agy');
  const env = {AGY_REVIEW_BIN: bin, PATH: 'path', GEMINI_API_KEY: 'mock-key', CLAUDE_DISCORD_BOT_TOKEN: 'mock-token'};
  let seenPrompt, seenDir;
  const output = await runAntigravity('테스트 자료', {env, spawnFn: fakeSpawn({
    init: initEvent({tools: ['run_command', 'send_message']}),
    stdout: resultEvent('SUCCESS', '반론\n'),
    onSpawn: (cmd, args, opts) => {
      assert.equal(cmd, bin);
      assert.deepEqual(args, [
        '--agent', 'hq-review-agent', '--model', 'gemini-4-argon-medium',
        '--mode', 'plan', '--sandbox', '--disable-slash-commands',
        '--input-format', 'stream-json', '--output-format', 'stream-json',
      ]);
      assert.deepEqual(opts.env, {PATH: 'path'});
      assert.equal(opts.shell, undefined);
      seenDir = opts.cwd;
      const agent = fs.readFileSync(path.join(opts.cwd, '.agents', 'agents', 'hq-review-agent.md'), 'utf8');
      assert.match(agent, /^tools: \[send_message\]$/m);
      assert.match(agent, /^commandExecutionPolicy: off$/m);
      assert.match(agent, /^inheritMcp: false$/m);
      assert.match(agent, /^inheritCustomizations: false$/m);
    },
    onInput: input => { seenPrompt = input; },
  })});
  assert.equal(output, '반론');
  assert.deepEqual(JSON.parse(seenPrompt), {event: 'user', message: {content: '테스트 자료'}});
  assert.equal(fs.existsSync(seenDir), false);
});

test('runAntigravity withholds the prompt for an unexpected agent or model', async () => {
  for (const mismatch of [{agent: 'other'}, {model: 'wrong'}, {agent: undefined}]) {
    let sent = false;
    await assert.rejects(runAntigravity('test input', {spawnFn: fakeSpawn({
      init: initEvent(mismatch), onInput: () => { sent = true; },
    })}), /에이전트 또는 모델/);
    assert.equal(sent, false);
  }
});

test('runAntigravity rejects tool calls, invalid streams, and unsuccessful or empty results', async () => {
  const tool = JSON.stringify({event: 'step_update', step_update: {step_type: 'tool', tool_name: 'view_file'}}) + '\n';
  for (const [stdout, expected] of [
    [tool + resultEvent('SUCCESS', 'result'), /도구가 호출/],
    ['garbage', /응답 형식 오류/],
    [resultEvent('ERROR', 'synthetic provider diagnostic'), /응답 없음/],
    [resultEvent('SUCCESS', '  '), /응답 없음/],
    [resultEvent('SUCCESS', '```markdown\n[리뷰어: Gemini]\n```'), /응답 없음/],
  ]) {
    await assert.rejects(runAntigravity('P', {spawnFn: fakeSpawn({init: initEvent(), stdout})}), expected);
  }
});

test('runReview defaults to Gemini and falls back exactly once after Antigravity fails', async () => {
  const called = [];
  const gemini = async prompt => { called.push(['gemini', prompt]); return 'gemini response'; };
  const antigravity = async prompt => { called.push(['agy', prompt]); return 'antigravity response'; };
  assert.deepEqual(await runReview('P', {env: {}, gemini, antigravity}), {engine: 'gemini', output: 'gemini response'});
  assert.deepEqual(called.splice(0), [['gemini', 'P']]);

  const env = {GEMINI_REVIEW_ENGINE: 'antigravity'};
  assert.deepEqual(await runReview('P', {env, gemini, antigravity}), {engine: 'antigravity', output: 'antigravity response'});
  assert.deepEqual(called.splice(0), [['agy', 'P']]);
  const failed = async prompt => {
    called.push(['agy', prompt]);
    throw new Error('synthetic credential diagnostic');
  };
  const onFallback = reason => { called.push(['fallback', reason]); };
  assert.deepEqual(await runReview('P', {env, gemini, antigravity: failed, onFallback}), {engine: 'gemini', output: 'gemini response'});
  assert.deepEqual(called.splice(0), [['agy', 'P'], ['fallback', undefined], ['gemini', 'P']]);
  await assert.rejects(runReview('P', {env: {GEMINI_REVIEW_ENGINE: 'unknown'}, gemini, antigravity}), /GEMINI_REVIEW_ENGINE/);
});

test('runReview waits for an unready Antigravity to close before launching Gemini', async () => {
  let killSignal, closed = false, scratch;
  const spawnFn = (...args) => {
    scratch = args[2].cwd;
    const child = fakeSpawn()(...args);
    const close = child.kill;
    child.prependListener('close', () => { closed = true; });
    child.kill = signal => { killSignal = signal; setTimeout(close, 10); };
    return child;
  };
  const output = await runReview('P', {
    env: {GEMINI_REVIEW_ENGINE: 'antigravity'},
    antigravity: prompt => runAntigravity(prompt, {spawnFn, timeoutMs: 5}),
    gemini: async () => {
      assert.equal(closed, true);
      assert.equal(fs.existsSync(scratch), false);
      return 'fallback';
    },
  });
  assert.equal(killSignal, 'SIGKILL');
  assert.deepEqual(output, {engine: 'gemini', output: 'fallback'});
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

test('stripHeader removes a header Gemini copied from the rubric', () => {
  assert.equal(stripHeader('[리뷰어: Gemini]\n판정: 반려'), '판정: 반려');
  assert.equal(stripHeader('판정: 통과'), '판정: 통과');
});

test('normalizeReviewOutput removes an enclosing fence and copied header', () => {
  const header = '[리뷰어: Gemini — Loki]';
  const body = '반론 (심각도 순, 최대 5개):\n1. 근거가 부족하다.';
  assert.equal(normalizeReviewOutput(['```', header, body, '```'].join('\n')), body);
  assert.equal(normalizeReviewOutput(['', '```markdown', header, '판정: 반려', '```', ''].join('\r\n')), '판정: 반려');
  assert.equal(normalizeReviewOutput('~~~markdown\n판정: 통과\n~~~'), '판정: 통과');
});

test('normalizeReviewOutput preserves code blocks within a response', () => {
  const code = '  ```js\n  const score = 1;\n  ```';
  assert.equal(normalizeReviewOutput(['````', '[리뷰어: Gemini]', code, '`````'].join('\n')), code);
  assert.equal(normalizeReviewOutput(`[리뷰어: Gemini]\n${code}\n설명`), `${code}\n설명`);

  const partial = '```js\nconst score = 1;\n```\n설명';
  const separate = '```js\nconst score = 1;\n```\n\n```text\n판정: 통과\n```';
  const unclosed = '```text\n판정: 통과\n~~~';
  for (const response of [partial, separate, unclosed]) assert.equal(normalizeReviewOutput(response), response);
});

test('agy-run accepts a role, repeated inputs, and exactly one kind of question', () => {
  assert.deepEqual(parseAgyArgs([
    '--mode', 'research', '--instructions', 'role.md', '--input', 'one.md', '--input', 'two.md', '--question-stdin',
  ]), {mode: 'research', instructions: 'role.md', inputs: ['one.md', 'two.md'], questionStdin: true});
  assert.equal(parseAgyArgs(['--instructions', 'role.md', '--question', '질문']).mode, 'review');
  for (const options of [
    ['--mode', 'other', '--instructions', 'role.md', '--question', '자료'],
    ['--instructions', 'role.md', '--question', '자료', '--question-stdin'],
    ['--instructions', 'role.md', '--question-stdin', '--question-stdin'],
    ['--instructions', 'role.md'],
    ['--input', '자료'],
    ['--instructions', '--question', '자료'],
  ]) assert.throws(() => parseAgyArgs(options), /사용:/);

  const prompt = buildAgyPrompt({
    instructions: '---\nname: researcher\n---\n시장 조사',
    inputs: [{name: '자료.md', text: '공개 자료'}],
    question: '가격',
  });
  assert.doesNotMatch(prompt, /name: researcher/);
  assert.match(prompt, /시장 조사[\s\S]*가격[\s\S]*자료\.md[\s\S]*공개 자료/);
  assert.throws(() => buildAgyPrompt({instructions: '지침', question: 'x'.repeat(400_000)}), /너무 큽니다/);
});

const source = {
  title: '공개 가격표', claim: '무료 요금제를 제공한다.',
  url: 'https://example.org/prices', date: '2024-02-29', dateBasis: 'source',
};

test('research results require dates and public source URLs and stamp actual observation date', () => {
  const observedOn = '2026-11-27';
  const data = (results, unconfirmed = []) => JSON.stringify({results, unconfirmed});
  const response = parseResearchOutput(data([
    source, {...source, date: '1999-01-01', dateBasis: 'observed'},
  ], ['가격 계산 기준 미확인']), observedOn);
  assert.deepEqual(response, {
    results: [source, {...source, date: observedOn, dateBasis: 'observed'}], unconfirmed: ['가격 계산 기준 미확인'],
  });
  assert.deepEqual(parseResearchOutput(data([], ['확인된 자료 없음']), observedOn), {results: [], unconfirmed: ['확인된 자료 없음']});
  assert.throws(() => parseResearchOutput(data([]), observedOn), /미확인 항목이 없습니다/);
  for (const invalid of [
    {date: undefined}, {date: '2026-02-30'}, {url: 'file:///tmp/prices'}, {url: 'https://secret@example.org'},
    {url: undefined}, {url: 'http://localhost:3000'}, {url: 'http://127.0.0.1'},
    {url: 'http://[::1]'}, {url: 'https://foo.local/'}, {url: 'https://internal/'}, {claim: '  '}, {title: undefined}, {dateBasis: undefined},
  ]) assert.throws(() => parseResearchOutput(data([{...source, ...invalid}]), observedOn), /기준일/);
  assert.throws(() => parseResearchOutput('unstructured text', observedOn), /JSON 형식/);
});

const toolEvent = (tool, state = 'DONE', error) => JSON.stringify({
  event: 'step_update',
  step_update: {step_type: 'tool', tool_name: tool, state, tool_info: {name: tool, error}},
}) + '\n';

test('research profile keeps stdin and process isolation while allowing public web evidence only', async () => {
  const init = initEvent({agent: 'hq-market-research-agent'});
  const stdout = resultEvent('SUCCESS', JSON.stringify({results: [source], unconfirmed: []}));
  let asked;
  const data = await runAgy('공개 서비스 가격', {mode: 'research', spawnFn: fakeSpawn({
    init,
    stdout: toolEvent('search_web') + toolEvent('read_url_content') + stdout,
    onSpawn: (_cmd, args, {cwd}) => {
      assert.ok(!args.includes('공개 서비스 가격'));
      const definition = fs.readFileSync(path.join(cwd, '.agents', 'agents', 'hq-market-research-agent.md'), 'utf8');
      assert.match(definition, /^tools: \[search_web, read_url_content, send_message\]$/m);
      assert.match(definition, /^commandExecutionPolicy: off$/m);
      assert.match(definition, /^inheritMcp: false$/m);
    },
    onInput: input => { asked = JSON.parse(input).message.content; },
  })});
  assert.match(asked, /공개 서비스 가격/);
  assert.deepEqual(data, {results: [source], unconfirmed: []});

  for (const [events, reason] of [
    [toolEvent('run_command'), /허용하지 않은 도구/],
    [toolEvent('search_web', 'ACTIVE'), /완료된 웹 검색/],
    [toolEvent('search_web', 'DONE', '검색 오류'), /완료된 웹 검색/],
    ['', /완료된 웹 검색/],
  ]) await assert.rejects(runAgy('P', {mode: 'research', spawnFn: fakeSpawn({init, stdout: events + stdout})}), reason);
  await assert.rejects(runAgy('P', {mode: 'auto'}), /실행 모드/);
  await assert.rejects(runAgy('x'.repeat(400_001), {mode: 'research'}), /너무 큽니다/);
});
