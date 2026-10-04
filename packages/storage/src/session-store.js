import { appendFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createId } from '../../shared/src/ids.js';

function safeSessionId(sessionId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) throw new Error('Invalid session id');
  return sessionId;
}

export class SessionStore {
  constructor({ root }) {
    this.root = root;
  }

  async create({ prompt, skills = [] } = {}) {
    const id = createId('session');
    const now = new Date().toISOString();
    const session = {
      id,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      goal: prompt || null,
      activeSkills: skills,
      tasks: [],
      importantFindings: []
    };
    await this.save(session);
    return session;
  }

  async load(sessionId) {
    const path = join(this.root, safeSessionId(sessionId), 'session.json');
    return JSON.parse(await readFile(path, 'utf8'));
  }

  async list() {
    let entries = [];
    try { entries = await readdir(this.root, { withFileTypes: true }); } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    const sessions = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^[a-zA-Z0-9_-]+$/.test(entry.name)) continue;
      try { sessions.push(await this.load(entry.name)); } catch { /* ignore incomplete sessions */ }
    }
    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
  }

  async save(session) {
    const dir = join(this.root, safeSessionId(session.id));
    await mkdir(dir, { recursive: true });
    const path = join(dir, 'session.json');
    const temporary = `${path}.tmp`;
    const next = { ...session, updatedAt: new Date().toISOString() };
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, path);
    return next;
  }

  async recordEvent(sessionId, event) {
    const dir = join(this.root, safeSessionId(sessionId));
    await mkdir(dir, { recursive: true });
    await appendFile(join(dir, 'events.jsonl'), `${JSON.stringify(event)}\n`, { mode: 0o600 });
  }
}
