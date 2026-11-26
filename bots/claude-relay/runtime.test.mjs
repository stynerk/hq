import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {LaneQueue,claudeArgs,runClaude,importedToken,relayInstructions,serviceWorkspace} from './runtime.mjs';
import {cliFailureReason} from './runtime.mjs';
import {validateProject} from './provision.mjs';
const tick=()=>new Promise(r=>setImmediate(r));

test('relay instructions use registry identities despite legacy project guidance',()=>{
 const reg={agents:new Map([['service-pm',{body:'Service policy'}]]),claudeBotId:'current-sora',codexBotId:'current-cap'};
 const route={role:'service-pm',mode:'owner',project:{body:'Legacy PM_Sora <@retired>',servicePm:{name:'Sora'}}};
 const text=relayInstructions(route,reg);
 assert.ok(text.includes('너의 멘션은 <@current-sora>'));
 assert.ok(text.includes('<@current-cap> TASK_READY #번호'));
 assert.ok(text.indexOf('Legacy PM_Sora')<text.indexOf('현재 hq 레지스트리'));
 assert.ok(text.includes('최종 답은 릴레이가')&&text.includes('디스코드 도구(fetch_messages'));
 assert.ok(text.includes('로컬에만 커밋을 남기지 않는다'));
 assert.ok(text.includes('다른 브랜치를 checkout하지 않는다'));
 assert.ok(text.indexOf('첫 줄을 아래 인계 형식')<text.indexOf('<@current-cap> TASK_READY #번호'));
});

test('service worktree follows merged main and preserves dirty or squash-diverged work',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'hq-service-'));
 const exec=promisify(execFile);
 const git=async(cwd,...args)=>(await exec('git',['-c','user.name=Test','-c','user.email=test@example.invalid','-C',cwd,...args])).stdout.trim();
 try{
  const origin=path.join(root,'origin.git'),seed=path.join(root,'seed'),repo=path.join(root,'project');
  fs.mkdirSync(seed);await git(root,'init','--bare',origin);await git(seed,'init','-b','main');
  fs.writeFileSync(path.join(seed,'policy.txt'),'legacy');await git(seed,'add','.');await git(seed,'commit','-m','Legacy policy');await git(seed,'remote','add','origin',origin);await git(seed,'push','origin','main');
  await git(root,'clone','--branch','main',origin,repo);
  fs.writeFileSync(path.join(seed,'policy.txt'),'hq policy');await git(seed,'commit','-am','HQ policy');await git(seed,'push','origin','main');
  assert.equal(fs.readFileSync(path.join(repo,'policy.txt'),'utf8'),'legacy');
  const project={slug:'demo',localPath:repo};const service=await serviceWorkspace(project);
  assert.equal(fs.readFileSync(path.join(service,'policy.txt'),'utf8'),'hq policy');
  assert.equal(fs.readFileSync(path.join(repo,'policy.txt'),'utf8'),'legacy');
  fs.writeFileSync(path.join(service,'local-work.txt'),'preserve me');
  fs.writeFileSync(path.join(seed,'policy.txt'),'updated hq policy');await git(seed,'commit','-am','Update policy');await git(seed,'push','origin','main');
  assert.equal(await serviceWorkspace(project),service);
  assert.equal(fs.readFileSync(path.join(service,'local-work.txt'),'utf8'),'preserve me');
  assert.equal(fs.readFileSync(path.join(service,'policy.txt'),'utf8'),'updated hq policy');
  // The next invocation after main advances still starts normally.
  assert.equal(await serviceWorkspace(project),service);
  // An untracked file at an incoming path must not be overwritten by fast-forward.
  fs.writeFileSync(path.join(seed,'local-work.txt'),'incoming remote work');await git(seed,'add','local-work.txt');await git(seed,'commit','-m','Incoming file');await git(seed,'push','origin','main');
  const beforeConflict=await git(service,'rev-parse','HEAD');
  await assert.rejects(serviceWorkspace(project),/fast-forward 실패/);
  assert.equal(await git(service,'rev-parse','HEAD'),beforeConflict);
  assert.equal(fs.readFileSync(path.join(service,'local-work.txt'),'utf8'),'preserve me');
  fs.renameSync(path.join(service,'local-work.txt'),path.join(service,'saved-local-work.txt'));
  assert.equal(await serviceWorkspace(project),service);
  assert.equal(fs.readFileSync(path.join(service,'local-work.txt'),'utf8'),'incoming remote work');
  fs.writeFileSync(path.join(service,'policy.txt'),'local tracked work');
  fs.writeFileSync(path.join(seed,'policy.txt'),'next main');await git(seed,'commit','-am','Next main');await git(seed,'push','origin','main');
  const preservedHead=await git(service,'rev-parse','HEAD');
  await assert.rejects(serviceWorkspace(project),/추적 파일 변경/);
  assert.equal(await git(service,'rev-parse','HEAD'),preservedHead);
  assert.equal(fs.readFileSync(path.join(service,'policy.txt'),'utf8'),'local tracked work');
  // Staged tracked changes also prevent the fast-forward.
  await git(service,'add','policy.txt');await assert.rejects(serviceWorkspace(project),/추적 파일 변경/);
  // Commit the local work; main independently squashes the same content.
  await git(service,'commit','-m','Service policy work');
  fs.writeFileSync(path.join(seed,'policy.txt'),'local tracked work');await git(seed,'commit','-am','Squashed service policy work');await git(seed,'push','origin','main');
  const serviceHead=await git(service,'rev-parse','HEAD');
  await assert.rejects(serviceWorkspace(project),/갈라졌습니다.*squash/);
  assert.equal(await git(service,'rev-parse','HEAD'),serviceHead);
  // Once the local commit is pushed to a remote branch, nothing is lost: reset to main.
  await git(service,'push','origin','HEAD:refs/heads/tony/policy');
  await serviceWorkspace(project);
  assert.equal(await git(service,'rev-parse','HEAD'),await git(seed,'rev-parse','HEAD'));
  assert.equal(fs.readFileSync(path.join(service,'saved-local-work.txt'),'utf8'),'preserve me');
  assert.equal(fs.readFileSync(path.join(service,'saved-local-work.txt'),'utf8'),'preserve me');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('service worktree validation accepts a project path reached through a symlink',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'hq-service-link-'));
 const exec=promisify(execFile);
 const git=async(cwd,...args)=>(await exec('git',['-c','user.name=Test','-c','user.email=test@example.invalid','-C',cwd,...args])).stdout.trim();
 try{
  const origin=path.join(root,'origin.git'),seed=path.join(root,'seed'),repo=path.join(root,'project'),link=path.join(root,'project-link');
  fs.mkdirSync(seed);await git(root,'init','--bare',origin);await git(seed,'init','-b','main');
  fs.writeFileSync(path.join(seed,'a.txt'),'a');await git(seed,'add','.');await git(seed,'commit','-m','init');await git(seed,'remote','add','origin',origin);await git(seed,'push','origin','main');
  await git(root,'clone','--branch','main',origin,repo);
  try{fs.symlinkSync(repo,link,'junction');}catch{t.skip('symlink not permitted');return;}
  const service=await serviceWorkspace({slug:'demo',localPath:link});
  assert.equal(fs.readFileSync(path.join(service,'a.txt'),'utf8'),'a');
  assert.equal(await serviceWorkspace({slug:'demo',localPath:link}),service);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('service worktree reports fetch failure without exposing Git credential errors',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'hq-service-fetch-'));
 try {await assert.rejects(serviceWorkspace({slug:'demo',localPath:root},{execFn:async()=>{throw new Error('sensitive Git stderr');}}),e=>e.message.includes('네트워크·Git 인증')&&!e.message.includes('sensitive'));}
 finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('lane queues serialize locally, permit independent projects, reject duplicate message IDs',async()=>{
 const q=new LaneQueue();let release;const wait=new Promise(r=>release=r);let order=[];
 assert.equal(q.enqueue('a','1',async()=>{order.push('a1');await wait;}),true);
 assert.equal(q.enqueue('a','1',()=>order.push('duplicate')),false);q.enqueue('a','2',()=>order.push('a2'));q.enqueue('b','3',()=>order.push('b1'));
 await tick();assert.deepEqual(order,['a1','b1']);release();await tick();assert.deepEqual(order,['a1','b1','a2']);
});
test('stop cancels pending work in only its lane',async()=>{
 const q=new LaneQueue();let stopped=false;let second=false;
 q.enqueue('a','1',signal=>new Promise(resolve=>signal.addEventListener('abort',()=>{stopped=true;resolve();})));q.enqueue('a','2',()=>second=true);q.stop('a');await tick();assert.equal(stopped,true);assert.equal(second,false);assert.equal(q.busy('a'),false);
});
test('consult hard tool allowlist excludes all mutation tools and starts plan mode',()=>{
 const args=claudeArgs('/tmp/p',{consult:true,sessionId:'consult-session'});assert.equal(args[args.indexOf('--tools')+1],'Read,Glob,Grep');assert.equal(args[args.indexOf('--permission-mode')+1],'plan');assert.ok(args.includes('--resume'));assert.ok(!args.includes('Edit'));
});
test('CLI prompt is stdin data and result returns session ID',async()=>{
 let received;let args;const result=await runClaude({cwd:os.tmpdir(),prompt:'literal $(danger) " 日本語',system:'system',spawnFn:(command,a)=>{args=a;const p=new EventEmitter();p.pid=99999999;p.stdout=new EventEmitter();p.stderr=new EventEmitter();p.stdin=new EventEmitter();p.stdin.end=value=>{received=value;setImmediate(()=>{p.stdout.emit('data',Buffer.from('{"session_id":"s1","result":"hello"}'));p.emit('close',0);});};return p;}});
 assert.equal(received,'literal $(danger) " 日本語');assert.equal(result.session_id,'s1');assert.ok(!args.includes(received));
});
test('project names reject traversal and arbitrary shell syntax',()=>{validateProject('example-app','owner/repo');for(const slug of ['../bad','x;calc','Bad','a/b'])assert.throws(()=>validateProject(slug,'owner/repo'));assert.throws(()=>validateProject('valid','../oops/three'));});
test('token importer reads quoted env token without displaying it',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hq-test-'));const file=path.join(dir,'.env');try{fs.writeFileSync(file,'DISCORD_BOT_TOKEN="test-token"\n');assert.equal(importedToken(file),'test-token');}finally{fs.rmSync(dir,{recursive:true});}});
test('abort keeps lane occupied until the CLI actually closes',async()=>{
 const controller=new AbortController();let cli;let settled=false;
 const promise=runClaude({cwd:os.tmpdir(),prompt:'p',system:'s',signal:controller.signal,spawnFn:()=>{cli=new EventEmitter();cli.pid=99999999;cli.stdout=new EventEmitter();cli.stderr=new EventEmitter();cli.stdin=new EventEmitter();cli.stdin.end=()=>{};cli.kill=()=>true;return cli;}}).catch(()=>{settled=true;});
 controller.abort();await tick();assert.equal(settled,false);cli.emit('close',null);await promise;assert.equal(settled,true);
});

test('POSIX cancellation escalates an unresponsive Claude process group', {timeout: 5000}, async t => {
 const platform = Object.getOwnPropertyDescriptor(process, 'platform');
 Object.defineProperty(process, 'platform', {...platform, value: 'darwin'});
 t.after(() => Object.defineProperty(process, 'platform', platform));

 const controller = new AbortController();
 const cli = new EventEmitter();
 cli.pid = 12345;
 cli.stdout = new EventEmitter();
 cli.stderr = new EventEmitter();
 cli.stdin = new EventEmitter();
 cli.stdin.end = () => {};
 const signals = [];
 t.mock.method(process, 'kill', (pid, signal) => {
  signals.push([pid, signal]);
  if (signal === 'SIGKILL') setImmediate(() => cli.emit('close', null));
 });

 const pending = runClaude({
  cwd: os.tmpdir(), prompt: 'p', system: 's', signal: controller.signal,
  resolveCommand: () => ({command: 'claude', prefix: []}),
  spawnFn: (_command, _args, options) => {
   assert.equal(options.detached, true);
   return cli;
  },
 });
 const stopped = assert.rejects(pending, /작업이 중지되었습니다/);
 controller.abort();
 await stopped;
 assert.deepEqual(signals, [[-cli.pid, 'SIGTERM'], [-cli.pid, 'SIGKILL']]);
});

test('work sessions enable the Bash tool but preapprove only git and gh, and ignore user MCP servers',()=>{
 const args=claudeArgs('/tmp/p');
 const tools=args[args.indexOf('--tools')+1].split(',');
 assert.ok(tools.includes('Bash'));assert.ok(!tools.some(t=>t.includes('(')),'--tools must hold tool names only');
 const allowed=args.slice(args.indexOf('--allowedTools')+1);
 assert.ok(allowed.includes('Bash(git *)')&&allowed.includes('Bash(gh *)'));assert.ok(!allowed.includes('Bash'),'bare Bash must not be preapproved');
 const pm2=allowed.filter(a=>a.includes('pm2'));assert.deepEqual(pm2,['Bash(pm2 ls)'],'only the exact pm2 ls rule; no jlist/logs/restart/wildcard');
 assert.ok(!claudeArgs('/tmp/p',{consult:true}).some(a=>a.includes('pm2')),'consult sessions get no pm2');
 assert.ok(args.includes('--strict-mcp-config'));
 assert.ok(claudeArgs('/tmp/p',{consult:true}).includes('--strict-mcp-config'));
});

test('cliFailureReason keeps the reason from JSON result or stderr', () => {
  assert.equal(cliFailureReason('{"is_error":true,"result":"Credit balance is too low"}',''), 'Credit balance is too low');
  assert.equal(cliFailureReason('', 'line1\nInvalid API key · Please run /login\n'), 'line1 / Invalid API key · Please run /login');
  assert.match(cliFailureReason('',''), /claude -p/);
});
