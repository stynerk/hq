import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRegistry, Registry, updateFrontmatter, splitFrontmatter, locate} from './registry.mjs';
import {classify, parseKeyword, ExchangeCounter, chunk, BOT_EXCHANGE_LIMIT} from './routing.mjs';

const hqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// 실제 hq를 임시 폴더에 복사하고 ID를 채운 픽스처
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-'));
  for (const d of ['config', 'projects', 'agents', 'agents/subagents']) {
    fs.mkdirSync(path.join(dir, d), {recursive: true});
    for (const f of fs.readdirSync(path.join(hqRoot, d)).filter(f => f.endsWith('.md'))) fs.copyFileSync(path.join(hqRoot, d, f), path.join(dir, d, f));
  }
  updateFrontmatter(path.join(dir, 'config', 'discord.md'), d => { d.channels.hq = '900'; d.channels.hq_alerts = '901'; d.categories.archive = '902'; });
  updateFrontmatter(path.join(dir, 'projects', 'onemorestep.md'), d => { d.discord.dev_thread_id = '777'; });
  updateFrontmatter(path.join(dir, 'projects', 'our-adventure.md'), d => { d.discord.channel_id = '555'; });
  return dir;
}

const OWNER = '565583270448988163', CLAUDE = '1563042220230053928', CODEX = '1563059804082282516';
const OMS = '1570085138774233170', G = '1563042660044775486';
const msg = (o = {}) => ({author: {id: OWNER, bot: false}, guildId: G, channel: {id: OMS}, content: 'hi', ...o});

test('real hq registry parses and has no errors', () => {
  const reg = loadRegistry(hqRoot);
  assert.deepEqual(reg.errors, []);
  assert.equal(reg.ownerId, OWNER);
  assert.equal(reg.codexBotId, CODEX);
  assert.equal(reg.byChannel.get(OMS).project.slug, 'onemorestep');
  for (const n of ['hq-lead', 'service-pm', 'dev-pm', 'researcher', 'reviewer', 'implementer', 'qa', 'release']) assert.ok(reg.agents.has(n), n);
  assert.match(reg.agents.get('dev-pm').body, /개발PM/);
});

test('updateFrontmatter keeps body and stringifies ids as strings', () => {
  const dir = fixture();
  const file = path.join(dir, 'projects', 'onemorestep.md');
  const before = splitFrontmatter(fs.readFileSync(file, 'utf8')).body;
  const {data, body} = splitFrontmatter(fs.readFileSync(file, 'utf8'));
  assert.equal(body, before);
  assert.equal(data.discord.dev_thread_id, '777');
  assert.equal(typeof data.discord.channel_id, 'string');
});

test('duplicate channel ids are reported', () => {
  const dir = fixture();
  updateFrontmatter(path.join(dir, 'projects', 'our-adventure.md'), d => { d.discord.channel_id = OMS; });
  const reg = loadRegistry(dir);
  assert.equal(reg.errors.length, 1);
});

test('Registry reloads after file change', async () => {
  const dir = fixture();
  const r = new Registry(dir, {intervalMs: 0});
  assert.equal(r.get().byChannel.get('555').project.slug, 'our-adventure');
  await new Promise(res => setTimeout(res, 20));
  updateFrontmatter(path.join(dir, 'projects', 'our-adventure.md'), d => { d.discord.channel_id = '556'; });
  assert.equal(r.get().byChannel.get('556').project.slug, 'our-adventure');
});

test('locate: thread under project channel and dev thread', () => {
  const reg = loadRegistry(fixture());
  assert.equal(locate(reg, {id: '777'}).kind, 'dev');
  assert.equal(locate(reg, {id: '123', parentId: OMS}).kind, 'thread');
  assert.equal(locate(reg, {id: '123', parentId: '777'}), null);
});

test('claude: owner in project channel → service PM, unless only Codex is mentioned', () => {
  const reg = loadRegistry(fixture());
  const c = m => classify(m, {self: 'claude', reg});
  assert.equal(c(msg()).role, 'service-pm');
  assert.equal(c(msg()).mode, 'owner');
  assert.equal(c(msg({content: `<@${CODEX}> 구조 어때?`})).kind, 'ignore');
  assert.equal(c(msg({content: `<@${CODEX}> <@${CLAUDE}> 둘 다`})).kind, 'chat');
  assert.equal(c(msg({content: '!status'})).kind, 'command');
});

test('codex: owner must call it (mention, reply, !codex) in project channels', () => {
  const reg = loadRegistry(fixture());
  const c = (m, o = {}) => classify(m, {self: 'codex', reg, ...o});
  assert.equal(c(msg()).kind, 'ignore');
  assert.equal(c(msg({content: `<@${CODEX}> 공수?`})).text, '공수?');
  assert.equal(c(msg(), {repliesToSelf: true}).kind, 'chat');
  assert.equal(c(msg({content: '!codex 상태'})).text, '상태');
  assert.equal(c(msg({content: `<@${CODEX}> !status`})).kind, 'command');
  assert.equal(c(msg({channel: {id: '777'}, content: `<@${CODEX}> 봐 줘`})).place, 'dev');
});

test('peer bot: execute only with keyword + issue number, otherwise consult', () => {
  const reg = loadRegistry(fixture());
  const fromClaude = content => msg({author: {id: CLAUDE, bot: true}, channel: {id: '777'}, content});
  const c = (m, o = {}) => classify(m, {self: 'codex', reg, ...o});
  const r = c(fromClaude(`<@${CODEX}> TASK_READY #12 홈 화면`));
  assert.equal(r.mode, 'execute'); assert.deepEqual(r.keyword, {keyword: 'TASK_READY', issue: 12});
  assert.equal(c(fromClaude(`<@${CODEX}> TASK_READY 번호없음`)).mode, 'consult');
  assert.equal(c(fromClaude(`<@${CODEX}> 공수 알려 줘`)).mode, 'consult');
  assert.equal(c(fromClaude('TASK_READY #12 멘션없음')).kind, 'ignore');
  assert.equal(c(fromClaude(`<@${CODEX}> TASK_READY #12`), {exchangeCount: BOT_EXCHANGE_LIMIT + 1}).kind, 'loop-limit');
  // Claude가 받는 키워드
  const fromCodex = content => msg({author: {id: CODEX, bot: true}, channel: {id: '777'}, content});
  assert.equal(classify(fromCodex(`<@${CLAUDE}> REVIEW_REQUEST #12`), {self: 'claude', reg}).mode, 'execute');
  assert.equal(classify(fromCodex(`<@${CLAUDE}> TASK_READY #12`), {self: 'claude', reg}).mode, 'consult');
});

test('other bots, webhooks, self, other guilds, alerts, archive are ignored', () => {
  const reg = loadRegistry(fixture());
  const c = m => classify(m, {self: 'claude', reg});
  assert.equal(c(msg({author: {id: 'x', bot: true}})).kind, 'ignore');
  assert.equal(c(msg({webhookId: 'w'})).kind, 'ignore');
  assert.equal(c(msg({author: {id: CLAUDE, bot: true}})).reason, 'self');
  assert.equal(c(msg({guildId: 'other'})).reason, 'other-guild');
  assert.equal(c(msg({channel: {id: '901'}})).reason, 'alerts');
  assert.equal(c(msg({channel: {id: '1', parentId: '902'}})).reason, 'archive');
  assert.equal(c(msg({author: {id: 'someone', bot: false}})).kind, 'ignore');
});

test('#hq and DM go to the lead; Codex stays out of #hq', () => {
  const reg = loadRegistry(fixture());
  assert.equal(classify(msg({channel: {id: '900'}}), {self: 'claude', reg}).role, 'hq-lead');
  assert.equal(classify(msg({channel: {id: '900'}, content: `<@${CODEX}> hi`}), {self: 'codex', reg}).kind, 'ignore');
  assert.equal(classify(msg({guildId: null}), {self: 'claude', reg}).role, 'hq-lead');
  assert.equal(classify(msg({guildId: null}), {self: 'codex', reg}).role, 'hq-reader');
  assert.equal(classify(msg({guildId: null, author: {id: 'x', bot: false}}), {self: 'claude', reg}).kind, 'ignore');
  assert.equal(classify(msg({channel: {id: '900'}, content: '!project new demo stynerk/demo'}), {self: 'claude', reg}).kind, 'command');
});

test('unregistered channels: answer once only when called, !hq init allowed', () => {
  const reg = loadRegistry(fixture());
  assert.equal(classify(msg({channel: {id: 'zzz'}}), {self: 'claude', reg}).kind, 'ignore');
  assert.equal(classify(msg({channel: {id: 'zzz'}, content: `<@${CLAUDE}> hi`}), {self: 'claude', reg}).kind, 'unregistered');
  assert.equal(classify(msg({channel: {id: 'zzz'}, content: '!hq init'}), {self: 'claude', reg}).kind, 'command');
});

test('archived project is ignored', () => {
  const dir = fixture();
  updateFrontmatter(path.join(dir, 'projects', 'onemorestep.md'), d => { d.status = 'archived'; });
  assert.equal(classify(msg(), {self: 'claude', reg: loadRegistry(dir)}).reason, 'archived');
});

test('ExchangeCounter resets on owner and counts bots per channel', () => {
  const k = new ExchangeCounter(); const opts = {ownerId: OWNER, botIds: [CLAUDE, CODEX]};
  const bot = msg({author: {id: CLAUDE, bot: true}});
  for (let i = 0; i < 3; i++) k.record(bot, opts);
  assert.equal(k.count(OMS), 3);
  k.record(msg(), opts);
  assert.equal(k.count(OMS), 0);
  assert.equal(k.warnOnce(OMS), true); assert.equal(k.warnOnce(OMS), false);
});

test('parseKeyword and chunk', () => {
  assert.equal(parseKeyword('QA_READY #3', ['QA_READY']).issue, 3);
  assert.equal(parseKeyword('참고 QA_READY #3', ['QA_READY']), null);
  const parts = chunk('a'.repeat(1000) + '\n' + 'b'.repeat(1000) + '\n' + 'c'.repeat(4000));
  assert.ok(parts.every(p => p.length <= 1900));
  assert.equal(parts.join('').replace(/\n/g, '').length, 6000);
  assert.deepEqual(chunk(''), ['(빈 응답)']);
});
