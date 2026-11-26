const path = require('node:path');

module.exports = {
  apps: [
    {name: 'hq-codex-bridge', script: 'codex-bridge/bridge.mjs'},
    {name: 'hq-claude-relay', script: 'claude-relay/relay.mjs', treekill: false},
  ].map(app => ({
    ...app,
    cwd: __dirname,
    script: path.join(__dirname, app.script),
    interpreter: process.execPath,
    exec_mode: 'fork',
    instances: 1,
    restart_delay: 5000,
    kill_timeout: 5000,
  })),
};
