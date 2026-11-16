import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProfileServers, selectProfile, profileSessionKey} from './profiles.mjs';

test('DM stays personal, project and child threads use explicit business routes', () => {
  const routing = {channels: {project: 'business', private: 'personal'}};
  assert.equal(selectProfile({guildId: null}, routing), 'personal');
  assert.equal(selectProfile({guildId: 'g', channel: {id: 'project'}}, routing), 'business');
  assert.equal(selectProfile({guildId: 'g', channel: {id: 'thread', parentId: 'project'}}, routing), 'business');
  assert.equal(selectProfile({guildId: 'g', channel: {id: 'new'}}, routing), null);
  assert.notEqual(profileSessionKey('business','channel'),profileSessionKey('personal','channel'));
});
test('Business-only mode sends DMs and all channels exclusively to Business', () => {
  const routing = {businessOnly:true, channels:{old:'personal'}};
  assert.equal(selectProfile({guildId:null},routing),'business');
  assert.equal(selectProfile({guildId:'g',channel:{id:'old'}},routing),'business');
  assert.equal(selectProfile({guildId:'g',channel:{id:'new'}},routing),'business');
});
test('profile servers isolate credentials, reject wrong plan, and never fall back', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-profile-test-'));
  const file = path.join(dir, 'routing.json');
  const calls = [];
  class Fake extends EventEmitter {
    constructor(home) { super(); this.home = home; }
    async initialize() {}
    async request(method, params) {
      calls.push({home: this.home, method, params});
      if (method === 'account/read') return {account: {type: 'chatgpt', planType: this.home === 'b' ? 'business' : 'plus'}};
      return {thread: {id: this.home + '-thread'}};
    }
    close() {}
  }
  fs.writeFileSync(file, JSON.stringify({profiles: {personal: {home: 'p'}, business: {home: 'b'}}}));
  const pool = new ProfileServers(file, home => new Fake(home));
  try {
    await pool.initialize();
    await pool.request('thread/start', {$profile: 'business'});
    await pool.request('turn/start', {threadId: 'b-thread', input: []});
    assert.equal(calls.at(-1).home, 'b');
    assert.equal('$profile' in calls.at(-1).params, false);
    await assert.rejects(pool.request('turn/start', {$profile:'personal', threadId:'b-thread'}), /Cross-account/);
    fs.writeFileSync(file, JSON.stringify({profiles:{personal:{home:'p'},business:{home:'wrong'}}}));
    const wrong = new ProfileServers(file, home => new Fake(home));
    await assert.rejects(wrong.request('thread/start', {$profile:'business'}), /워크스페이스/);
    assert.equal(wrong.accounts.business.connected, false);
    fs.writeFileSync(file, JSON.stringify({businessOnly:true,profiles:{business:{home:'b'}}}));
    const locked = new ProfileServers(file, home => new Fake(home));
    await locked.initialize();
    await locked.request('account/read');
    assert.equal(calls.at(-1).home,'b');
    const before=calls.length;
    await assert.rejects(locked.request('thread/start',{$profile:'personal'}),/Business/);
    assert.equal(calls.length,before);
    assert.equal('personal' in locked.accounts,false);
    locked.close();
  } finally { pool.close(); fs.unlinkSync(file); fs.rmdirSync(dir); }
});

