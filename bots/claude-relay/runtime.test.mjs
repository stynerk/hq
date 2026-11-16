import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {LaneQueue,claudeArgs,runClaude,importedToken,relayInstructions,serviceWorkspace} from './runtime.mjs';
import {validateProject} from './provision.mjs';
const tick=()=>new Promise(r=>setImmediate(r));

test('relay instructions use registry identities despite legacy project guidance',()=>{
 const reg={agents:new Map([['service-pm',{body:'Service policy'}]]),claudeBotId:'current-sora',codexBotId:'current-cap'};
 const route={role:'service-pm',mode:'owner',project:{body:'Legacy PM_Sora <@retired>',servicePm:{name:'Sora'}}};
 const text=relayInstructions(route,reg);
 assert.ok(text.includes('너의 멘션은 <@current-sora>'));
 assert.ok(text.includes('<@current-cap> TASK_READY #번호'));
 assert.ok(text.indexOf('Legacy PM_Sora')<text.indexOf('현재 hq 레지스트리'));
});

test('service worktree fetches current origin main and preserves stale local work',async()=>{
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
  await assert.rejects(serviceWorkspace(project),/오래됐습니다/);
  assert.equal(fs.readFileSync(path.join(service,'local-work.txt'),'utf8'),'preserve me');
  assert.equal(fs.readFileSync(path.join(service,'policy.txt'),'utf8'),'hq policy');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
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
