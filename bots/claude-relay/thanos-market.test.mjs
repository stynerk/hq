import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createMarketHandler} from './thanos-market.mjs';

const request = (id, method, params) => ({jsonrpc: '2.0', id, method, params});
const call = (id, question) => request(id, 'tools/call', {name: 'search', arguments: {question}});
const evidence = {
  results: [{title: 'Pricing', claim: 'The source lists a free plan', url: 'https://example.com/pricing', date: '2026-11-27', dateBasis: 'observed'}],
  unconfirmed: [],
};

test('market server exposes one strictly read-only question tool over stdio', async () => {
  const cli = fileURLToPath(new URL('./thanos-market.mjs', import.meta.url));
  const child = spawn(process.execPath, [cli], {stdio: ['pipe', 'pipe', 'pipe']});
  const finished = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  child.stdin.end([
    request(1, 'initialize', {protocolVersion: '2024-11-05'}),
    {jsonrpc: '2.0', method: 'notifications/initialized'},
    request(2, 'tools/list'),
    request(3, 'resources/read', {uri: 'file:///private'}),
  ].map(value => JSON.stringify(value)).join('\n') + '\n');

  let output = '';
  for await (const chunk of child.stdout.setEncoding('utf8')) output += chunk;
  assert.equal(await finished, 0);
  const [initialized, listed, denied] = output.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(initialized.result.capabilities, {tools: {}});
  assert.equal(initialized.result.protocolVersion, '2024-11-05');
  assert.deepEqual(listed.result.tools.map(tool => tool.name), ['search']);
  assert.equal(listed.result.tools[0].inputSchema.additionalProperties, false);
  assert.equal(denied.error.code, -32601);
});

test('market tool validates input, limits calls before awaiting, and returns sourced evidence', async () => {
  let resolveResearch;
  const handle = createMarketHandler({research: async (prompt, options) => {
    assert.match(prompt, /"공개 예약 도구 가격"/);
    assert.deepEqual(options, {mode: 'research'});
    return new Promise(resolve => { resolveResearch = resolve; });
  }});
  assert.equal((await handle(call(1, ' '))).error.code, -32602);
  assert.equal((await handle(call(2, '가'.repeat(1001)))).error.code, -32602);
  assert.equal((await handle(request(3, 'tools/call', {
    name: 'search', arguments: {question: '공개 시장', file: '/private'},
  }))).error.code, -32602);
  const running = handle(call(4, '공개 예약 도구 가격'));
  assert.equal((await handle(call(5, '두 번째 질문'))).result.isError, true);
  resolveResearch(evidence);
  const {result} = await running;
  assert.deepEqual(result.structuredContent, evidence);
  assert.deepEqual(JSON.parse(result.content[0].text), evidence);
});

test('market tool sends a redacted fallback signal when Antigravity fails', async () => {
  const handle = createMarketHandler({research: async () => { throw new Error('synthetic private diagnostics'); }});
  const {result} = await handle(call(1, '공개 시장'));
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /Claude 웹 검색/);
  assert.doesNotMatch(JSON.stringify(result), /synthetic/);
});
