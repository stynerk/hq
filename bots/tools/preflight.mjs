import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRegistry} from '../shared/registry.mjs';
export function preflight(hqRoot) {
  const reg = loadRegistry(hqRoot);
  const errors = [...reg.errors], warnings = [];
  for (const project of reg.projects.filter(p => p.status !== 'archived')) {
    const report = project.status === 'active' ? errors : warnings;
    if (!project.localPath || !fs.existsSync(project.localPath)) { report.push(`${project.slug}: local_path 폴더가 없습니다.`); continue; }
    const file = path.join(project.localPath, '.claude/settings.local.json');
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, 'utf8');
    let settings;
    try { settings = JSON.parse(raw.replace(/^\uFEFF/, '')); }
    catch { report.push(`${project.slug}: .claude/settings.local.json의 JSON 문법을 수정해야 합니다. 원본 백업 후 검토하세요.`); continue; }
    if (/ensure-relay\.ps1|start-sora\.cmd|discord-sora|sora-claude/i.test(JSON.stringify(settings.hooks || {}))) report.push(`${project.slug}: 이전 봇을 시작하는 Claude hook이 있습니다. 원본 백업 후 해당 hook을 제거하세요.`);
  }
  return {errors, warnings};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = preflight(process.env.HQ_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
  for (const text of result.warnings) console.log('WARN: ' + text);
  for (const text of result.errors) console.error('BLOCK: ' + text);
  if (result.errors.length) process.exitCode = 1;
  else console.log('HQ project preflight passed. Credentials and live Discord were not checked.');
}
