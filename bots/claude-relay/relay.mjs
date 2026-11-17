import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {Client, GatewayIntentBits, Partials} from 'discord.js';
import {Registry,updateFrontmatter,locate} from '../shared/registry.mjs';
import {classify,ExchangeCounter,chunk,refreshProjectRoute} from '../shared/routing.mjs';
import {LaneQueue,readJSON,saveJSON,dpapi,readEncryptedToken,importedToken,serviceWorkspace,runClaude,relayInstructions} from './runtime.mjs';
import {initHQ,newProject,commitRegistry} from './provision.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const hqRoot=process.env.HQ_ROOT||path.resolve(here,'../..');
const privateDir=process.env.CLAUDE_PRIVATE_DIR||path.join(here,'private');fs.mkdirSync(privateDir,{recursive:true});
const lock=path.join(privateDir,'relay.pid');
if(fs.existsSync(lock)){const pid=Number(fs.readFileSync(lock,'utf8'));let live=false;try{process.kill(pid,0);live=true;}catch(e){if(e.code==='EPERM')live=true;}if(live)throw new Error('Claude 릴레이가 이미 실행 중입니다.');fs.unlinkSync(lock);}fs.writeFileSync(lock,String(process.pid),{flag:'wx'});
process.on('exit',()=>{try{if(fs.readFileSync(lock,'utf8')===String(process.pid))fs.unlinkSync(lock);}catch{}});
const registry=new Registry(hqRoot);if(registry.get().errors.length)throw new Error(registry.get().errors.join('\n'));
const configFile=path.join(privateDir,'config.json');const stateFile=path.join(privateDir,'state.json');
let config=readJSON(configFile,null);const state=readJSON(stateFile,{sessions:{},seen:[]});state.sessions??={};state.seen??=[];
if(!config?.tokenEncrypted){
  let token=importedToken(path.join(os.homedir(),'.claude','channels','discord','.env'));
  if(token)config={tokenEncrypted:await dpapi(token)};
  else{if(!process.stdin.isTTY)throw new Error('토큰이 없습니다. PowerShell에서 먼저 node bots/claude-relay/relay.mjs를 실행하세요.');config={tokenEncrypted:await readEncryptedToken()};}
  saveJSON(configFile,config);
}
const bot=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.DirectMessages,GatewayIntentBits.MessageContent],partials:[Partials.Channel]});
const queue=new LaneQueue();for(const id of state.seen)queue.seen.add(id);
const counter=new ExchangeCounter();const unregistered=new Set();let adminBusy=false;
const send=async(channel,text,peer=null)=>{for(const content of chunk(text))await channel.send({content,allowedMentions:{parse:[],users:peer?[peer]:[],repliedUser:false}});};
const sessionKey=(route,m)=>`${route.lane}|${m.channel.id}|${route.mode==='consult'?'consult':'work'}`;
async function runMessage(m,route,signal,extra=''){
  const reg=registry.get();route=refreshProjectRoute(route,reg,m.channel);const key=sessionKey(route,m);const cwd=route.project?(route.mode==='consult'?route.project.localPath:await serviceWorkspace(route.project)):hqRoot;if(signal.aborted)return;
  const system=relayInstructions(route,reg);
  const result=await runClaude({cwd,prompt:route.text+'\n'+extra,system,sessionId:state.sessions[key],consult:route.mode==='consult',signal});
  if(signal.aborted)return;if(result.session_id){state.sessions[key]=result.session_id;saveJSON(stateFile,state);}
  const peer=route.place==='dev'?reg.codexBotId:null;await send(m.channel,result.result||'(빈 응답)',peer);
}
async function handle(m){
  const reg=registry.get();if(reg.errors.length||registry.lastError)return;
  if(locate(reg,m.channel))counter.record(m,{ownerId:reg.ownerId,botIds:[reg.claudeBotId,reg.codexBotId]});
  let repliesToSelf=false;if(m.author?.id===reg.ownerId&&m.reference?.messageId)try{repliesToSelf=(await m.fetchReference()).author.id===bot.user.id;}catch{}
  const route=classify(m,{self:'claude',reg,repliesToSelf,exchangeCount:counter.count(m)});
  if(route.kind==='ignore')return;
  if(route.kind==='unregistered'){if(!unregistered.has(m.channel.id)){unregistered.add(m.channel.id);const alerts=reg.hqChannelId&&await bot.channels.fetch(reg.hqChannelId);if(alerts)await send(alerts,`등록되지 않은 채널: <#${m.channel.id}>. 레지스트리를 먼저 등록하세요.`);}return;}
  if(route.kind==='loop-limit'){if(counter.warnOnce(m))await send(m.channel,'봇끼리 6회 초과, 서비스PM이 owner-decision으로 올려 주세요.');return;}
  if(route.kind==='command'){
    if(state.seen.includes(m.id))return;state.seen.push(m.id);state.seen=state.seen.slice(-10000);saveJSON(stateFile,state);
    const lane=route.lane||'hq';
    if(route.text==='!stop'){queue.stop(lane);return send(m.channel,'이 프로젝트 작업과 대기열을 중지했습니다.');}
    if(route.text==='!status')return send(m.channel,`프로젝트: ${route.project?.slug||'hq'}\n작업 폴더: ${route.project?.localPath||hqRoot}\n세션: ${state.sessions[`${lane}|${m.channel.id}|work`]||'없음'}\n작업 중: ${queue.busy(lane)}`);
    if(route.text==='!new'){if(queue.busy(lane))return send(m.channel,'작업 중입니다. !stop 후 !new를 사용하세요.');for(const key of Object.keys(state.sessions))if(key.startsWith(`${lane}|${m.channel.id}|`))delete state.sessions[key];saveJSON(stateFile,state);return send(m.channel,'이 채널의 세션을 초기화했습니다.');}
    if(route.text==='!hq init'||route.text.startsWith('!project new ')){
      if(adminBusy)return send(m.channel,'서버 설정을 처리 중입니다.');if(route.text.startsWith('!project')&&m.channel.id!==reg.hqChannelId)return send(m.channel,'!project new는 #hq에서 사용하세요.');
      adminBusy=true;try{
        const guild=await bot.guilds.fetch(reg.guildId);let extra='';
        if(route.text==='!hq init'){await initHQ({guild,reg,hqRoot,reload:()=>registry.reload()});await commitRegistry(hqRoot,['config/discord.md']);}
        else{const parts=route.text.split(/\s+/);if(parts.length!==4)throw new Error('형식: !project new <slug> <owner/repo>');const [, ,slug,repo]=parts;await newProject({guild,reg,hqRoot,slug,repo,reload:()=>registry.reload()});await commitRegistry(hqRoot,['config/discord.md','projects/'+slug+'.md']);extra=`새 프로젝트 ${slug}, 저장소 ${repo}. playbooks/new-project.md의 2~5절을 수행한다. 저장소 생성·공개·권한 변경은 하지 않고 HJ에게 필요한 초안을 제시한다.`;}
        await send(m.channel,'디스코드 구성을 저장했습니다.');if(extra)queue.enqueue('hq',m.id,signal=>runMessage(m,{kind:'chat',lane:'hq',role:'hq-lead',mode:'owner',text:extra},signal).catch(e=>send(m.channel,e.message)));
      }finally{adminBusy=false;}return;
    }
    return send(m.channel,'명령: !status, !new, !stop, !hq init, !project new <slug> <owner/repo>');
  }
  if(m.attachments?.size)return send(m.channel,'Claude 릴레이 첨부 처리는 아직 지원하지 않습니다. Git 문서 경로 또는 텍스트를 보내세요.');
  const accepted=queue.enqueue(route.lane,m.id,signal=>runMessage(m,route,signal).catch(e=>send(m.channel,e.message)));
  if(accepted){state.seen.push(m.id);state.seen=state.seen.slice(-10000);saveJSON(stateFile,state);}
}
bot.once('clientReady',()=>{if(registry.get().claudeBotId!==bot.user.id)console.warn('Claude bot identity differs from registry; updating to authenticated bot ID.');const file=path.join(hqRoot,'config','discord.md');updateFrontmatter(file,d=>{d.bots.claude_relay.user_id=bot.user.id;d.bots.claude_relay.verified=true;});registry.reload();console.log('Claude relay connected.');});
bot.on('messageCreate',m=>{void handle(m).catch(e=>send(m.channel,e.message).catch(()=>{}));});bot.on('error',()=>console.error('Discord connection error.'));
const shutdown=()=>{for(const lane of queue.lanes.keys())queue.stop(lane);bot.destroy();process.exit(0);};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
await bot.login(await dpapi(config.tokenEncrypted,true));
