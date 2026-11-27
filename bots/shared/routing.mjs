// 메시지 하나를 보고 이 봇이 무엇을 할지 정한다. 디스코드 API를 부르지 않는 순수 함수라 테스트할 수 있다.
// 규칙의 정본: hq playbooks/discord.md
import {locate} from './registry.mjs';

// 상대 봇이 보내면 실행으로 받는 키워드. 키 = 받는 쪽.
export const EXECUTE_KEYWORDS = {
  codex: ['TASK_READY', 'REVIEW_CHANGES', 'QA_READY'],
  claude: ['REVIEW_REQUEST', 'QA_RESULT'],
};
export const BOT_EXCHANGE_LIMIT = 6;

const mentionRe = id => new RegExp(`<@!?${id}>`, 'g');
const mentions = (text, id) => !!id && mentionRe(id).test(text);
const stripMention = (text, id) => (id ? text.replace(mentionRe(id), '') : text).trim();

export function refreshProjectRoute(route, reg, channel) {
  if (!route.project) return route;
  const fresh = locate(reg, channel);
  if (!fresh || fresh.project.slug !== route.lane || fresh.project.status !== 'active') {
    throw new Error('대기 중 프로젝트 등록이 변경되어 작업을 취소했습니다.');
  }
  return {...route, project: fresh.project};
}

/** 키워드가 첫 단어이고 Issue 번호(#숫자)가 있으면 {keyword, issue}. */
/**
 * 어느 줄이든 줄의 첫 단어가 키워드이고 같은 줄에 Issue 번호(#숫자)가 있으면 {keyword, issue}.
 * Codex 브릿지는 진행 경과와 인계를 한 메시지로 올리므로 인계 줄이 맨 앞이 아닐 수 있다
 * (2026-11-17 운영 검증: REVIEW_REQUEST가 중간 줄에 있어 협의로 처리됨). 문장 중간의 키워드는 무시한다.
 */
export function parseKeyword(text, allowed) {
  for (const line of String(text || '').split(/\r?\n/)) {
    const first = line.trim().split(/\s+/)[0] || '';
    if (!allowed.includes(first)) continue;
    const m = /#(\d+)/.exec(line);
    if (m) return {keyword: first, issue: Number(m[1])};
  }
  return null;
}

/** 채널마다 HJ 메시지 이후 봇끼리 주고받은 수를 센다. */
/**
 * 봇끼리 주고받은 횟수. Issue 번호별로 센다(2026-11-17 HJ 결정): 실행 키워드와 #번호가 있는 봇 메시지는
 * `채널#번호`로, 키워드 없는 협의는 채널 단위로 센다. Issue 하나의 정상 인계는 4회라 여러 Issue를 이어도 막히지 않고,
 * 같은 Issue에서 끝없이 오가는 경우만 막는다. HJ 메시지는 그 채널의 모든 횟수를 초기화한다.
 * count·warnOnce는 메시지(그 메시지의 Issue 기준) 또는 채널 ID를 받는다.
 */
const ALL_KEYWORDS = [...EXECUTE_KEYWORDS.codex, ...EXECUTE_KEYWORDS.claude];
export class ExchangeCounter {
  constructor() { this.counts = new Map(); this.warned = new Set(); }
  key(x) {
    if (typeof x !== 'object' || x === null) return String(x);
    const ch = String(x.channel?.id);
    const kw = parseKeyword(String(x.content || '').replace(/<@!?\d+>/g, ''), ALL_KEYWORDS);
    return kw ? `${ch}#${kw.issue}` : ch;
  }
  record(message, {ownerId, botIds}) {
    const ch = String(message.channel?.id);
    if (message.author?.id === ownerId && !message.author.bot) {
      for (const k of [...this.counts.keys()]) if (k === ch || k.startsWith(ch + '#')) this.counts.delete(k);
      for (const k of [...this.warned]) if (k === ch || k.startsWith(ch + '#')) this.warned.delete(k);
      return 0;
    }
    const key = this.key(message);
    if (botIds.includes(message.author?.id)) this.counts.set(key, (this.counts.get(key) || 0) + 1);
    return this.counts.get(key) || 0;
  }
  count(x) { return this.counts.get(this.key(x)) || 0; }
  warnOnce(x) { const id = this.key(x); if (this.warned.has(id)) return false; this.warned.add(id); return true; }
}

export function thanosMentionChannel(reg, channel) {
  if (!channel || channel.isThread?.()) return false;
  if (reg.alertsChannelId && channel.id === reg.alertsChannelId) return false;
  if (reg.archiveCategoryId && channel.parentId === reg.archiveCategoryId) return false;
  const where = locate(reg, channel);
  if (where && (where.kind !== 'main' || where.project.status !== 'active')) return false;
  return channel.id === reg.hqChannelId || channel.id === reg.thanosChannelId || where?.kind === 'main';
}

function classifyThanos(m, reg) {
  if (!reg.thanosBotId || m.author.id === reg.thanosBotId || !reg.guildId || String(m.guildId) !== reg.guildId || !thanosMentionChannel(reg, m.channel)) return {kind: 'ignore'};
  const fromOwner = m.author.id === reg.ownerId && !m.author.bot;
  const fromTony = m.author.id === reg.claudeBotId && m.author.bot;
  const raw = m.content || '';
  if ((!fromOwner && !fromTony) || !mentions(raw, reg.thanosBotId)) return {kind: 'ignore'};
  const text = stripMention(raw, reg.thanosBotId);
  if (!text || text.startsWith('!')) return {kind: 'ignore'};
  const project = locate(reg, m.channel)?.project;
  return {kind: 'chat', lane: String(m.channel.id), text, project};
}

/**
 * @param m 디스코드 메시지 비슷한 객체: {author:{id,bot}, webhookId, guildId, channel:{id,parentId}, content, attachments}
 * @param ctx {self: 'claude'|'codex'|'thanos', reg, repliesToSelf, exchangeCount}
 * @returns {kind: 'ignore'|'unregistered'|'loop-limit'|'command'|'chat', ...}
 */
export function classify(m, {self, reg, repliesToSelf = false, exchangeCount = 0}) {
  const ignore = reason => ({kind: 'ignore', reason});
  if (!m?.author || m.webhookId) return ignore('webhook');
  if (self === 'thanos') return classifyThanos(m, reg);
  const selfId = self === 'claude' ? reg.claudeBotId : reg.codexBotId;
  const peerId = self === 'claude' ? reg.codexBotId : reg.claudeBotId;
  if (m.author.id === selfId) return ignore('self');
  const raw = (m.content || '').trim();
  const text = stripMention(raw, selfId);
  const hasFiles = (m.attachments?.size || m.attachments?.length || 0) > 0;
  const isOwner = m.author.id === reg.ownerId && !m.author.bot;
  const isPeer = !!peerId && m.author.id === peerId && m.author.bot;
  const ownerText = text || (hasFiles ? '첨부파일을 읽고 내용을 확인해 주세요.' : '');

  // DM: HJ만. Claude는 총괄, Codex는 hq 읽기 대화.
  if (!m.guildId) {
    if (!isOwner) return ignore('dm-not-owner');
    if (text.startsWith('!')) return {kind: 'command', text, scope: 'dm'};
    return {kind: 'chat', lane: 'hq', role: self === 'claude' ? 'hq-lead' : 'hq-reader', project: null, mode: 'owner', text: ownerText};
  }
  if (reg.guildId && String(m.guildId) !== reg.guildId) return ignore('other-guild');
  const ch = m.channel || {};
  const chId = String(ch.id);
  if (reg.alertsChannelId && chId === reg.alertsChannelId) return ignore('alerts');
  if (reg.archiveCategoryId && String(ch.parentId) === reg.archiveCategoryId) return ignore('archive');

  // #hq: HJ의 글에만 답한다. 총괄(Claude)이 기본이고, Cap(Codex)은 불렸을 때만 hq 읽기 전용으로 답한다(HJ 지시 2026-11-26).
  // 봇끼리는 #hq에서 주고받지 않는다(인계는 dev 스레드).
  // 단, #hq 아래의 등록된 dev 스레드(hq 프로젝트)는 프로젝트 dev 스레드와 같이 처리한다(HJ 결정 2026-11-26).
  const where = locate(reg, ch);
  const calledThanos = mentions(raw, reg.thanosBotId) && thanosMentionChannel(reg, ch);
  if (isOwner && self === 'claude' && calledThanos && !mentions(raw, selfId) && !repliesToSelf) return ignore('owner-not-for-me');
  if (reg.hqChannelId && where?.kind !== 'dev' && (chId === reg.hqChannelId || String(ch.parentId) === reg.hqChannelId)) {
    if (!isOwner) return ignore('hq-channel');
    const calledSelf = mentions(raw, selfId) || repliesToSelf || (self === 'codex' && /^!codex(\s|$)/i.test(raw));
    const calledPeer = mentions(raw, peerId);
    if (self === 'claude' ? (!calledSelf && calledPeer) : !calledSelf) return ignore('owner-not-for-me');
    const cleaned = self === 'codex' ? text.replace(/^!codex(\s|$)/i, '').trim() : text;
    if (cleaned.startsWith('!')) return {kind: 'command', text: cleaned, scope: 'hq'};
    return {kind: 'chat', lane: 'hq', role: self === 'claude' ? 'hq-lead' : 'hq-reader', project: null, mode: 'owner', text: cleaned || ownerText};
  }

  if (!where) {
    if (isOwner && text.startsWith('!hq init')) return {kind: 'command', text, scope: 'anywhere'};
    if (isOwner && (mentions(raw, selfId) || repliesToSelf)) return {kind: 'unregistered', channelId: chId};
    return ignore('unregistered');
  }
  const {project, kind: place} = where;
  if (project.status === 'archived') return ignore('archived');
  if (project.status !== 'active') return ignore('inactive-project');
  const lane = project.slug;
  const role = self === 'claude' ? (project.leadRole || 'service-pm') : 'dev-pm';
  const base = {lane, role, project, place};

  if (isOwner) {
    const calledSelf = mentions(raw, selfId) || repliesToSelf || (self === 'codex' && /^!codex(\s|$)/i.test(raw));
    const calledPeer = mentions(raw, peerId);
    const cleaned = self === 'codex' ? text.replace(/^!codex(\s|$)/i, '').trim() : text;
    let respond;
    if (self === 'claude') respond = calledSelf || !calledPeer; // 서비스PM이 기본 창구
    else respond = calledSelf; // 개발PM은 불렀을 때만
    if (!respond) return ignore('owner-not-for-me');
    if (cleaned.startsWith('!')) return {kind: 'command', text: cleaned, scope: 'project', ...base};
    return {kind: 'chat', ...base, mode: 'owner', text: cleaned || (hasFiles ? '첨부파일을 읽고 내용을 확인해 주세요.' : '!help')};
  }

  if (isPeer) {
    if (place !== 'dev') return ignore('peer-outside-dev');
    if (!mentions(raw, selfId)) return ignore('peer-not-mentioning');
    if (exchangeCount > BOT_EXCHANGE_LIMIT) return {kind: 'loop-limit', ...base};
    const kw = parseKeyword(text, EXECUTE_KEYWORDS[self]);
    return {kind: 'chat', ...base, mode: kw ? 'execute' : 'consult', keyword: kw, text};
  }
  return ignore('not-owner-or-peer');
}

/** 디스코드 2000자 제한에 맞춰 자른다. 코드 블록 안에서 자르지 않도록 줄 단위로. */
export function chunk(text, limit = 1900) {
  const out = []; let cur = '';
  for (const line of String(text || '').split('\n')) {
    if (line.length > limit) { if (cur) { out.push(cur); cur = ''; } for (let i = 0; i < line.length; i += limit) out.push(line.slice(i, i + limit)); continue; }
    if ((cur + '\n' + line).length > limit) { out.push(cur); cur = line; } else cur = cur ? cur + '\n' + line : line;
  }
  if (cur) out.push(cur);
  return out.length ? out : ['(빈 응답)'];
}

