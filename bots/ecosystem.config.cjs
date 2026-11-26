const path = require('node:path');

module.exports = {
  apps: [
    {name: 'tony', script: 'claude-relay/relay.mjs'},
    {name: 'cap', script: 'codex-bridge/bridge.mjs'},
  ].map(app => ({
    ...app,
    cwd: __dirname,
    env: {HQ_BOTS_ENV_FILE: path.join(__dirname, '.env')},
  })),
};
