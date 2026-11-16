import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {LaneQueue,claudeArgs,runClaude,importedToken} from './runtime.mjs';
import {validateProject} from './provision.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
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
