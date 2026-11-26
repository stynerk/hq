import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {configuredPath, dpapi, isMac, macDiscordToken, readMacEnv} from '../shared/host-settings.mjs';
import {loadRegistry} from '../shared/registry.mjs';

const settings = isMac ? readMacEnv() : {};
const privateDir = configuredPath('BRIDGE_PRIVATE_DIR', settings) || fileURLToPath(new URL('./private', import.meta.url));
const c = isMac
  ? loadRegistry(configuredPath('HQ_ROOT', settings) || fileURLToPath(new URL('../../', import.meta.url)))
  : JSON.parse(fs.readFileSync(path.join(privateDir, 'config.json'), 'utf8'));
const token = isMac ? macDiscordToken(settings, 'CODEX_DISCORD_BOT_TOKEN') : await dpapi(c.tokenEncrypted, true);
async function get(route) {
  let response;
  try { response = await fetch('https://discord.com/api/v10' + route, {headers: {Authorization: 'Bot ' + token}}); }
  catch { throw new Error('Discord API 요청 실패. 연결과 토큰 형식을 확인하세요.'); }
  if (!response.ok) return {http: response.status};
  return response.json();
}
const bot=await get('/users/@me'),owner=await get('/users/'+c.ownerId);
console.log(JSON.stringify({bot:bot.username,configuredOwner:owner.username,ownerIsBot:owner.bot||false,ownerIsSelf:c.ownerId===bot.id}));
const guilds=await get('/users/@me/guilds');
for(const g of Array.isArray(guilds)?guilds:[]){
 const channels=await get('/guilds/'+g.id+'/channels');
 for(const channel of (Array.isArray(channels)?channels:[]).filter(x=>[0,5].includes(x.type))){
  const messages=await get('/channels/'+channel.id+'/messages?limit=12');
  console.log(JSON.stringify({channel:channel.name,id:channel.id,readStatus:messages.http||200,recent:Array.isArray(messages)?messages.map(m=>({id:m.id,author:m.author.username,owner:m.author.id===c.ownerId,bot:m.author.bot||false,mentionsBot:m.mentions?.some(u=>u.id===bot.id),prefix:/^!codex(?:\s|$)/i.test(m.content),hasContent:!!m.content,reply:!!m.message_reference})):[]}));
 }
}
