import { spawn } from 'node:child_process';

export interface ProcessResult { code: number | null; stdout: string; stderr: string; timedOut: boolean; aborted: boolean; spawnCode?: string }
export class CommandError extends Error {
  constructor(public result: ProcessResult) {
    super(result.aborted ? 'Operation cancelled.' : result.timedOut ? 'Process timed out.' : result.stderr || result.spawnCode || `Process exited with code ${result.code}`);
  }
}
export function runCommand(executable: string, args: string[], signal?: AbortSignal, timeoutMs = 120000): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new CommandError({ code: null, stdout: '', stderr: '', timedOut: false, aborted: true }));
    const grouped = process.platform !== 'win32';
    const child = spawn(executable, args, { detached: grouped, stdio: ['ignore', 'pipe', 'pipe'] });
    const result: ProcessResult = { code: null, stdout: '', stderr: '', timedOut: false, aborted: false };
    let settled = false;
    let escalation: ReturnType<typeof setTimeout> | undefined;
    const kill = (kind: NodeJS.Signals) => {
      try {
        if (grouped && child.pid) process.kill(-child.pid, kind);
        else child.kill(kind);
      } catch { /* already exited */ }
    };
    const terminate = () => {
      kill('SIGTERM');
      if (!escalation) escalation = setTimeout(() => kill('SIGKILL'), 500);
    };
    const abort = () => { result.aborted = true; terminate(); };
    const timer = setTimeout(() => { result.timedOut = true; terminate(); }, timeoutMs);
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (escalation) { clearTimeout(escalation); kill('SIGKILL'); }
      signal?.removeEventListener('abort', abort);
      if (result.code === 0 && !result.timedOut && !result.aborted && !result.spawnCode) resolve(result);
      else reject(new CommandError(result));
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on('data', (data: Buffer) => { result.stdout = (result.stdout + data.toString()).slice(-262144); });
    child.stderr.on('data', (data: Buffer) => { result.stderr = (result.stderr + data.toString()).slice(-8192); });
    child.once('error', (error: NodeJS.ErrnoException) => { result.spawnCode = error.code || error.message; finish(); });
    child.once('close', (code) => { result.code = code; finish(); });
  });
}
