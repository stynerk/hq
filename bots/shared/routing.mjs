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
export function parseKeyword(text, allowed) {
  const first = text.trim().split(/\s+/)[0] || '';
  if (!allowed.includes(first)) return null;
  const m = /#(\d+)/.exec(text);
  return m ? {keyword: first, issue: Number(m[1])} : null;
}

/** 채널마다 HJ 메시지 이후 봇끼리 주고받은 수를 센다. */
export class ExchangeCounter {
  constructor() { this.counts = new Map(); this.warned = new Set(); }
  record(message, {ownerId, botIds}) {
    const id = String(message.channel?.id);
    if (message.author?.id === ownerId && !message.author.bot) { this.counts.set(id, 0); this.warned.delete(id); }
    else if (botIds.includes(message.author?.id)) this.counts.set(id, (this.counts.get(id) || 0) + 1);
    return this.counts.get(id) || 0;
  }
  count(channelId) { return this.counts.get(String(channelId)) || 0; }
  warnOnce(channelId) { const id = String(channelId); if (this.warned.has(id)) return false; this.warned.add(id); return true; }
}

/**
 * @param m 디스코드 메시지 비슷한 객체: {author:{id,bot}, webhookId, guildId, channel:{id,parentId}, content, attachments}
 * @param ctx {self: 'claude'|'codex', reg, repliesToSelf, exchangeCount}
 * @returns {kind: 'ignore'|'unregistered'|'loop-limit'|'command'|'chat', ...}
 */
export function classify(m, {self, reg, repliesToSelf = false, exchangeCount = 0}) {
  const selfId = self === 'claude' ? reg.claudeBotId : reg.codexBotId;
  const peerId = self === 'claude' ? reg.codexBotId : reg.claudeBotId;
  const ignore = reason => ({kind: 'ignore', reason});
  if (!m?.author || m.webhookId) return ignore('webhook');
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

  // #hq: 총괄(Claude)만 답한다.
  if (reg.hqChannelId && (chId === reg.hqChannelId || String(ch.parentId) === reg.hqChannelId)) {
    if (self !== 'claude' || !isOwner) return ignore('hq-channel');
    if (text.startsWith('!')) return {kind: 'command', text, scope: 'hq'};
    return {kind: 'chat', lane: 'hq', role: 'hq-lead', project: null, mode: 'owner', text: ownerText};
  }

  const where = locate(reg, ch);
  if (!where) {
    if (isOwner && text.startsWith('!hq init')) return {kind: 'command', text, scope: 'anywhere'};
    if (isOwner && (mentions(raw, selfId) || repliesToSelf)) return {kind: 'unregistered', channelId: chId};
    return ignore('unregistered');
  }
  const {project, kind: place} = where;
  if (project.status === 'archived') return ignore('archived');
  if (project.status !== 'active') return ignore('inactive-project');
  const lane = project.slug;
  const role = self === 'claude' ? 'service-pm' : 'dev-pm';
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

