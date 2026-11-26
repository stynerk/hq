import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import path from 'node:path';
import { AppServer, codexCommand, chunks, isOwnerDM, channelInput, conversationKey, trustedHandoff } from './rpc.mjs';

test('Codex honors explicit executable paths, uses PATH on macOS and preserves Windows npm discovery', () => {
  const configured = '/Applications/Codex Tools/codex';
  assert.deepEqual(codexCommand({platform: 'darwin', env: {CODEX_EXECUTABLE: configured}}), [configured, []]);
  assert.deepEqual(codexCommand({platform: 'darwin', env: {}}), ['codex', []]);
  const env = {APPDATA: 'C:\\Users\\example\\App Data'};
  const root = path.win32.join(env.APPDATA, 'npm/node_modules/@openai/codex');
  const native = path.win32.join(root, 'node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe');
  assert.deepEqual(codexCommand({platform: 'win32', env, exists: file => file === native}), [native, []]);
  assert.deepEqual(codexCommand({platform: 'win32', env, exists: () => false}), [process.execPath, [path.win32.join(root, 'bin/codex.js')]]);
});

test('only the allowlisted PM bot can hand off, with mention and keyword, in allowlisted channels', () => {
  const pm = 'pmbot', me = '123', ch = 'c';
  const m = {author: {id: pm, bot: true}, guildId: 'g', channel: {id: ch}, content: `<@${me}> TASK_READY\nT10 리포트`};
  const ok = (msg) => trustedHandoff(msg, me, [pm], [ch]);
  assert.equal(ok(m), 'TASK_READY\nT10 리포트');
  assert.equal(ok({...m, content: `<@!${me}> REVIEW_CHANGES 헤더 수정`}), 'REVIEW_CHANGES 헤더 수정');
  assert.equal(ok({...m, channel: {id: 'thread', parentId: ch}}), 'TASK_READY\nT10 리포트');
  assert.equal(ok({...m, content: `<@${me}> 안녕하세요`}), null, 'no keyword');
  assert.equal(ok({...m, content: 'TASK_READY 멘션 없음'}), null, 'no mention');
  assert.equal(ok({...m, content: `<@${me}> 참고: TASK_READY`}), null, 'keyword not first');
  assert.equal(ok({...m, author: {id: 'otherbot', bot: true}}), null, 'other bot');
  assert.equal(ok({...m, author: {id: pm, bot: false}}), null, 'human with bot id');
  assert.equal(ok({...m, channel: {id: 'elsewhere'}}), null, 'other channel');
  assert.equal(ok({...m, guildId: null}), null, 'DM');
  assert.equal(trustedHandoff({...m, author: {id: me, bot: true}}, me, [me], [ch]), null, 'never itself');
  assert.equal(trustedHandoff(m, me, [], [ch]), null, 'empty allowlist');
  assert.equal(channelInput(m, 'owner', me, false, [ch], true), null, 'owner path still rejects bots');
});

test('server channels require owner plus mention, prefix, or reply to this bot', () => {
  const m = {author: {id: 'owner', bot: false}, guildId: 'g', channel: {id: 'c'}, content: 'hello'};
  assert.equal(channelInput(m, 'owner', '123'), null);
  assert.equal(channelInput(m, 'owner', '123', false, ['c']), 'hello');
  assert.equal(channelInput(m, 'owner', '123', false, ['other']), null);
  assert.equal(channelInput({...m, author: {id: 'other'}}, 'owner', '123', false, ['c']), null);
  assert.equal(channelInput({...m, content: '<@123> hello'}, 'owner', '123'), 'hello');
  assert.equal(channelInput({...m, content: '<@!123> !status'}, 'owner', '123'), '!status');
  assert.equal(channelInput({...m, content: '!codex hello'}, 'owner', '123'), 'hello');
  assert.equal(channelInput({...m, content: '<@999> hello'}, 'owner', '123'), null);
  assert.equal(channelInput(m, 'owner', '123', true), 'hello');
  assert.equal(channelInput({...m, author: {id: 'other'} ,content: '<@123> hello'}, 'owner', '123'), null);
  assert.equal(channelInput({...m, author: {id: 'owner', bot: true}, content: '!codex hi'}, 'owner', '123'), null);
  assert.equal(channelInput({...m, guildId: null}, 'owner', '123'), 'hello');
  assert.notEqual(conversationKey(m), conversationKey({...m, channel: {id: 'other'}}));
  assert.notEqual(conversationKey(m), conversationKey({...m, guildId: null}));
});

test('only the owner can submit a human DM', () => {
  const m = {author: {id: 'owner', bot: false}, guildId: null};
  assert.equal(isOwnerDM(m, 'owner'), true);
  assert.equal(isOwnerDM({...m, author: {id: 'other', bot: false}}, 'owner'), false);
  assert.equal(isOwnerDM({...m, author: {id: 'owner', bot: true}}, 'owner'), false);
  assert.equal(isOwnerDM({...m, guildId: 'server'}, 'owner'), false);
});
test('all-channel mode accepts new channels and retains owner restriction', () => {
  for (const id of ['existing', 'new-channel', 'new-thread']) {
    const m = {author: {id: 'owner', bot: false}, guildId: 'g', channel: {id}, content: 'hello'};
    assert.equal(channelInput(m, 'owner', '123', false, [], true), 'hello');
    assert.equal(channelInput({...m, author: {id: 'stranger'}}, 'owner', '123', false, [], true), null);
    assert.equal(channelInput({...m, author: {id: 'owner', bot: true}}, 'owner', '123', false, [], true), null);
  }
});
test('long Unicode replies retain every character within Discord limits', () => {
  const text = ('한글 😀 코드\n').repeat(1000);
  const parts = chunks(text);
  assert.equal(parts.join(''), text);
  assert.ok(parts.every(p => p.length <= 1900));
  assert.ok(parts.every(p => !/[\uD800-\uDBFF]$/.test(p)));
});
test('App Server stdio handshake, server requests, errors, and exit', async () => {
  const source = `const rl=require('readline').createInterface({input:process.stdin});rl.on('line',l=>{const m=JSON.parse(l);if(m.method==='initialize')console.log(JSON.stringify({id:m.id,result:{}}));else if(m.method==='ping'){console.log(JSON.stringify({id:55,method:'approval',params:{}}));console.log(JSON.stringify({method:'notice',params:{value:42}}));console.log(JSON.stringify({id:m.id,result:{ok:true}}))}else if(m.method==='fail')console.log(JSON.stringify({id:m.id,error:{message:'expected'}}));else if(m.method==='exit')process.exit(0);});`;
  const rpc = new AppServer([process.execPath, ['-e', source, '--']]);
  try {
    await rpc.initialize();
    const request = once(rpc, 'request'), notice = once(rpc, 'notification');
    assert.deepEqual(await rpc.request('ping'), {ok: true});
    assert.equal((await request)[0].id, 55);
    assert.equal((await notice)[0].params.value, 42);
    await assert.rejects(rpc.request('fail'), /expected/);
    await assert.rejects(rpc.request('exit'), /disconnected/);
    assert.equal(rpc.pending.size, 0);
  } finally { rpc.close(); }
});

