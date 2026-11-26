import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRegistry, Registry, updateFrontmatter, splitFrontmatter, locate} from './registry.mjs';
import {classify, parseKeyword, ExchangeCounter, chunk, BOT_EXCHANGE_LIMIT, refreshProjectRoute} from './routing.mjs';

const hqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// 실제 hq를 임시 폴더에 복사하고 ID를 채운 픽스처
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-'));
  for (const d of ['config', 'projects', 'agents', 'agents/subagents']) {
    fs.mkdirSync(path.join(dir, d), {recursive: true});
    for (const f of fs.readdirSync(path.join(hqRoot, d)).filter(f => f.endsWith('.md'))) fs.copyFileSync(path.join(hqRoot, d, f), path.join(dir, d, f));
  }
  updateFrontmatter(path.join(dir, 'config', 'discord.md'), d => {
    d.channels.hq = '900'; d.channels.hq_alerts = '901'; d.categories.archive = '902';
    // 중앙 설정의 project_channels가 프로젝트 파일보다 우선한다. onemorestep은 중앙 설정으로,
    // our-adventure는 중앙 설정에 없을 때의 프로젝트 파일 호환 경로로 시험한다.
    d.project_channels = {onemorestep: {channel_id: '1570085138774233170', dev_thread_id: '777'}};
  });
  updateFrontmatter(path.join(dir, 'projects', 'onemorestep.md'), d => { d.discord.dev_thread_id = '777'; });
  updateFrontmatter(path.join(dir, 'projects', 'our-adventure.md'), d => { d.discord.channel_id = '555'; });
  return dir;
}

const OWNER = '565583270448988163', CLAUDE = '1563042220230053928', CODEX = '1563059804082282516';
const OMS = '1570085138774233170', G = '1563042660044775486';
const msg = (o = {}) => ({author: {id: OWNER, bot: false}, guildId: G, channel: {id: OMS}, content: 'hi', ...o});

test('central project channel IDs override legacy project IDs and reload independently', () => {
  const dir = fixture();
  try {
    updateFrontmatter(path.join(dir,'config','discord.md'), d => { d.project_channels={onemorestep:{channel_id:'central-main',dev_thread_id:'central-dev'}}; });
    const registry=new Registry(dir,{intervalMs:0});const reg=registry.get();
    assert.equal(reg.byChannel.get('central-main').project.slug,'onemorestep');
    assert.equal(reg.byChannel.get('central-dev').kind,'dev');assert.equal(reg.byChannel.has(OMS),false);
    const route=classify(msg({channel:{id:'central-dev'},author:{id:CLAUDE,bot:true},content:`<@${CODEX}> TASK_READY #1`}),{self:'codex',reg});assert.equal(route.mode,'execute');
    updateFrontmatter(path.join(dir,'config','discord.md'),d=>{d.project_channels.onemorestep={channel_id:null,dev_thread_id:null};});
    registry.reload();assert.equal(registry.get().projects.find(p=>p.slug==='onemorestep').channelId,null);assert.equal(registry.get().byChannel.has(OMS),false);
    updateFrontmatter(path.join(dir,'config','discord.md'),d=>{d.project_channels.onemorestep=null;});
    registry.reload();assert.equal(registry.get().byChannel.has(OMS),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('queued project work is cancelled when the registry pauses its project', () => {
  const dir = fixture();
  try {
    const route = classify(msg(), {self: 'claude', reg: loadRegistry(dir)});
    assert.equal(refreshProjectRoute(route, loadRegistry(dir), msg().channel).project.status, 'active');
    updateFrontmatter(path.join(dir, 'projects', 'onemorestep.md'), d => { d.status = 'paused'; });
    assert.throws(() => refreshProjectRoute(route, loadRegistry(dir), msg().channel), /프로젝트 등록이 변경/);
    assert.deepEqual(refreshProjectRoute({lane: 'hq', project: null}, loadRegistry(dir), {}), {lane: 'hq', project: null});
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('paused projects reject owner messages, commands, and peer handoffs for both bots', () => {
  const dir = fixture();
  try {
    // 실제 레지스트리의 our-adventure는 2026-11-17부터 active다. 이 테스트는 paused 동작만 본다.
    updateFrontmatter(path.join(dir, 'projects', 'our-adventure.md'), d => { d.status = 'paused'; d.discord.dev_thread_id = '556'; });
    const reg = loadRegistry(dir);
    for (const self of ['claude', 'codex']) {
      const target = self === 'claude' ? CLAUDE : CODEX;
      const peer = self === 'claude' ? CODEX : CLAUDE;
      for (const message of [
        msg({channel: {id: '555'}, content: `<@${target}> hi`}),
        msg({channel: {id: '557', parentId: '555'}, content: `<@${target}> hi`}),
        msg({channel: {id: '556'}, content: `<@${target}> !status`}),
        msg({channel: {id: '556'}, author: {id: peer, bot: true}, content: `<@${target}> ${self === 'claude' ? 'REVIEW_REQUEST' : 'TASK_READY'} #1`}),
      ]) assert.deepEqual(classify(message, {self, reg}), {kind: 'ignore', reason: 'inactive-project'});
    }
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

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
  const multi = classify(fromCodex(`작업을 마쳤습니다. PR #14를 열었습니다.\n<@${CLAUDE}> REVIEW_REQUEST #13\n된 것: 문서 한 파일`), {self: 'claude', reg});
  assert.equal(multi.mode, 'execute'); assert.deepEqual(multi.keyword, {keyword: 'REVIEW_REQUEST', issue: 13});
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

test('#hq: lead by default, Codex read-only only when called, no bot traffic', () => {
  const reg = loadRegistry(fixture());
  const hq = o => msg({channel: {id: '900'}, ...o});
  assert.equal(classify(hq(), {self: 'claude', reg}).role, 'hq-lead');
  assert.equal(classify(hq(), {self: 'codex', reg}).kind, 'ignore');
  const capOnly = hq({content: `<@${CODEX}> hi`});
  assert.equal(classify(capOnly, {self: 'claude', reg}).kind, 'ignore');
  const cap = classify(capOnly, {self: 'codex', reg});
  assert.equal(cap.role, 'hq-reader'); assert.equal(cap.lane, 'hq'); assert.equal(cap.text, 'hi');
  const both = hq({content: `<@${CLAUDE}> <@${CODEX}> hi`});
  assert.equal(classify(both, {self: 'claude', reg}).role, 'hq-lead');
  assert.equal(classify(both, {self: 'codex', reg}).role, 'hq-reader');
  assert.equal(classify(hq({content: '!codex 상태'}), {self: 'codex', reg}).role, 'hq-reader');
  assert.equal(classify(hq({content: `<@${CODEX}> !status`}), {self: 'codex', reg}).kind, 'command');
  assert.equal(classify(hq({author: {id: CLAUDE, bot: true}, content: `<@${CODEX}> TASK_READY #1`}), {self: 'codex', reg}).kind, 'ignore');
  assert.equal(classify(hq({author: {id: CODEX, bot: true}, content: `<@${CLAUDE}> hi`}), {self: 'claude', reg}).kind, 'ignore');
  assert.equal(classify(msg({guildId: null}), {self: 'claude', reg}).role, 'hq-lead');
  assert.equal(classify(msg({guildId: null}), {self: 'codex', reg}).role, 'hq-reader');
  assert.equal(classify(msg({guildId: null, author: {id: 'x', bot: false}}), {self: 'claude', reg}).kind, 'ignore');
  assert.equal(classify(msg({channel: {id: '900'}, content: '!project new demo stynerk/demo'}), {self: 'claude', reg}).kind, 'command');
});

test('#hq dev thread routes like a project dev thread with the lead as hq-lead', () => {
  const dir = fixture();
  updateFrontmatter(path.join(dir, 'config', 'discord.md'), d => { d.project_channels.hq = {channel_id: '900', dev_thread_id: '950'}; });
  const reg = loadRegistry(dir);
  assert.deepEqual(reg.errors, []);
  const dev = o => msg({channel: {id: '950', parentId: '900'}, ...o});
  const lead = classify(dev(), {self: 'claude', reg});
  assert.equal(lead.role, 'hq-lead'); assert.equal(lead.lane, 'hq'); assert.equal(lead.place, 'dev'); assert.equal(lead.project.slug, 'hq');
  assert.equal(classify(dev(), {self: 'codex', reg}).kind, 'ignore');
  assert.equal(classify(dev({content: `<@${CODEX}> 확인`}), {self: 'codex', reg}).role, 'dev-pm');
  const handoff = classify(dev({author: {id: CLAUDE, bot: true}, content: `<@${CODEX}> TASK_READY #27`}), {self: 'codex', reg});
  assert.equal(handoff.mode, 'execute'); assert.equal(handoff.keyword.issue, 27);
  // #hq 본문과 dev가 아닌 스레드는 그대로 총괄 경로
  assert.equal(classify(msg({channel: {id: '900'}}), {self: 'claude', reg}).project, null);
  assert.equal(classify(msg({channel: {id: '951', parentId: '900'}}), {self: 'claude', reg}).project, null);
  // 다른 프로젝트의 리드는 서비스PM 그대로
  assert.equal(classify(msg(), {self: 'claude', reg}).role, 'service-pm');
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

test('ExchangeCounter counts per Issue so consecutive Issues are not blocked', () => {
  const k = new ExchangeCounter(); const opts = {ownerId: OWNER, botIds: [CLAUDE, CODEX]};
  const hand = (from, kw, n) => msg({author: {id: from, bot: true}, content: `진행 경과\n<@${from === CLAUDE ? CODEX : CLAUDE}> ${kw} #${n}`});
  // Issue 두 개를 정상 흐름(각 4회)으로 이어도 Issue별로는 4회다.
  for (const n of [34, 35]) for (const [from, kw] of [[CLAUDE, 'TASK_READY'], [CODEX, 'REVIEW_REQUEST'], [CLAUDE, 'QA_READY'], [CODEX, 'QA_RESULT']]) k.record(hand(from, kw, n), opts);
  assert.equal(k.count(hand(CLAUDE, 'QA_READY', 35)), 4);
  assert.ok(k.count(hand(CLAUDE, 'QA_READY', 35)) <= BOT_EXCHANGE_LIMIT);
  // 같은 Issue에서 계속 오가면 제한에 걸린다.
  for (let i = 0; i < 3; i++) k.record(hand(CODEX, 'REVIEW_REQUEST', 35), opts);
  assert.ok(k.count(hand(CODEX, 'REVIEW_REQUEST', 35)) > BOT_EXCHANGE_LIMIT);
  // 키워드 없는 협의는 채널 단위로 센다.
  k.record(msg({author: {id: CLAUDE, bot: true}, content: '질문'}), opts);
  assert.equal(k.count(OMS), 1);
  // HJ 메시지는 채널의 Issue별 횟수까지 모두 초기화한다.
  assert.equal(k.warnOnce(hand(CODEX, 'REVIEW_REQUEST', 35)), true);
  k.record(msg(), opts);
  assert.equal(k.count(hand(CODEX, 'REVIEW_REQUEST', 35)), 0);
  assert.equal(k.count(OMS), 0);
  assert.equal(k.warnOnce(hand(CODEX, 'REVIEW_REQUEST', 35)), true);
});

test('parseKeyword and chunk', () => {
  assert.equal(parseKeyword('QA_READY #3', ['QA_READY']).issue, 3);
  assert.equal(parseKeyword('참고 QA_READY #3', ['QA_READY']), null);
  // 진행 경과 뒤 줄에 온 인계는 실행으로 받는다 (Codex 브릿지 출력 형태)
  assert.deepEqual(parseKeyword('커밋과 push 완료.\nREVIEW_REQUEST #13\n된 것: PR #14', ['REVIEW_REQUEST']), {keyword: 'REVIEW_REQUEST', issue: 13});
  // 문장 중간의 키워드, 번호가 다른 줄에만 있는 키워드는 무시
  assert.equal(parseKeyword('다음에 REVIEW_REQUEST #13 보낼게요', ['REVIEW_REQUEST']), null);
  assert.equal(parseKeyword('REVIEW_REQUEST\n#13', ['REVIEW_REQUEST']), null);
  const parts = chunk('a'.repeat(1000) + '\n' + 'b'.repeat(1000) + '\n' + 'c'.repeat(4000));
  assert.ok(parts.every(p => p.length <= 1900));
  assert.equal(parts.join('').replace(/\n/g, '').length, 6000);
  assert.deepEqual(chunk(''), ['(빈 응답)']);
});


test('peer bot handoffs outside the registered dev thread never run', () => {
  const p = {slug:'demo',status:'active'};
  const reg = {ownerId:'owner',guildId:'guild',claudeBotId:'claude',codexBotId:'codex',byChannel:new Map([['main',{project:p,kind:'main'}],['dev',{project:p,kind:'dev'}]])};
  const message = {author:{id:'claude',bot:true},guildId:'guild',channel:{id:'main'},content:'<@codex> TASK_READY #12'};
  assert.equal(classify(message,{self:'codex',reg}).kind,'ignore');
  message.channel={id:'other-thread',parentId:'main'};
  assert.equal(classify(message,{self:'codex',reg}).kind,'ignore');
  message.channel={id:'dev',parentId:'main'};
  assert.equal(classify(message,{self:'codex',reg}).mode,'execute');
});
