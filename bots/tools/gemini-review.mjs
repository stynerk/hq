#!/usr/bin/env node
// 리뷰어(심사위원) 채점을 Gemini CLI로 돌린다 (2026-11-18 HJ 결정: 리뷰어만 Gemini).
// 작성자(Claude·Codex)와 다른 회사 모델로 채점해 같은 맹점을 피한다.
//
// 사용: node <hq>/bots/tools/gemini-review.mjs --criteria <기준 파일> <평가할 파일...>
//   기준 파일: 대회 배점표, 성공 지표, QA 체크리스트 등 서비스PM이 넘기는 채점 기준
// Gemini는 빈 임시 폴더에서 비대화형으로 실행한다. 저장소 파일을 직접 읽거나 고치지 못하고,
// 이 스크립트가 넘긴 내용만 본다. 인증은 HJ가 PC 사용자 환경 변수 GEMINI_API_KEY에 넣어 둔 API 키를 쓴다.
// (2026-06-18부터 개인 Google 계정 로그인으로는 Gemini CLI를 쓸 수 없다.)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const hqRoot = path.resolve(here, '..', '..');
const MAX_BYTES = 400_000;
// 무료 등급으로 쓴다(2026-11-18 HJ 결정). Pro는 무료 등급에서 빠졌으므로 Flash를 명시한다.
// 유료로 바꾸거나 모델 이름이 달라지면 PC 사용자 환경 변수 GEMINI_REVIEW_MODEL로 바꾼다.
export const reviewModel = (env = process.env) => env.GEMINI_REVIEW_MODEL || 'flash';

export function stripFrontmatter(text) { return String(text).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''); }

export function parseArgs(argv) {
  const files = []; let criteria = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--criteria') criteria = argv[++i];
    else files.push(argv[i]);
  }
  if (!criteria || !files.length) throw new Error('사용: gemini-review.mjs --criteria <기준 파일> <평가할 파일...>');
  return {criteria, files};
}

export function buildPrompt({rubric, criteria, files}) {
  let size = 0;
  const parts = files.map(({name, text}) => { size += Buffer.byteLength(text); return `### 파일: ${name}\n\n${text}`; });
  if (size > MAX_BYTES) throw new Error(`평가할 파일이 너무 큽니다(${size}바이트). 핵심 파일만 넘기세요.`);
  return [
    '너는 아래 지침을 따르는 리뷰어(심사위원)다. 지침의 "돌려주는 형식" 그대로, 한국어로만 답한다.',
    '도구를 쓰지 말고 아래에 주어진 내용만으로 채점한다.',
    '', '## 리뷰어 지침', stripFrontmatter(rubric).trim(),
    '', '## 채점 기준', criteria.name, '', criteria.text.trim(),
    '', '## 평가할 산출물', ...parts,
  ].join('\n');
}

// Windows에서 gemini.cmd를 shell로 실행하면 인자가 따옴표 없이 이어 붙여져 띄어쓰기마다 쪼개진다
// (2026-11-18 첫 실행에서 도움말만 출력). 설치된 패키지의 진입 파일을 node로 직접 실행해 shell을 거치지 않는다.
export function geminiCommand({platform = process.platform, env = process.env, exists = fs.existsSync, readFile = fs.readFileSync} = {}) {
  if (platform !== 'win32') return {cmd: 'gemini', pre: []};
  const root = path.join(env.APPDATA || '', 'npm', 'node_modules', '@google', 'gemini-cli');
  let bin = 'bundle/gemini.js';
  try { const pkg = JSON.parse(readFile(path.join(root, 'package.json'), 'utf8')); bin = typeof pkg.bin === 'string' ? pkg.bin : (pkg.bin?.gemini || bin); } catch {}
  const entry = path.join(root, bin);
  if (!exists(entry)) throw new Error(`Gemini CLI를 찾지 못했습니다(${entry}). PC에서 npm.cmd install -g @google/gemini-cli를 확인하세요.`);
  return {cmd: process.execPath, pre: [entry]};
}

export function runGemini(prompt, {spawnFn = spawn, timeoutMs = 300_000, command = geminiCommand()} = {}) {
  return new Promise((resolve, reject) => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-review-'));
    // 프롬프트 전체는 stdin으로 넘긴다. -p는 비대화형 실행을 켜는 짧은 지시만 담는다. shell은 쓰지 않는다.
    const child = spawnFn(command.cmd, [...command.pre, '-m', reviewModel(), '-p', '위 입력의 지침대로 채점하라.'], {cwd, windowsHide: true});
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Gemini 응답 시간 초과')); }, timeoutMs);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => { clearTimeout(timer); reject(new Error(`Gemini CLI 실행 실패: ${e.message}. PC에 설치·로그인했는지 확인하세요.`)); });
    child.on('close', code => {
      clearTimeout(timer); fs.rmSync(cwd, {recursive: true, force: true});
      if (code === 0 && out.trim()) resolve(out.trim());
      else reject(new Error(code === 41 ? 'Gemini 인증이 없습니다. PC의 사용자 환경 변수 GEMINI_API_KEY를 확인하고 봇을 재시작하세요.' : `Gemini 실패(종료 코드 ${code}): ${err.trim().split('\n').slice(-3).join(' ')}`));
    });
    child.stdin.end(prompt);
  });
}

async function main() {
  const {criteria, files} = parseArgs(process.argv.slice(2));
  const read = f => ({name: f, text: fs.readFileSync(f, 'utf8')});
  const prompt = buildPrompt({
    rubric: fs.readFileSync(path.join(hqRoot, 'agents', 'subagents', 'reviewer.md'), 'utf8'),
    criteria: read(criteria), files: files.map(read),
  });
  process.stdout.write(`[리뷰어: Gemini ${reviewModel()}]\n` + await runGemini(prompt) + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
