import { fileURLToPath } from 'node:url';
import { AppServer, codexCommand } from './rpc.mjs';
import { configuredPath, isMac, readMacEnv } from '../shared/host-settings.mjs';

const settings = isMac ? readMacEnv() : {};
const cwd = configuredPath('HQ_ROOT', settings) || fileURLToPath(new URL('../../', import.meta.url));
const command = codexCommand({env: {...process.env, CODEX_EXECUTABLE: configuredPath('CODEX_EXECUTABLE', settings)}});
const rpc = new AppServer(command);
let timer;
try {
  await rpc.initialize();
  const {thread} = await rpc.request('thread/start', {cwd, sandbox: 'read-only', approvalPolicy: 'never', ephemeral: true});
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
