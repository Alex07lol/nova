import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_OUTPUT_LIMIT = 64 * 1024;

export function runProcess(command, args = [], {
  cwd,
  env = process.env,
  timeout = DEFAULT_TIMEOUT,
  outputLimit = DEFAULT_OUTPUT_LIMIT
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let truncated = false;
    let settled = false;
    let exitResult;
    let stdoutEnded = false;
    let stderrEnded = false;
    const append = (target, chunk) => {
      const value = chunk.toString();
      const remaining = outputLimit - target.length;
      if (remaining <= 0) {
        truncated = true;
        return target;
      }
      if (value.length > remaining) truncated = true;
      return target + value.slice(0, remaining);
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(new Error(`Process timed out after ${timeout}ms`), { code: 'TIMEOUT' });
    }, timeout);
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(Object.assign(error, result));
      else resolve({ ...result, stdout, stderr, truncated });
    };
    const finishAfterStreams = () => {
      if (exitResult && stdoutEnded && stderrEnded) finish(null, exitResult);
    };
    child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
    child.stdout.on('end', () => { stdoutEnded = true; finishAfterStreams(); });
    child.stderr.on('end', () => { stderrEnded = true; finishAfterStreams(); });
    child.on('error', (error) => finish(error, { code: 'SPAWN_ERROR' }));
    child.on('close', (code, signal) => {
      exitResult = { code, signal };
      finishAfterStreams();
    });
  });
}
