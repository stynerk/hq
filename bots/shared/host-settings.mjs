import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';

export const botsRoot = fileURLToPath(new URL('../', import.meta.url));
export const isMac = process.platform === 'darwin';

export function readMacEnv(file = process.env.HQ_BOTS_ENV_FILE || path.join(botsRoot, '.env')) {
  const message = 'macOS 설정 파일 bots/.env를 현재 사용자 소유의 권한 0600 일반 파일로 준비하세요.';
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o7777) !== 0o600 || stat.uid !== process.getuid()) throw new Error(message);
    return parseEnv(fs.readFileSync(fd, 'utf8'));
  } catch {
    throw new Error(message);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// Read only specific runtime settings. Discord credentials stay out of the child environment.
export function configuredPath(key, settings, env = process.env) {
  const value = env[key] || settings[key];
  return value?.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value;
}

export function macDiscordToken(settings, key) {
  const token = settings[key]?.trim();
  if (!token) throw new Error(`bots/.env에 ${key}을 설정하세요.`);
  return token;
}

export function windowsAppData(env = process.env, home = os.homedir()) {
  return env.APPDATA || path.win32.join(home, 'AppData', 'Roaming');
}

export function dpapi(value, decrypt = false) {
  if (process.platform !== 'win32') throw new Error('DPAPI is only available on Windows');
  const script = decrypt
    ? '$s=[Console]::In.ReadToEnd() | ConvertTo-SecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}'
    : '$s=ConvertTo-SecureString ([Console]::In.ReadToEnd()) -AsPlainText -Force; [Console]::Out.Write(($s | ConvertFrom-SecureString))';
  return new Promise((resolve, reject) => {
    const child = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {windowsHide: true}, (error, output) => {
      if (error) reject(new Error('Windows credential encryption failed'));
      else resolve(output.trim());
    });
    child.stdin.on('error', () => {});
    child.stdin.end(value);
  });
}
