import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function safeId(value) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error('Invalid verification id');
  return value;
}

export class VerificationStore {
  constructor({ root }) { this.root = root; }

  async save(result, { sessionId, taskId } = {}) {
    const receipt = {
      runId: safeId(result.runId),
      sessionId: sessionId || null,
      taskId: taskId || null,
      createdAt: new Date().toISOString(),
      passed: result.passed,
      results: result.results.map(({ id, passed, durationMs, error }) => ({ id, passed, durationMs, ...(error ? { error } : {}) }))
    };
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, `${receipt.runId}.json`), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    return receipt;
  }

  async get(runId) {
    return JSON.parse(await readFile(join(this.root, `${safeId(runId)}.json`), 'utf8'));
  }

  async list() {
    let entries = [];
    try { entries = await readdir(this.root, { withFileTypes: true }); } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    const receipts = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      try { receipts.push(JSON.parse(await readFile(join(this.root, entry.name), 'utf8'))); } catch { /* ignore partial receipts */ }
    }
    return receipts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
