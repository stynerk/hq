import { AppServer } from './rpc.mjs';
const rpc = new AppServer();
let timer;
try {
  await rpc.initialize();
  const {thread} = await rpc.request('thread/start', {cwd: 'C:/Users/styne/orca/OurAdventure', sandbox: 'read-only', approvalPolicy: 'never', ephemeral: true});
  const messages = [];
  const completed = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Generation timed out')), 90000);
    rpc.on('notification', ({method, params: p}) => {
      if (p.threadId !== thread.id) return;
      if (method === 'item/completed' && p.item.type === 'agentMessage') messages.push(p.item.text);
      if (method === 'turn/completed') resolve(p.turn);
    });
  });
  rpc.on('request', ({id}) => rpc.send({id, error: {code: -32601, message: 'No tools in smoke test'}}));
  await rpc.request('turn/start', {threadId: thread.id, input: [{type: 'text', text: 'Do not call any tools. Reply with exactly CODEX_BRIDGE_OK.'}]});
  const turn = await completed;
  if (turn.status !== 'completed' || !messages.join('').includes('CODEX_BRIDGE_OK')) throw new Error('Unexpected generation result: ' + turn.status);
  console.log('Real ChatGPT-authenticated App Server turn: PASS');
} finally { clearTimeout(timer); rpc.close(); }
