import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {windowsAppData} from '../shared/host-settings.mjs';

export function codexCommand({platform = process.platform, env = process.env, exists = existsSync} = {}) {
  if (env.CODEX_EXECUTABLE) return [env.CODEX_EXECUTABLE, []];
  if (platform !== 'win32') return ['codex', []];
  const root = path.win32.join(windowsAppData(env), 'npm/node_modules/@openai/codex');
  const native = path.win32.join(root, 'node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe');
  if (exists(native)) return [native, []];
  return [process.execPath, [path.win32.join(root, 'bin/codex.js')]];
}

export class AppServer extends EventEmitter {
  constructor(command = codexCommand(), options = {}) {
    super(); this.seq = 0; this.pending = new Map(); this.closed = false;
    this.proc = spawn(command[0], [...command[1], 'app-server', '--listen', 'stdio://'], {
      stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: {...process.env, ...options.env},
    });
    // Do not copy agent output, credentials, or prompts into bridge logs.
    this.proc.stderr.resume();
    createInterface({input: this.proc.stdout}).on('line', line => {
      let msg; try { msg = JSON.parse(line); } catch { return; }
      if (msg.method) { this.emit(msg.id === undefined ? 'notification' : 'request', msg); return; }
      const p = this.pending.get(msg.id); if (!p) return;
      clearTimeout(p.timer); this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result);
    });
    const fail = () => {
      if (this.closed) return; this.closed = true;
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Codex App Server disconnected')); }
      this.pending.clear(); this.emit('disconnected');
    };
    this.proc.on('exit', fail); this.proc.on('error', fail);
    this.proc.stdin.on('error', fail);
  }
  send(value) {
    if (this.closed) throw new Error('Codex App Server disconnected');
    this.proc.stdin.write(JSON.stringify(value) + '\n');
  }
  request(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method}: timeout`)); }, 60000);
      this.pending.set(id, {resolve, reject, timer});
      try { this.send({id, method, params}); } catch (e) { clearTimeout(timer); this.pending.delete(id); reject(e); }
    });
  }
  async initialize() {
    await this.request('initialize', {clientInfo: {name: 'local_discord_codex', title: 'Local Discord Codex', version: '1.0.0'}});
    this.send({method: 'initialized'});
  }
  respond(id, result) { this.send({id, result}); }
  close() { this.proc.stdin.end(); this.proc.kill(); }
}

export function chunks(text, limit = 1900) {
  const result = []; let rest = text || '(응답 없음)';
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit);
    if (cut < limit / 2) cut = limit;
    if (/[\uD800-\uDBFF]/.test(rest[cut - 1])) cut--;
    result.push(rest.slice(0, cut)); rest = rest.slice(cut);
  }
  if (rest) result.push(rest);
  return result;
}

export function isOwnerDM(message, ownerId) {
  return !message.author.bot && !message.guildId && message.author.id === ownerId;
}

export function channelInput(message, ownerId, botId, repliesToBot = false, boundChannels = [], allChannels = false) {
  if (message.author.bot || message.author.id !== ownerId) return null;
  const content = (message.content || '').trim();
  const hasFiles = (message.attachments?.size || message.attachments?.length || 0) > 0;
  if (!message.guildId) return content || (hasFiles ? '첨부파일을 읽고 내용을 확인해 주세요.' : '');
  const mention = new RegExp(`<@!?${botId}>`, 'g');
  if (!mention.test(content) && !/^!codex(?:\s|$)/i.test(content) && !repliesToBot && !allChannels && !boundChannels.includes(message.channel.id)) return null;
  return content.replace(mention, '').replace(/^!codex(?:\s|$)/i, '').trim() || (hasFiles ? '첨부파일을 읽고 내용을 확인해 주세요.' : '!help');
}

// A handoff from an allowlisted bot (the PM bot) in an allowlisted channel.
// It must mention this bot and start with an explicit handoff keyword so ordinary
// bot chatter never starts a Codex turn and two bots cannot loop on each other.
export const HANDOFF_KEYWORDS = ['TASK_READY', 'REVIEW_CHANGES'];
export function trustedHandoff(message, botId, trustedBotIds = [], trustedChannelIds = []) {
  if (!message.author?.bot || !trustedBotIds.includes(message.author.id) || message.author.id === botId) return null;
  if (!message.guildId) return null;
  const channelId = message.channel?.id, parentId = message.channel?.parentId;
  if (!trustedChannelIds.includes(channelId) && !(parentId && trustedChannelIds.includes(parentId))) return null;
  const mention = new RegExp(`<@!?${botId}>`, 'g');
  const content = (message.content || '').trim();
  if (!mention.test(content)) return null;
  const text = content.replace(mention, '').trim();
  const first = text.split('\n')[0].trim().split(/\s/)[0];
  return HANDOFF_KEYWORDS.includes(first) ? text : null;
}

export function conversationKey(message) {
  return message.guildId ? `guild:${message.guildId}:channel:${message.channel.id}` : `dm:${message.author.id}`;
}

