import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import {AppServer, codexCommand} from './rpc.mjs';

export function isBusinessPlan(plan) { return ['business', 'team', 'enterprise', 'edu'].includes(plan); }
export function selectProfile(message, routing) {
  if (routing.businessOnly) return 'business';
  if (!message.guildId) return 'personal';
  return routing.channels[message.channel.id] || routing.channels[message.channel.parentId] || null;
}
export function profileSessionKey(profile, key) { return `${profile}|${key}`; }

export function discoverBusinessHome(root) {
  if (!root || !fs.existsSync(root)) return null;
  const visit = (dir, depth) => {
    if (depth > 4) return null;
    const auth = path.join(dir, 'auth.json');
    if (fs.existsSync(auth)) {
      try {
        const cached = JSON.parse(fs.readFileSync(auth, 'utf8'));
        const claims = JSON.parse(Buffer.from(cached.tokens.id_token.split('.')[1], 'base64url').toString('utf8'));
        // This hint only selects a candidate home. account/read below validates
        // the actual authenticated workspace before any prompt is submitted.
        if (isBusinessPlan(claims['https://api.openai.com/auth']?.chatgpt_plan_type)) return dir;
      } catch {}
    }
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        const found = visit(path.join(dir, entry.name), depth + 1); if (found) return found;
      }
    }
    return null;
  };
  return visit(root, 0);
}

// Each profile owns its App Server and credentials. Thread ownership is explicit;
// never fall back to a different account when login or workspace validation fails.
export class ProfileServers extends EventEmitter {
  constructor(routingPath, factory = (home) => new AppServer(codexCommand(), {env: {CODEX_HOME: home}})) {
    super(); this.routingPath = routingPath; this.factory = factory;
    this.servers = new Map(); this.threads = new Map(); this.accounts = {};
  }
  routing() { return JSON.parse(fs.readFileSync(this.routingPath, 'utf8')); }
  async backend(profile) {
    if (!['personal', 'business'].includes(profile)) throw new Error('Unknown account profile');
    if (this.routing().businessOnly && profile !== 'business') throw new Error('Discord는 Business 계정 전용입니다. 개인 계정 연결은 해제됐습니다.');
    if (this.servers.has(profile)) return this.servers.get(profile);
    const routing = this.routing();
    const settings = routing.profiles[profile];
    if (profile === 'business' && !settings?.home) {
      const home = discoverBusinessHome(routing.managedAccountsRoot);
      if (home) {
        settings.home = home;
        fs.writeFileSync(this.routingPath + '.tmp', JSON.stringify(routing, null, 2));
        fs.renameSync(this.routingPath + '.tmp', this.routingPath);
      }
    }
    if (!settings?.home) throw new Error(`${profile}: Orca에서 계정 로그인을 먼저 완료하세요.`);
    const server = this.factory(settings.home);
    const pending = (async () => {
      try {
        server.on('notification', msg => this.emit('notification', {...msg, profile}));
        server.on('request', msg => this.emit('request', {...msg, id: JSON.stringify([profile, msg.id]), profile}));
        server.on('disconnected', () => { this.servers.delete(profile); this.emit('disconnected', profile); });
        await server.initialize();
        const {account} = await server.request('account/read', {refreshToken: false});
        if (!account || account.type !== 'chatgpt') throw new Error(`${profile}: ChatGPT 로그인이 필요합니다.`);
        if (isBusinessPlan(account.planType) !== (profile === 'business')) throw new Error(`${profile}: 로그인한 워크스페이스 유형이 다릅니다. 올바른 계정을 선택하세요.`);
        this.accounts[profile] = {plan: account.planType, connected: true};
        return server;
      } catch (e) { this.accounts[profile] = {connected: false}; server.close(); this.servers.delete(profile); throw e; }
    })();
    this.servers.set(profile, pending);
    return pending;
  }
  async initialize() { await this.backend(this.routing().businessOnly ? 'business' : 'personal'); }
  async request(method, params = {}) {
    const {$profile, ...wire} = params;
    const profile = $profile || (wire.threadId && this.threads.get(wire.threadId)) || (this.routing().businessOnly ? 'business' : 'personal');
    const server = await this.backend(profile);
    if (wire.threadId && this.threads.has(wire.threadId) && this.threads.get(wire.threadId) !== profile) throw new Error('Cross-account thread access rejected');
    const result = await server.request(method, wire);
    if (result?.thread?.id) this.threads.set(result.thread.id, profile);
    return result;
  }
  async respond(id, result) {
    const [profile, original] = JSON.parse(id);
    (await this.backend(profile)).respond(original, result);
  }
  async send(message) {
    const [profile, original] = JSON.parse(message.id);
    (await this.backend(profile)).send({...message, id: original});
  }
  close() { for (const pending of this.servers.values()) void pending.then(s => s.close()).catch(() => {}); }
}
