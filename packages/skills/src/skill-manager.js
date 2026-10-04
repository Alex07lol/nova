import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { classifySkillTrust } from './manifest-security.js';
import { SkillSandbox } from './skill-sandbox.js';

export class SkillManager {
  constructor({ roots = [], statePath } = {}) {
    this.roots = roots;
    this.statePath = statePath;
    this.skills = new Map();
    this.disabled = new Set();
  }

  async load() {
    if (this.statePath) {
      try { this.disabled = new Set(JSON.parse(await readFile(this.statePath, 'utf8')).disabled || []); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    for (const root of this.roots) {
      let entries = [];
      try { entries = await readdir(root, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const manifestPath = join(root, entry.name, 'skill.json');
        try {
          const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
          this.#validate(manifest);
          this.skills.set(manifest.id, { ...manifest, dependencies: manifest.dependencies || [], ...classifySkillTrust(manifest, root), enabled: !this.disabled.has(manifest.id), source: root });
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
    }
    for (const skill of this.skills.values()) {
      skill.missingDependencies = skill.dependencies.filter((dependency) => !this.skills.has(dependency));
      skill.available = skill.missingDependencies.length === 0;
    }
    return this.list();
  }

  #validate(manifest) {
    for (const field of ['id', 'name', 'version', 'description']) {
      if (!manifest[field]) throw new Error(`Invalid skill manifest: missing ${field}`);
    }
    if (!Array.isArray(manifest.permissions)) throw new Error(`Invalid skill manifest: ${manifest.id}`);
    if (manifest.dependencies && !Array.isArray(manifest.dependencies)) throw new Error(`Invalid skill dependencies: ${manifest.id}`);
  }

  list() { return [...this.skills.values()].sort((a, b) => a.id.localeCompare(b.id)); }
  get(id) { return this.skills.get(id); }

  activate(id, { policy, approved = false } = {}) {
    const skill = this.get(id);
    if (!skill) throw new Error(`Skill not found: ${id}`);
    if (!skill.enabled || !skill.available) throw new Error(`Skill is unavailable: ${id}`);
    return new SkillSandbox({ skill, policy, approved });
  }

  async install(source, destinationRoot) {
    const manifest = JSON.parse(await readFile(join(source, 'skill.json'), 'utf8'));
    this.#validate(manifest);
    if (!/^[a-zA-Z0-9._-]+$/.test(manifest.id)) throw new Error(`Invalid skill id: ${manifest.id}`);
    const destination = join(destinationRoot, manifest.id);
    await mkdir(destinationRoot, { recursive: true });
    await cp(source, destination, { recursive: true, force: false, errorOnExist: true });
    const integrity = createHash('sha256').update(await readFile(join(source, 'skill.json'))).digest('hex');
    return { ...manifest, dependencies: manifest.dependencies || [], integrity, enabled: true, source: destinationRoot };
  }

  async setEnabled(id, enabled) {
    if (!this.skills.has(id)) throw new Error(`Skill not found: ${id}`);
    if (enabled) this.disabled.delete(id); else this.disabled.add(id);
    if (this.statePath) {
      await mkdir(dirname(this.statePath), { recursive: true });
      await writeFile(this.statePath, `${JSON.stringify({ disabled: [...this.disabled].sort() }, null, 2)}\n`, { mode: 0o600 });
    }
    const skill = this.skills.get(id);
    skill.enabled = enabled;
    return skill;
  }

  async remove(id, localRoot) {
    const skill = this.skills.get(id);
    if (!skill) throw new Error(`Skill not found: ${id}`);
    if (skill.source !== localRoot) throw new Error('Built-in skills cannot be removed');
    await rm(join(localRoot, id), { recursive: true, force: false });
    this.skills.delete(id);
  }
}
