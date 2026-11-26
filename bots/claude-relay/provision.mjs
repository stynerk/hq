import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {joinFrontmatter, updateFrontmatter} from '../shared/registry.mjs';
const exec=promisify(execFile);
// Every ID is checkpointed immediately, so retry after a partial failure reuses resources.
export async function initHQ({guild,reg,hqRoot,reload=()=>{}}){
  if(guild.id!==reg.guildId)throw new Error('등록된 서버가 아닙니다.');
  const file=path.join(hqRoot,'config','discord.md');let config=reg.discord;
  await guild.channels.fetch();
  const category=async(key,name)=>{
    let ch=config.categories?.[key] && guild.channels.cache.get(config.categories[key]);
    if(!ch)ch=guild.channels.cache.find(x=>x.type===4&&x.name===name);
    if(!ch)ch=await guild.channels.create({name,type:4,reason:'HJ !hq init'});
    config=updateFrontmatter(file,d=>{d.categories??={};d.categories[key]=ch.id;});reload();return ch;
  };
  const hq=await category('hq','HQ');const projects=await category('projects','PROJECTS');const archive=await category('archive','ARCHIVE');
  const text=async(key,name,parent)=>{
    let ch=config.channels?.[key]&&guild.channels.cache.get(config.channels[key]);
    if(!ch)ch=guild.channels.cache.find(x=>x.type===0&&x.name===name);
    if(!ch)ch=await guild.channels.create({name,type:0,parent:parent.id,reason:'HJ !hq init'});
    if(ch.parentId!==parent.id)await ch.setParent(parent.id,{lockPermissions:false});
    config=updateFrontmatter(file,d=>{d.channels??={};d.channels[key]=ch.id;});reload();return ch;
  };
  const home=await text('hq','hq',hq);const alerts=await text('hq_alerts','hq-alerts',hq);const keep=new Set([home.id,alerts.id]);
  for(const p of reg.projects){
    // hq 프로젝트의 채널은 #hq 자체다. PROJECTS로 옮기거나 새로 만들지 않는다(dev 스레드는 !project new hq로 만든다).
    if(p.slug==='hq')continue;
    if(p.status!=='active'){
      // Preserve existing paused channels in place, without provisioning or enabling them.
      if(p.channelId)keep.add(p.channelId);
      continue;
    }
    let ch=p.channelId?await guild.channels.fetch(p.channelId):guild.channels.cache.find(x=>x.type===0&&x.name===p.slug);
    if(!ch)ch=await guild.channels.create({name:p.slug,type:0,parent:projects.id,reason:'HJ !hq init'});
    keep.add(ch.id);if(ch.parentId!==projects.id)await ch.setParent(projects.id,{lockPermissions:false});
    config=updateFrontmatter(file,d=>{d.project_channels??={};d.project_channels[p.slug]={channel_id:ch.id,dev_thread_id:p.devThreadId};});reload();
    let thread=p.devThreadId?await guild.channels.fetch(p.devThreadId):null;
    if(!thread){await ch.threads.fetchActive();thread=ch.threads.cache.find(x=>x.name==='dev');}
    if(!thread)thread=await ch.threads.create({name:'dev',autoArchiveDuration:10080,reason:'HJ !hq init'});
    config=updateFrontmatter(file,d=>{d.project_channels[p.slug].dev_thread_id=thread.id;});reload();
  }
  for(const ch of guild.channels.cache.values())if(ch.type===0&&!keep.has(ch.id)&&ch.parentId!==archive.id)await ch.setParent(archive.id,{lockPermissions:false});
  return {hqChannelId:home.id,alertsChannelId:alerts.id};
}
export function validateProject(slug,repo){if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)||!/^[-\w.]+\/[-\w.]+$/.test(repo))throw new Error('형식: !project new <소문자-slug> <owner/repo>');}
export async function newProject({guild,reg,hqRoot,slug,repo,reload=()=>{}}){
  validateProject(slug,repo);if(guild.id!==reg.guildId)throw new Error('등록된 서버가 아닙니다.');
  const file=path.join(hqRoot,'projects',slug+'.md');const exists=reg.projects.find(p=>p.slug===slug);
  if(exists&&exists.repo!==repo)throw new Error('이미 다른 저장소에 연결된 slug입니다.');
  const parent=reg.discord.categories?.projects;if(!parent)throw new Error('먼저 !hq init을 실행하세요.');
  if(!fs.existsSync(file))fs.writeFileSync(file,joinFrontmatter({slug,title:slug,status:'active',repo,local_path:path.join(path.dirname(hqRoot),slug).replaceAll('\\','/'),discord:{channel_id:null,dev_thread_id:null},agents:{service_pm:{name:'Tony',persona:null},dev_pm:{name:'Cap',persona:null}},gates:[]},`\n# ${slug}\n\n신규 프로젝트. 목표·범위·성공 지표는 총괄이 playbooks/new-project.md에 따라 정리한다.\n`));
  await guild.channels.fetch();let channel=exists?.channelId?await guild.channels.fetch(exists.channelId):guild.channels.cache.find(c=>c.type===0&&c.name===slug);
  if(!channel)channel=await guild.channels.create({name:slug,type:0,parent,reason:'HJ !project new'});
  const configFile=path.join(hqRoot,'config','discord.md');
  updateFrontmatter(configFile,d=>{d.project_channels??={};d.project_channels[slug]={channel_id:channel.id,dev_thread_id:exists?.devThreadId||null};});reload();
  await channel.threads.fetchActive();let thread=exists?.devThreadId?await guild.channels.fetch(exists.devThreadId):channel.threads.cache.find(t=>t.name==='dev');
  if(!thread)thread=await channel.threads.create({name:'dev',autoArchiveDuration:10080,reason:'HJ !project new'});
  updateFrontmatter(configFile,d=>{d.project_channels[slug].dev_thread_id=thread.id;});reload();return {channelId:channel.id,threadId:thread.id};
}
export async function commitRegistry(hqRoot,files,{execFn=exec}={}){
  const git=async args=>(await execFn('git',['-C',hqRoot,...args])).stdout.trimEnd();
  if(await git(['branch','--show-current'])!=='main')throw new Error('채널은 준비됐지만 hq main 체크아웃이 아니므로 자동 커밋·푸시를 보류했습니다.');
  const dirty=await git(['status','--porcelain']);const allowed=new Set(files);
  if(dirty.split('\n').filter(Boolean).some(l=>!allowed.has(l.slice(3))))throw new Error('관련 없는 hq 변경이 있어 커밋·푸시를 보류했습니다.');
  await git(['add','--',...files]);if(!await git(['diff','--cached','--name-only']))return;
  await git(['commit','-m','Configure Discord project registry']);await git(['push','origin','main']);
}
