import { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { chunks } from './rpc.mjs';
import {Registry, locate} from '../shared/registry.mjs';
import {classify, ExchangeCounter, refreshProjectRoute} from '../shared/routing.mjs';
import {LaneJobs} from '../shared/lane-jobs.mjs';
import {executionContext, trustedAttachmentSource, canRequestApproval} from './policy.mjs';
import { ProfileServers, selectProfile, profileSessionKey } from './profiles.mjs';
import { AttachmentStore, attachmentList } from './attachments.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const privateDir = process.env.BRIDGE_PRIVATE_DIR || 'C:/Users/styne/orca/discord-codex/private';
const hqRoot = process.env.HQ_ROOT || 'C:/Users/styne/orca/hq';
const registry = new Registry(hqRoot);
const exchanges = new ExchangeCounter();
fs.mkdirSync(privateDir, {recursive: true});
const configPath = path.join(privateDir, 'config.json');
const statePath = path.join(privateDir, 'state.json');
const workspace = hqRoot;
const readJSON = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; } };
function save(p, value) { fs.writeFileSync(p + '.tmp', JSON.stringify(value, null, 2)); fs.renameSync(p + '.tmp', p); }
function dpapi(value, decrypt = false) {
  const script = decrypt
    ? '$s=[Console]::In.ReadToEnd() | ConvertTo-SecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}'
    : '$s=ConvertTo-SecureString ([Console]::In.ReadToEnd()) -AsPlainText -Force; [Console]::Out.Write(($s | ConvertFrom-SecureString))';
  return new Promise((resolve, reject) => {
    const p = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {windowsHide: true}, (err, out) => err ? reject(new Error('Windows credential encryption failed')) : resolve(out.trim()));
    p.stdin.end(value);
  });
}

const routingPath = path.join(privateDir, 'routing.json');
if (!fs.existsSync(routingPath)) save(routingPath, {
  businessOnly: true,
  managedAccountsRoot: path.join(process.env.APPDATA, 'orca', 'codex-accounts'),
  profiles: {
    business: {home: null, workspace},
  },
  channels: {},
});
const rpc = new ProfileServers(routingPath);
await rpc.initialize();
const account = await rpc.request('account/read', {refreshToken: false});
if (!account.account) throw new Error('Codex 로그인이 필요합니다: codex.cmd login');
if (process.argv.includes('--check')) {
  const t = await rpc.request('thread/start', {cwd: workspace, sandbox: 'workspace-write', approvalPolicy: 'on-request', ephemeral: true});
  console.log(JSON.stringify({appServer: 'ok', accountType: account.account.type, thread: !!t.thread.id, workspace}));
  rpc.close(); process.exit(0);
}

let config = readJSON(configPath, null), client = null;
const attachmentStore = new AttachmentStore(path.join(privateDir, 'attachments'), config?.attachments);
let state = readJSON(statePath, {threadId: null});
state.sessions ??= {};
// Preserve the legacy conversation only for the owner's DM, never a server channel.
if (state.threadId && config && !state.sessions[`dm:${config.ownerId}`]) {
  state.sessions[`dm:${config.ownerId}`] = state.threadId;
  delete state.threadId; save(statePath, state);
}
let runtimeStatus = '설정 대기', lastError = null;
const jobs = new LaneJobs({seen: state.seen || [], persist: seen => {state.seen = seen; save(statePath, state);}});
const approvals = new Map();
const send = async (channel, text, extra = {}) => {
  for (const content of chunks(text)) await channel.send({content, allowedMentions: {parse: []}, ...extra});
};
function clearApprovals(threadId) {
  for (const [key, entry] of approvals) {
    if (threadId && entry.threadId !== threadId) continue;
    clearTimeout(entry.timer);
    try { rpc.respond(entry.id, {decision: 'cancel'}); } catch {}
    approvals.delete(key);
  }
}
rpc.on('disconnected', profile => {
  runtimeStatus = 'Codex 연결 끊김 — 프로그램을 재시작하세요';
  for (const lane of jobs.lanes.values()) {
    if (lane.active?.profile !== profile) continue;
    if (lane.active.typing) clearInterval(lane.active.typing);
    void send(lane.active.channel, runtimeStatus).catch(() => {});
    clearApprovals(lane.active.threadId); lane.active = null; lane.queue.length = 0;
  }
  // A supervised restart avoids leaving disconnected profiles and queues stuck.
  process.exitCode = 1; setImmediate(shutdown);
});
rpc.on('request', msg => {
  void handleRequest(msg).catch(() => {
    try { rpc.send({id: msg.id, error: {code: -32603, message: 'Discord approval delivery failed'}}); } catch {}
  });
});
async function handleRequest(msg) {
  const {id, method, params: p} = msg;
  const active = jobs.find(p.threadId)?.active;
  if (active && !canRequestApproval(active) && ['item/commandExecution/requestApproval', 'item/fileChange/requestApproval'].includes(method)) { rpc.respond(id, {decision: 'decline'}); return; }
  if (active && msg.profile === active.profile && p.threadId === active.threadId && ['item/commandExecution/requestApproval', 'item/fileChange/requestApproval'].includes(method)) {
    const key = crypto.randomBytes(10).toString('hex');
    const timer = setTimeout(() => {
      if (!approvals.has(key)) return;
      approvals.delete(key); rpc.respond(id, {decision: 'cancel'});
      void send(active?.channel || channel, '승인 시간이 지나 요청을 취소했습니다.').catch(() => {});
    }, 5 * 60 * 1000);
    const channel = active.channel;
    approvals.set(key, {id, timer, threadId: p.threadId, channelId: channel.id});
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`approve:${key}`).setLabel('이번 요청 허용').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`deny:${key}`).setLabel('거절').setStyle(ButtonStyle.Danger));
    const detail = JSON.stringify({command: p.command, cwd: p.cwd, reason: p.reason, grantRoot: p.grantRoot});
    await send(channel, `Codex 승인 요청\n${detail.slice(0, 1500)}`, {components: [row]});
  } else if (method === 'item/permissions/requestApproval') rpc.respond(id, {permissions: {}, scope: 'turn'});
  else if (method === 'mcpServer/elicitation/request') rpc.respond(id, {action: 'decline', content: null});
  else if (method === 'item/tool/requestUserInput') {
    rpc.respond(id, {answers: {}});
    if (active) await send(active.channel, 'Codex가 추가 입력을 요청했습니다. 질문에 대한 답을 다음 메시지로 보내 주세요.\n' + JSON.stringify(p.questions).slice(0, 1400));
  } else rpc.send({id, error: {code: -32601, message: 'This request is not supported by the Discord bridge'}});
}
rpc.on('notification', msg => {
  void handleNotification(msg).catch(() => { lastError = 'Discord 응답 전송 실패'; console.error(lastError); });
});
async function handleNotification({method, params: p, profile}) {
  const lane = jobs.find(p.threadId);
  const active = lane?.active;
  if (!active || profile !== active.profile || p.threadId !== active.threadId) return;
  if (method === 'item/completed' && p.item.type === 'agentMessage') active.messages.set(p.item.id, p.item.text);
  if (method === 'turn/completed') {
    const done = active; clearApprovals(done.threadId);
    if (done.typing) clearInterval(done.typing);
    const answer = [...done.messages.values()].join('\n\n');
    try {
    await send(done.channel, answer || (p.turn.status === 'interrupted' ? '작업을 중지했습니다.' : p.turn.error?.message || '작업을 완료했습니다.'));
    if (p.turn.status === 'failed' && answer) await send(done.channel, '작업 실패: ' + (p.turn.error?.message || '원인 확인 필요'));
    } finally { lane.active = null; drain(lane); }

  }
}
async function startDiscord() {
  if (client) { client.destroy(); client = null; }
  if (config.botId !== registry.get().codexBotId || config.ownerId !== registry.get().ownerId) throw new Error('기존 봇 설정과 레지스트리 ID가 다릅니다. 설정 페이지를 확인하세요.');
  const token = await dpapi(config.tokenEncrypted, true);
  const bot = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent], partials: [Partials.Channel]});
  bot.on('error', () => { lastError = 'Discord 연결 오류'; });
  bot.on('shardDisconnect', () => { runtimeStatus = 'Discord 재연결 중'; });
  bot.on('shardReady', () => { runtimeStatus = 'Discord 연결됨'; });
  bot.once('clientReady', () => { runtimeStatus = 'Discord 연결됨'; if (bot.user.id !== registry.get().codexBotId) { console.error('Codex bot identity mismatch'); bot.destroy(); process.exitCode = 1; } else console.log('Discord bot connected; registry routing enabled.'); });
  bot.on('messageCreate', message => { void handleMessage(message).catch(async () => {
    lastError = '요청 처리 실패 — !status로 연결 상태를 확인하세요.';
    await send(message.channel, lastError).catch(() => {});
  }); });
  bot.on('interactionCreate', interaction => { void handleInteraction(interaction).catch(() => {}); });
  try { await bot.login(token); client = bot; } catch { bot.destroy(); runtimeStatus = 'Discord 로그인 실패: 토큰과 Message Content Intent를 확인하세요'; throw new Error(runtimeStatus); }
}
async function handleInteraction(i) {
  if (!i.isButton() || i.user.id !== registry.get().ownerId) return;
  const [action, key] = i.customId.split(':');
  const entry = approvals.get(key);
  if (!entry || entry.channelId !== i.channelId || !['approve', 'deny'].includes(action)) {
    await i.reply({content: '만료된 승인 요청입니다.', flags: 64}); return;
  }
  clearTimeout(entry.timer); approvals.delete(key);
  rpc.respond(entry.id, {decision: action === 'approve' ? 'accept' : 'decline'});
  await i.update({content: action === 'approve' ? '승인했습니다.' : '거절했습니다.', components: []});
}
function drain(lane) {
  if (lane.active || lane.starting) return;
  const next = lane.queue.shift();
  if (next) void executeMessage(next.m, next.route, lane).catch(() => {});
}
async function handleMessage(m) {
  const reg = registry.get();
  if (reg.errors.length || registry.lastError) return;
  if (locate(reg, m.channel)) exchanges.record(m, {ownerId: reg.ownerId, botIds: [reg.claudeBotId, reg.codexBotId]});
  let repliesToSelf = false;
  if (m.author.id === reg.ownerId && m.reference?.messageId) {
    try { repliesToSelf = (await m.fetchReference()).author.id === reg.codexBotId; } catch {}
  }
  const route = classify(m, {self: 'codex', reg, repliesToSelf, exchangeCount: exchanges.count(m.channel.id)});
  if (route.kind === 'ignore') return;
  if (!jobs.claim(m.id)) return;
  if (route.kind === 'unregistered') return; // playbooks/discord.md 2절: 채널에서는 아무도 답하지 않는다. #hq 알림은 Tony가 한다.
  if (route.kind === 'loop-limit') {
    if (exchanges.warnOnce(m.channel.id)) await send(m.channel, '봇끼리 6회 초과, 서비스PM이 owner-decision으로 올려 주세요');
    return;
  }
  const laneId = route.lane || 'hq';
  const lane = jobs.get(laneId);
  if (route.kind === 'command') {
    if (route.text === '!status') return send(m.channel, `${runtimeStatus}\n프로젝트: ${laneId}\n작업 폴더: ${route.project?.localPath || hqRoot}\n작업 중: ${!!lane.active || lane.starting} / 대기: ${lane.queue.length}`);
    if (route.text === '!stop') {
      const active = jobs.stop(laneId).active;
      if (active?.turnId) await rpc.request('turn/interrupt', {threadId: active.threadId, turnId: active.turnId});
      return send(m.channel, '이 프로젝트의 대기 작업을 취소하고 진행 중인 작업에 중지를 요청했습니다.');
    }
    if (route.text === '!new') {
      if (lane.active || lane.starting) return send(m.channel, '먼저 !stop으로 작업을 중지하세요.');
      for (const key of Object.keys(state.sessions)) if (key.startsWith(`${laneId}|${m.channel.id}|`)) delete state.sessions[key];
      for (const mode of ['read','write']) attachmentStore.clear(`${laneId}|${m.channel.id}|${mode}|owner:${reg.ownerId}|bot:${reg.codexBotId}`);
      save(statePath, state); return send(m.channel, '이 채널의 세션과 첨부 참조를 초기화했습니다.');
    }
    return send(m.channel, '!status / !new / !stop — 프로젝트 채널에서는 @Codex_bot 또는 !codex로 호출하세요.');
  }
  if (lane.active || lane.starting) {
    if (lane.queue.length >= 20) return send(m.channel, '프로젝트 대기열이 가득 찼습니다. 완료 후 다시 요청하세요.');
    lane.queue.push({m, route}); return send(m.channel, '이 프로젝트의 대기열에 넣었습니다.');
  }
  await executeMessage(m, route, lane);
}
async function executeMessage(m, route, lane) {
  lane.starting = true;
  const epoch = lane.epoch;
  try {
    const reg = registry.get();
    route = refreshProjectRoute(route, reg, m.channel);
    const ctx = executionContext(route, reg);
    const key = `${route.lane}|${m.channel.id}|${ctx.sandbox === 'read-only' ? 'read' : 'write'}`;
    const attachmentScope = `${key}|owner:${reg.ownerId}|bot:${reg.codexBotId}`;
    const prepared = await attachmentStore.prepare(m, attachmentScope, ctx.text, source => trustedAttachmentSource(source, reg, route));
    if (prepared.errors.length) await send(m.channel, '첨부 처리 실패:\n' + prepared.errors.join('\n'));
    if (prepared.blocked || epoch !== lane.epoch) return;
    const opts = {$profile: 'business', cwd: ctx.cwd, sandbox: ctx.sandbox, approvalPolicy: ctx.sandbox === 'read-only' ? 'never' : 'on-request', approvalsReviewer: 'auto_review', developerInstructions: ctx.developerInstructions};
    if (!state.sessions[key]) {
      const result = await rpc.request('thread/start', opts);
      state.sessions[key] = result.thread.id; save(statePath, state);
    } else await rpc.request('thread/resume', {threadId: state.sessions[key], ...opts});
    if (epoch !== lane.epoch) return;
    const active = {profile: 'business', readOnly: ctx.sandbox === 'read-only', sandbox: ctx.sandbox, key, threadId: state.sessions[key], channel: m.channel, messages: new Map(), turnId: null};
    lane.active = active;
    await m.channel.sendTyping();
    if (epoch !== lane.epoch) { lane.active = null; return; }
    active.typing = setInterval(() => {void m.channel.sendTyping().catch(() => {});}, 8000);
    const result = await rpc.request('turn/start', {threadId: active.threadId, input: prepared.input});
    active.turnId = result.turn.id;
    if (epoch !== lane.epoch && lane.active === active) await rpc.request('turn/interrupt', {threadId: active.threadId, turnId: active.turnId});
  } catch (e) {
    if (lane.active?.typing) clearInterval(lane.active.typing);
    lane.active = null;
    await send(m.channel, `Codex 요청 실패: ${e.message}\n세션 오류라면 !new로 초기화하세요.`);
  } finally { lane.starting = false; drain(lane); }
}

const setupKey = crypto.randomBytes(24).toString('hex');
const page = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Discord ↔ Codex</title><style>body{font:16px system-ui;background:#10151e;color:#e6edf7;max-width:640px;margin:60px auto;padding:24px}input,button{font:inherit;box-sizing:border-box;width:100%;padding:12px;margin:8px 0 20px;border-radius:8px}button{background:#83d9be;border:0;cursor:pointer}a{color:#83d9be}small{color:#b2c0d3}#status{white-space:pre-wrap}</style><h1>Discord ↔ Codex</h1><p>ChatGPT 계정으로 로그인한 Codex App Server를 연결합니다.</p><p>작업 폴더: HQ 프로젝트 레지스트리 · 지정한 사용자만 허용</p><p id="status">상태 확인 중…</p><form id="form"><label>별도 Discord 봇 토큰<input id="token" type="password" autocomplete="new-password" required></label><small>Claude 봇과 다른 봇을 사용하세요. Developer Portal → Bot → Message Content Intent 켜기.</small><p><a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">Discord Developer Portal 열기</a></p><label>본인의 Discord 사용자 ID<input id="owner" inputmode="numeric" pattern="[0-9]{17,20}" required></label><small>Discord 설정 → 고급 → 개발자 모드 → 본인 프로필에서 사용자 ID 복사.</small><button>저장하고 연결</button></form><p id="invite"></p><small>토큰은 Windows 계정의 DPAPI로 암호화해 이 PC에 저장합니다. 브라우저를 닫아도 프로그램이 실행 중이면 연결을 유지합니다.</small><script>const key=new URLSearchParams(location.search).get('key');async function status(){let r=await fetch('/status?key='+key);let s=await r.json();document.querySelector('#status').textContent=s.status+(s.error?'\\n'+s.error:'');if(s.botId){const a=document.createElement('a');a.href='https://discord.com/oauth2/authorize?client_id='+s.botId+'&scope=bot&permissions=274877975552';a.textContent='봇을 서버에 초대하기 → 이후 봇에게 DM 보내기';document.querySelector('#invite').replaceChildren(a)}}document.querySelector('#form').onsubmit=async e=>{e.preventDefault();let b=document.querySelector('button');b.disabled=true;try{let r=await fetch('/setup?key='+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:document.querySelector('#token').value,ownerId:document.querySelector('#owner').value})});let s=await r.json();document.querySelector('#token').value='';if(!r.ok)alert(s.error);await status()}finally{b.disabled=false}};status();setInterval(status,5000)</script></html>`;
let configuring = false;
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  const url = new URL(req.url, 'http://127.0.0.1:38471');
  const origin = 'http://127.0.0.1:38471';
  const respond = (code, value) => { res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(value)); };
  if (req.headers.host !== '127.0.0.1:38471' || url.searchParams.get('key') !== setupKey) return respond(403, {error: 'Forbidden'});
  if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(page); return; }
  if (req.method === 'GET' && url.pathname === '/status') return respond(200, {status: runtimeStatus, error: lastError, botId: config?.botId, guildCount: client?.guilds.cache.size || 0, busy: jobs.anyBusy(), accounts: rpc.accounts, approvalMode: 'auto_review', attachments: {enabled:true, ...attachmentStore.options}});
  if (req.method !== 'POST' || url.pathname !== '/setup' || req.headers.origin !== origin || req.headers['content-type'] !== 'application/json') return respond(403, {error: 'Forbidden'});
  if (configuring || jobs.anyBusy()) return respond(409, {error: '요청 처리 중입니다. 잠시 후 다시 시도하세요.'});
  configuring = true;
  try {
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 8192) throw new Error('입력이 너무 깁니다.'); }
    const {token, ownerId} = JSON.parse(body);
    if (typeof token !== 'string' || !token.trim() || !/^\d{17,20}$/.test(ownerId)) throw new Error('봇 토큰과 본인 사용자 ID를 확인하세요.');
    const r = await fetch('https://discord.com/api/v10/users/@me', {headers: {Authorization: 'Bot ' + token.trim()}, signal: AbortSignal.timeout(15000)});
    if (!r.ok) throw new Error('Discord가 토큰을 거절했습니다. 새 봇 토큰을 확인하세요.');
    const bot = await r.json();
    const previous = config;
    if (ownerId !== registry.get().ownerId || bot.id !== registry.get().codexBotId) throw new Error('레지스트리의 owner/bot ID와 다릅니다.');
    config = {tokenEncrypted: await dpapi(token.trim()), ownerId, botId: bot.id, attachments: previous?.attachments || {}};
    try { await startDiscord(); } catch (e) { config = previous; throw e; }
    if (previous && previous.ownerId !== ownerId) { state = {sessions: {}}; save(statePath, state); }
    save(configPath, config); lastError = null;
    respond(200, {ok: true});
  } catch (e) { lastError = e.message; respond(400, {error: e.message}); }
  finally { configuring = false; }
});
server.on('error', () => { console.error('설정 포트 38471을 사용할 수 없습니다. 기존 실행을 확인하세요.'); rpc.close(); process.exit(1); });
server.listen(38471, '127.0.0.1', () => {
  const url = `http://127.0.0.1:38471/?key=${setupKey}`;
  fs.writeFileSync(path.join(privateDir, 'setup-url.txt'), url);
  console.log('Local setup ready on 127.0.0.1:38471');
});
if (config) { try { await startDiscord(); } catch (e) { lastError = e.message; } }
function shutdown() { clearApprovals(); for (const lane of jobs.lanes.values()) { if (lane.active?.typing) clearInterval(lane.active.typing); lane.queue.length = 0; } client?.destroy(); rpc.close(); server.close(); process.exit(process.exitCode || 0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);

