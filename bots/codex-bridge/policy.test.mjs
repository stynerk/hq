import test from 'node:test';
import assert from 'node:assert/strict';
import {executionContext, trustedAttachmentSource, canRequestApproval} from './policy.mjs';

function fixture() {
  const project = {slug:'one',localPath:'/workspace/one',body:'Project policy',devPm:{name:'Cap'}};
  const reg = {hqRoot:'/workspace/hq',errors:[],agents:new Map([['dev-pm',{body:'Developer policy'}]]),ownerId:'owner',claudeBotId:'claude',byChannel:new Map([['dev',{project,kind:'dev'}],['main',{project,kind:'main'}]])};
  const route = {lane:'one',project,role:'dev-pm',mode:'owner',text:'Implement approved task'};
  return {reg,route,project};
}
test('execution context isolates write/read sessions and applies project role',()=>{
  const {reg,route} = fixture();
  const write = executionContext(route,reg), read = executionContext({...route,mode:'consult'},reg);
  assert.equal(write.cwd,'/workspace/one'); assert.equal(write.sandbox,'workspace-write');
  assert.equal(read.sandbox,'read-only'); assert.notEqual(write.sessionScope,read.sessionScope);
  assert.match(write.developerInstructions,/Developer policy/); assert.match(write.developerInstructions,/Project policy/); assert.match(write.developerInstructions,/Cap/);
  const dm = executionContext({role:'hq-reader',lane:'hq',mode:'owner',text:'Status'},reg);
  assert.equal(dm.cwd,'/workspace/hq'); assert.equal(dm.sandbox,'read-only');
});
test('execute includes exact Issue and rejects registry errors',()=>{
  const {reg,route} = fixture();
  assert.match(executionContext({...route,mode:'execute',keyword:{issue:17}},reg).text,/Issue #17/);
  assert.throws(()=>executionContext(route,{...reg,errors:['duplicate channel']}),/레지스트리/);
});
test('read-only and unknown turns cannot request elevated approval',()=>{
  for (const active of [null,{}, {readOnly:true,sandbox:'read-only'},{readOnly:true,sandbox:'workspace-write'},{readOnly:false,sandbox:'read-only'},{readOnly:false,sandbox:'danger-full-access'}]) assert.equal(canRequestApproval(active),false);
  assert.equal(canRequestApproval({readOnly:false,sandbox:'workspace-write'}),true);
});
test('attachment trust is owner-only or executing peer in registered dev thread',()=>{
  const {reg,route}=fixture();
  const owner={author:{id:'owner',bot:false},channel:{id:'main'}};
  const peer={author:{id:'claude',bot:true},channel:{id:'dev'}};
  assert.equal(trustedAttachmentSource(owner,reg,route),true);
  assert.equal(trustedAttachmentSource(peer,reg,{...route,mode:'execute'}),true);
  assert.equal(trustedAttachmentSource(peer,reg,{...route,mode:'consult'}),false);
  assert.equal(trustedAttachmentSource({...peer,channel:{id:'main'}},reg,{...route,mode:'execute'}),false);
  assert.equal(trustedAttachmentSource({...peer,author:{id:'stranger',bot:true}},reg,{...route,mode:'execute'}),false);
});
