// hq 레지스트리 읽기: projects/*.md, config/discord.md, agents/**/*.md 의 프론트매터와 본문.
// 두 봇(Claude 릴레이, Codex 브릿지)이 같은 모듈로 채널 → 프로젝트·역할을 정한다.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {normalizeSchedules} from './schedule.mjs';

export function splitFrontmatter(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return {data: {}, body: normalized};
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) return {data: {}, body: normalized};
  const data = YAML.parse(normalized.slice(4, end)) || {};
  return {data, body: normalized.slice(end + 5)};
}

export function joinFrontmatter(data, body) {
  return `---\n${YAML.stringify(data, {lineWidth: 0}).trimEnd()}\n---\n${body}`;
}

/** 파일의 프론트매터만 바꾸고 본문은 그대로 둔다. */
export function updateFrontmatter(file, mutate) {
  const {data, body} = splitFrontmatter(fs.readFileSync(file, 'utf8'));
  mutate(data);
  fs.writeFileSync(file, joinFrontmatter(data, body));
  return data;
}

const str = v => (v === null || v === undefined || v === '' ? null : String(v));

function readDir(dir) {
  try { return fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md').sort(); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}

export function loadRegistry(hqRoot) {
  const discordFile = path.join(hqRoot, 'config', 'discord.md');
  const discord = splitFrontmatter(fs.readFileSync(discordFile, 'utf8')).data;
  const projects = [];
  const byChannel = new Map();
  const errors = [];
  for (const f of readDir(path.join(hqRoot, 'projects'))) {
    const file = path.join(hqRoot, 'projects', f);
    const {data, body} = splitFrontmatter(fs.readFileSync(file, 'utf8'));
    if (data.slug !== path.basename(f, '.md')) { errors.push(`${f}: slug가 파일 이름과 다르다`); continue; }
    // New IDs live only in config/discord.md. Read legacy project metadata until migrated.
    const channelConfig = Object.hasOwn(discord.project_channels || {}, data.slug) ? discord.project_channels[data.slug] : data.discord;
    // 예약 정의 오류는 레지스트리 전체를 막지 않는다. 잘못된 항목만 빼고 !schedule list에 보인다.
    const {schedules, errors: scheduleErrors} = normalizeSchedules(data.slug, data.schedules);
    const p = {
      schedules, scheduleErrors,
      slug: data.slug, title: data.title || data.slug, status: data.status || 'paused',
      repo: data.repo || null, localPath: data.local_path || null,
      channelId: str(channelConfig?.channel_id), devThreadId: str(channelConfig?.dev_thread_id),
      servicePm: data.agents?.service_pm || {name: 'Tony'}, devPm: data.agents?.dev_pm || {name: 'Cap'},
      gates: data.gates || [], body, file,
    };
    projects.push(p);
    for (const [id, kind] of [[p.channelId, 'main'], [p.devThreadId, 'dev']]) {
      if (!id) continue;
      if (byChannel.has(id)) errors.push(`${f}: 채널 ${id}가 ${byChannel.get(id).project.slug}와 겹친다`);
      else byChannel.set(id, {project: p, kind});
    }
  }
  const agents = new Map();
  for (const sub of ['', 'subagents']) {
    for (const f of readDir(path.join(hqRoot, 'agents', sub))) {
      const {data, body} = splitFrontmatter(fs.readFileSync(path.join(hqRoot, 'agents', sub, f), 'utf8'));
      if (data.name) agents.set(data.name, {data, body});
    }
  }
  return {
    hqRoot, discord, projects, byChannel, agents, errors,
    ownerId: str(discord.owner?.user_id),
    guildId: str(discord.guild_id),
    claudeBotId: str(discord.bots?.claude_relay?.user_id),
    codexBotId: str(discord.bots?.codex_bridge?.user_id),
    hqChannelId: str(discord.channels?.hq),
    alertsChannelId: str(discord.channels?.hq_alerts),
    archiveCategoryId: str(discord.categories?.archive),
  };
}

/** 파일이 바뀌면 다시 읽는다. 읽다가 깨지면 직전 정상 상태를 유지하고 오류를 남긴다. */
export class Registry {
  constructor(hqRoot, {intervalMs = 5000} = {}) {
    this.hqRoot = hqRoot; this.intervalMs = intervalMs; this.lastError = null;
    this.value = loadRegistry(hqRoot); this.stamp = this.#stamp(); this.checked = Date.now();
  }
  #stamp() {
    const files = [path.join(this.hqRoot, 'config', 'discord.md')];
    for (const d of ['projects', 'agents', 'agents/subagents']) for (const f of readDir(path.join(this.hqRoot, d))) files.push(path.join(this.hqRoot, d, f));
    return files.map(f => { try { return `${f}:${fs.statSync(f).mtimeMs}`; } catch { return `${f}:x`; } }).join('|');
  }
  get() {
    if (Date.now() - this.checked < this.intervalMs) return this.value;
    this.checked = Date.now();
    const s = this.#stamp();
    if (s !== this.stamp) {
      try { this.value = loadRegistry(this.hqRoot); this.stamp = s; this.lastError = null; }
      catch (e) { this.lastError = `레지스트리 읽기 실패: ${e.message}`; }
    }
    return this.value;
  }
  reload() { this.checked = 0; this.stamp = ''; return this.get(); }
}

/** 메시지가 속한 프로젝트와 위치(main | dev | thread). 스레드는 부모 채널로 찾는다. */
export function locate(reg, channel) {
  if (!channel) return null;
  const direct = reg.byChannel.get(String(channel.id));
  if (direct) return direct;
  if (channel.parentId) {
    const parent = reg.byChannel.get(String(channel.parentId));
    if (parent && parent.kind === 'main') return {project: parent.project, kind: 'thread'};
  }
  return null;
}

