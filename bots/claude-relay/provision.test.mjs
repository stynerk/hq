import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {Collection} from 'discord.js';
import {initHQ,newProject,commitRegistry} from './provision.mjs';
import {joinFrontmatter,splitFrontmatter,loadRegistry} from '../shared/registry.mjs';
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'hq-provision-'));for(const d of ['config','projects','agents'])fs.mkdirSync(path.join(root,d));fs.writeFileSync(path.join(root,'config','discord.md'),joinFrontmatter({guild_id:'guild',owner:{user_id:'owner'},bots:{},channels:{},categories:{}},'\nBody stays.\n'));return root;}
function mockGuild(){let n=0;const cache=new Collection();const guild={id:'guild',channels:{cache,async fetch(id){if(!id)return cache;return cache.get(id)||null;},async create({name,type,parent}){const ch={id:String(++n),name,type,parentId:parent,async setParent(id){this.parentId=id;},threads:{cache:new Collection(),async fetchActive(){},async create({name}){const t={id:String(++n),name,parentId:ch.id,type:11};this.cache.set(t.id,t);cache.set(t.id,t);return t;}}};cache.set(ch.id,ch);return ch;}}};return guild;}
test('HQ init provisions only active projects and leaves paused channels and registry untouched',async()=>{
 const root=fixture();try{
  const guild=mockGuild();
  for(const [slug,status,channelId] of [['onemorestep','active',null],['paused-new','paused',null],['paused-existing','paused','existing']]){
   fs.writeFileSync(path.join(root,'projects',slug+'.md'),joinFrontmatter({slug,status,repo:'owner/'+slug,discord:{channel_id:channelId,dev_thread_id:null}},'\nPreserved project.\n'));
  }
  const preserved=['paused-new','paused-existing'].map(slug=>({file:path.join(root,'projects',slug+'.md'),raw:fs.readFileSync(path.join(root,'projects',slug+'.md'),'utf8')}));
  const existing={id:'existing',name:'paused-existing',type:0,parentId:'original',async setParent(){throw new Error('Paused channel must stay in place');}};guild.channels.cache.set(existing.id,existing);
  for(let i=0;i<2;i++)await initHQ({guild,reg:loadRegistry(root),hqRoot:root});
  const reg=loadRegistry(root);const active=reg.projects.find(p=>p.slug==='onemorestep');assert.ok(active.channelId);assert.ok(active.devThreadId);
  assert.equal(guild.channels.cache.find(c=>c.name==='paused-new'),undefined);assert.equal(existing.parentId,'original');
  for(const {file,raw} of preserved)assert.equal(fs.readFileSync(file,'utf8'),raw);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('HQ provisioning retry reuses channels and preserves body, never deletes',async()=>{const root=fixture();try{const guild=mockGuild();guild.channels.cache.set('old',{id:'old',name:'old',type:0,async setParent(id){this.parentId=id;}});await initHQ({guild,reg:loadRegistry(root),hqRoot:root});const count=guild.channels.cache.size;await initHQ({guild,reg:loadRegistry(root),hqRoot:root});assert.equal(guild.channels.cache.size,count);assert.ok(guild.channels.cache.has('old'));assert.equal(splitFrontmatter(fs.readFileSync(path.join(root,'config/discord.md'),'utf8')).body,'\nBody stays.\n');}finally{fs.rmSync(root,{recursive:true});}});
test('new project retry reuses channel and dev thread',async()=>{const root=fixture();try{const guild=mockGuild();await initHQ({guild,reg:loadRegistry(root),hqRoot:root});const create=()=>newProject({guild,reg:loadRegistry(root),hqRoot:root,slug:'test-app',repo:'owner/test'});const first=await create();const count=guild.channels.cache.size;assert.deepEqual(await create(),first);assert.equal(guild.channels.cache.size,count);assert.equal(loadRegistry(root).projects[0].repo,'owner/test');}finally{fs.rmSync(root,{recursive:true});}});
test('registry commit refuses non-main and unrelated changes',async()=>{await assert.rejects(commitRegistry('/x',['projects/a.md'],{execFn:async()=>({stdout:'bots-v1\n'})}),/main/);await assert.rejects(commitRegistry('/x',['projects/a.md'],{execFn:async(_,args)=>({stdout:args.includes('branch')?'main\n':' M secrets.txt\n'})}),/관련 없는/);});
test('first unstaged registry modification preserves porcelain leading whitespace and commits',async()=>{
 const calls=[];await commitRegistry('/x',['config/discord.md'],{execFn:async(_,args)=>{calls.push(args);return {stdout:args.includes('branch')?'main\n':args.includes('status')?' M config/discord.md\n':args.includes('diff')?'config/discord.md\n':''};}});
 assert.ok(calls.some(args=>args.includes('commit')));assert.ok(calls.some(args=>args.includes('push')));
});
