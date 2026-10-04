import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export class AccountManager {
  constructor({ path }) { this.path = path; }

  async list() {
    try { return JSON.parse(await readFile(this.path, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }

  async connect({ provider, authMethod = 'environment' }) {
    const accounts = await this.list();
    const next = [...accounts.filter((account) => account.provider !== provider), { provider, authMethod, connectedAt: new Date().toISOString() }];
    await mkdir(join(this.path, '..'), { recursive: true });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.path);
    return next;
  }

  async disconnect(provider) {
    const accounts = (await this.list()).filter((account) => account.provider !== provider);
    await mkdir(join(this.path, '..'), { recursive: true });
    await writeFile(this.path, `${JSON.stringify(accounts, null, 2)}\n`, { mode: 0o600 });
    return accounts;
  }
}
