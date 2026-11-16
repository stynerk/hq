import fs from 'node:fs';
import {execFile} from 'node:child_process';
const c=JSON.parse(fs.readFileSync(new URL('./private/config.json',import.meta.url)));
const token=await new Promise((resolve,reject)=>{
 const p=execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command','$s=[Console]::In.ReadToEnd() | ConvertTo-SecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}'],{windowsHide:true},(e,out)=>e?reject(Error('decrypt failed')):resolve(out.trim()));p.stdin.end(c.tokenEncrypted);
});
async function get(route){const r=await fetch('https://discord.com/api/v10'+route,{headers:{Authorization:'Bot '+token}});if(!r.ok)return {http:r.status};return r.json();}
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
