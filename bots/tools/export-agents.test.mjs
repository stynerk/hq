import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportAgents} from './export-agents.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-export-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const project = path.join(root, 'project'), hq = path.join(root, 'hq');
  fs.mkdirSync(project); fs.mkdirSync(path.join(hq, 'agents/subagents'), {recursive:true});
  const add = (name, text) => fs.writeFileSync(path.join(hq, 'agents/subagents', name + '.md'), text);
  return {project, hq, add};
}
test('exports both runtimes and preserves quoted multiline instructions', t => {
  const {project,hq,add} = fixture(t);
  add('qa', '---\nname: qa\ndescription: QA\nruntime: codex\nsandbox: read-only\n---\nTest "quoted" paths C:\\work.\nSecond line.\n');
  add('researcher', '---\nname: researcher\ndescription: Research\nruntime: claude\ntools: [Read, Grep]\n---\nCheck sources.\n');
  assert.equal(exportAgents(project,hq).length,2);
  const toml = fs.readFileSync(path.join(project,'.codex/agents/qa.toml'),'utf8');
  assert.match(toml,/sandbox_mode = "read-only"/);
  const value = toml.split('developer_instructions = ')[1].trim();
  assert.equal(JSON.parse('"' + value.slice(3,-3) + '"'),'Test "quoted" paths C:\\work.\nSecond line.');
  assert.match(fs.readFileSync(path.join(project,'.claude/agents/researcher.md'),'utf8'),/Generated from hq/);
  assert.equal(exportAgents(project,hq).length,2);
});
test('refuses path traversal and unmanaged files without partial writes', t => {
  const {project,hq,add} = fixture(t);
  add('a','---\nname: a\ndescription: First\nruntime: claude\n---\nBody\n');
  add('z','---\nname: ../bad\ndescription: Bad\nruntime: codex\n---\nBody\n');
  assert.throws(()=>exportAgents(project,hq),/Invalid agent/);
  assert.equal(fs.existsSync(path.join(project,'.claude')),false);
  fs.unlinkSync(path.join(hq,'agents/subagents/z.md'));
  fs.mkdirSync(path.join(project,'.claude/agents'),{recursive:true});
  fs.writeFileSync(path.join(project,'.claude/agents/a.md'),'User owned');
  assert.throws(()=>exportAgents(project,hq),/unmanaged/);
  assert.equal(fs.readFileSync(path.join(project,'.claude/agents/a.md'),'utf8'),'User owned');
});
