import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';
import {splitFrontmatter} from '../shared/registry.mjs';

const marker = 'Generated from hq; do not edit here.';
const quote = value => JSON.stringify(String(value));
export function exportAgents(projectPath, hqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')) {
  const project = path.resolve(projectPath);
  if (!fs.statSync(project).isDirectory()) throw new Error('Project path must be an existing directory');
  const source = path.join(hqRoot, 'agents/subagents');
  const plans = [];
  for (const file of fs.readdirSync(source).filter(name => name.endsWith('.md')).sort()) {
    const {data, body} = splitFrontmatter(fs.readFileSync(path.join(source, file), 'utf8'));
    if (!['claude', 'codex'].includes(data.runtime)) continue;
    if (!/^[a-z][a-z0-9_-]*$/.test(data.name || '') || !data.description || !body.trim()) throw new Error(`Invalid agent definition: ${file}`);
    let target, content;
    if (data.runtime === 'claude') {
      const metadata = {name: data.name, description: data.description};
      if (data.tools) metadata.tools = data.tools;
      target = path.join(project, '.claude/agents', data.name + '.md');
      content = `---\n${YAML.stringify(metadata).trimEnd()}\n---\n<!-- ${marker} -->\n${body.trim()}\n`;
    } else {
      target = path.join(project, '.codex/agents', data.name + '.toml');
      const sandbox = data.sandbox || 'workspace-write';
      if (!['read-only', 'workspace-write', 'danger-full-access'].includes(sandbox)) throw new Error(`Invalid sandbox: ${file}`);
      // Escape quotes, slashes and control characters inside a TOML multiline basic string.
      const instructions = quote(body.trim()).slice(1, -1);
      content = `# ${marker}\nname = ${quote(data.name)}\ndescription = ${quote(data.description)}\nsandbox_mode = ${quote(sandbox)}\ndeveloper_instructions = """${instructions}"""\n`;
    }
    if (fs.existsSync(target) && !fs.readFileSync(target, 'utf8').includes(marker)) throw new Error(`Refusing to overwrite an unmanaged agent: ${target}`);
    plans.push({target, content});
  }
  // Validate the full plan before writing any file.
  for (const {target, content} of plans) { fs.mkdirSync(path.dirname(target), {recursive: true}); fs.writeFileSync(target, content); }
  return plans.map(({target}) => target);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node bots/tools/export-agents.mjs <project-path>');
    const files = exportAgents(process.argv[2]);
    console.log(`Exported ${files.length} agents:\n${files.join('\n')}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
