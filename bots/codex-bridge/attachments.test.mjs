import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AttachmentStore, refersToPDF, validateAttachmentURL} from './attachments.mjs';
import {channelInput, conversationKey, AppServer} from './rpc.mjs';

const PDF = Buffer.from('%PDF-1.7\nfixture data for transport testing\n%%EOF');
const file = (id='f1', name='기획서.pdf', extra={}) => ({id,name,size:PDF.length,contentType:'application/pdf',url:`https://cdn.discordapp.com/attachments/100/${id}/doc.pdf?ex=expiry&hm=signature`,...extra});
const message = (id='100', channel='thread-a', attachments=[file()], content='') => ({id,author:{id:'owner',bot:false},guildId:'guild',channel:{id:channel},attachments:new Map(attachments.map(a=>[a.id,a])),content,createdTimestamp:Number(id)});
const allowed = m => m.author.id==='owner' && !m.author.bot;
function fixture(t, options={}, fetchImpl=async()=>new Response(PDF)) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'discord-attachments-test-'));
  // Remove only the exact files/directories created by this test, within its temp root.
  t.after(()=>{const clean=d=>{const relative=path.relative(dir,d);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Invalid cleanup target');for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())clean(p);else fs.unlinkSync(p);}fs.rmdirSync(d);};clean(dir);});
  return new AttachmentStore(dir,options,fetchImpl);
}

test('attachment-only guild/DM inputs preserve access checks and are not dropped',()=>{
  const m=message();
  assert.ok(channelInput(m,'owner','bot',false,[],true));
  assert.ok(channelInput({...m,guildId:null},'owner','bot'));
  assert.equal(channelInput(m,'stranger','bot',false,[],true),null);
  assert.equal(channelInput(m,'owner','bot',false,[],false),null);
  assert.equal(channelInput({...m,attachments:new Map(),guildId:null},'owner','bot'),'');
});

test('PDF download provides an existing safe local path in the exact agent input',async t=>{
  const store=fixture(t), m=message('100','thread-a',[file('a','../../CON.pdf')]);
  const result=await store.prepare(m,'business|'+conversationKey(m),'',allowed);
  assert.equal(result.blocked,false);assert.equal(result.files.length,1);
  const f=result.files[0];assert.deepEqual(fs.readFileSync(f.path),PDF);
  assert.ok(path.relative(store.root,f.path).split(path.sep).length===2);
  assert.ok(result.input[0].text.includes(f.path.replaceAll('\\','\\\\')));
  assert.ok(result.prompt.includes('로컬에 다운로드'));
  assert.equal(fs.readFileSync(store.manifestPath,'utf8').includes('signature'),false,'do not persist signed CDN URLs');
});

test('previous PDF survives restart; multiple PDFs in newest message are retained; threads stay isolated',async t=>{
  let downloads=0;
  const store=fixture(t,{},async()=>{downloads++;return new Response(PDF);});
  await store.prepare(message('100'), 'business|thread-a','',allowed);
  await store.prepare(message('101','thread-a',[file('a'),file('b','보충.pdf')]), 'business|thread-a','',allowed);
  const reopened=new AttachmentStore(store.root,{},async()=>{throw Error('should use cache');});
  const result=await reopened.prepare(message('102','thread-a',[]),'business|thread-a','위 PDF를 요약해줘',allowed);
  assert.equal(result.files.length,2);assert.ok(result.files.every(f=>f.messageId==='101'));assert.equal(downloads,3);
  const other=await reopened.prepare(message('103','thread-b',[]),'business|thread-b','위 PDF를 요약해줘',allowed);
  assert.equal(other.blocked,true);assert.equal(other.files.length,0);assert.match(other.errors[0],/기록 조회 실패/);
  reopened.clear('business|thread-a');assert.equal(reopened.entries['business|thread-a'],undefined);
});

test('pre-upgrade PDF history lookup selects only the newest authorized file in the same thread',async t=>{
  const store=fixture(t), m=message('200','thread-a',[]);
  let options;
  m.channel.messages={fetch:async query=>{options=query;return new Map([
    ['199',message('199','thread-b')],
    ['198',{...message('198'),author:{id:'stranger',bot:false}}],
    ['197',message('197')],['196',message('196')],
  ]);}};
  const result=await store.prepare(m,'s','위 PDF 정리해줘',allowed);
  assert.equal(result.files[0].messageId,'197');assert.deepEqual(options,{limit:100,before:'200'});
});

test('explicit reply chooses that PDF; other-thread reply fails instead of guessing from cache',async t=>{
  const store=fixture(t);await store.prepare(message('100'),'s','',allowed);
  const m=message('200','thread-a',[]);m.reference={messageId:'150'};
  m.fetchReference=async()=>message('150','thread-a',[file('reply')]);
  assert.equal((await store.prepare(m,'s','요약해줘',allowed)).files[0].messageId,'150');
  m.fetchReference=async()=>message('199','thread-b');
  const rejected=await store.prepare(m,'s','위 PDF 읽어줘',allowed);
  assert.equal(rejected.blocked,true);assert.match(rejected.errors[0],/다른 채널/);
  m.fetchReference=async()=>message('199','thread-a',[]);
  const plain=await store.prepare(m,'s','고마워',allowed);
  assert.equal(plain.files.length,0);assert.equal(plain.errors.length,0);assert.equal(plain.blocked,false);
});

test('expired signed URL is refreshed from the source message once',async t=>{
  const urls=[];const store=fixture(t,{},async url=>{urls.push(String(url));return urls.length===1?new Response('',{status:403}):new Response(PDF);});
  const m=message();let refresh=0;m.fetch=async force=>{assert.equal(force,true);refresh++;return message('100','thread-a',[file('f1','문서.pdf',{url:'https://cdn.discordapp.com/attachments/100/f1/new.pdf?hm=fresh'})]);};
  const result=await store.prepare(m,'s','',allowed);
  assert.equal(result.files.length,1);assert.equal(refresh,1);assert.match(urls[1],/fresh/);
});

test('oversized, invalid PDF, empty, missing, and partial-stream files show reasons and clean partials',async t=>{
  const tooBig=fixture(t,{maxFileBytes:20},async()=>{throw Error('must reject before fetch');});
  const large=await tooBig.prepare(message(),'s','',allowed);assert.equal(large.blocked,true);assert.match(large.errors[0],/제한/);
  for(const [body,pattern] of [[Buffer.from('not pdf'),/PDF 헤더/],[Buffer.alloc(0),/빈 첨부/]]){
    const store=fixture(t,{},async()=>new Response(body));const result=await store.prepare(message(),'s','',allowed);
    assert.equal(result.blocked,true);assert.match(result.errors[0],pattern);
    const files=fs.readdirSync(store.root,{recursive:true});assert.ok(!files.some(f=>f.endsWith('.part')));
  }
  const missing=fixture(t,{},async()=>new Response('',{status:404}));const failed=await missing.prepare(message(),'s','',allowed);
  assert.match(failed.errors[0],/HTTP 404/);assert.match(failed.errors[0],/다시 첨부/);
  const streaming=fixture(t,{maxFileBytes:50},async()=>new Response(new ReadableStream({start(c){c.enqueue(PDF);c.enqueue(PDF);c.close();}})));
  const result=await streaming.prepare(message(),'s','',allowed);assert.equal(result.blocked,true);assert.match(result.errors[0],/실제 파일 크기/);
  assert.ok(!fs.readdirSync(streaming.root,{recursive:true}).some(f=>f.endsWith('.part')));
});

test('partial success, missing-history permission, empty history, lost local file, timeout are explicit',async t=>{
  let calls=0;const store=fixture(t,{},async()=>++calls===1?new Response(PDF):new Response('',{status:403}));
  const mixed=await store.prepare(message('100','thread-a',[file('a'),file('b')]),'s','read',allowed);
  assert.equal(mixed.files.length,1);assert.equal(mixed.errors.length,1);assert.equal(mixed.blocked,false);assert.match(mixed.prompt,/첨부 처리 실패/);
  const m=message('200','thread-a',[]);m.channel.messages={fetch:async()=>{throw Object.assign(Error('denied'),{code:50013});}};
  const denied=await store.prepare(m,'empty','위 PDF',allowed);assert.match(denied.errors[0],/50013/);
  m.channel.messages.fetch=async()=>new Map();const notFound=await store.prepare(m,'empty','위 PDF',allowed);assert.match(notFound.errors[0],/찾지 못/);
  fs.unlinkSync(mixed.files[0].path);m.channel.messages.fetch=async()=>{throw Object.assign(Error('deleted'),{code:10008});};const lost=await store.prepare(m,'s','위 PDF',allowed);assert.match(lost.errors[0],/원본/);assert.equal(lost.blocked,true);
  const timed=fixture(t,{timeoutMs:5},async(url,{signal})=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('timeout')),20);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});}));
  assert.match((await timed.prepare(message(),'s','',allowed)).errors[0],/제한 시간/);
});

test('concurrent upload and follow-up serialize so above PDF waits for the download',async t=>{
  const store=fixture(t,{},async()=>{await new Promise(r=>setTimeout(r,20));return new Response(PDF);});
  const upload=store.prepare(message(),'s','',allowed);
  const followup=store.prepare(message('200','thread-a',[]),'s','위 PDF 요약',allowed);
  const [a,b]=await Promise.all([upload,followup]);assert.equal(b.files[0].path,a.files[0].path);
});

test('same attachment is cached, other file formats still get a path, count limit is visible',async t=>{
  let calls=0;const store=fixture(t,{maxFiles:1},async()=>{calls++;return new Response(Buffer.from('notes'));});
  const m=message('100','thread-a',[file('a','note.txt',{contentType:'text/plain',size:5}),file('b')]);
  const result=await store.prepare(m,'s','',allowed);assert.equal(result.files.length,1);assert.equal(result.files[0].pdf,false);assert.match(result.errors[0],/나눠서/);
  await store.prepare(m,'s','',allowed);assert.equal(calls,1);
});

test('only Discord attachment CDN URLs are fetched; redirect and network errors are reported',async t=>{
  for(const url of ['http://127.0.0.1/x','https://evil.example/attachments/x','https://cdn.discordapp.com.evil.test/attachments/x','file:///tmp/a.pdf','https://cdn.discordapp.com/not-attachment','https://u:p@cdn.discordapp.com/attachments/x'])assert.throws(()=>validateAttachmentURL(url));
  const store=fixture(t,{},async(url,opts)=>{assert.equal(opts.redirect,'error');throw Error('network unavailable');});
  assert.match((await store.prepare(message(),'s','',allowed)).errors[0],/CDN에 연결/);
  for(const text of ['위 PDF 요약','이전 PDF','아까 PDF','previous PDF'])assert.equal(refersToPDF(text),true);
  assert.equal(refersToPDF('ordinary message'),false);
});

test('prepared attachment input survives App Server JSON-RPC transport with a readable local path',async t=>{
  const store=fixture(t), prepared=await store.prepare(message(),'s','read this PDF',allowed);
  const fake=`const fs=require('fs');require('readline').createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')console.log(JSON.stringify({id:m.id,result:{}}));if(m.method==='turn/start'){const text=m.params.input[0].text;const data=JSON.parse(text.slice(text.indexOf('[\\n'),text.indexOf('\\n]')+2));console.log(JSON.stringify({id:m.id,result:{received:fs.readFileSync(data[0].path).subarray(0,5).toString(),text}}));}});`;
  const rpc=new AppServer([process.execPath,['-e',fake,'--']]);
  try{await rpc.initialize();const result=await rpc.request('turn/start',{threadId:'test',input:prepared.input});assert.equal(result.received,'%PDF-');assert.equal(result.text,prepared.prompt);}finally{rpc.close();}
});

