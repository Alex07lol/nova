import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PACKAGE_NAME = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i;

export class PackageInstaller {
  constructor({ gate, shell, root } = {}) {
    this.gate = gate;
    this.shell = shell;
    this.root = root;
  }

  async install(candidate, { packageManager = 'npm' } = {}) {
    if (candidate.source !== 'npm') throw new Error('Only npm candidates are supported by this installer');
    if (!PACKAGE_NAME.test(candidate.name || '')) {
      const error = new Error(`Invalid package name: ${candidate.name}`);
      error.code = 'INVALID_PACKAGE_NAME';
      throw error;
    }
    await this.gate.request(candidate, { packageManager });
    const result = await this.shell.execute({ command: packageManager, args: ['install', candidate.name] });
    if (result.code !== 0) {
      const error = new Error(`Package installation failed: ${candidate.name}`);
      error.code = 'INSTALLATION_FAILED';
      throw error;
    }
    const packageJson = JSON.parse(await readFile(join(this.root, 'package.json'), 'utf8'));
    const installed = Boolean(packageJson.dependencies?.[candidate.name] || packageJson.devDependencies?.[candidate.name]);
    if (!installed) {
      const error = new Error(`Package installation could not be verified: ${candidate.name}`);
      error.code = 'INSTALLATION_UNVERIFIED';
      throw error;
    }
    return { package: candidate.name, packageManager, installed, result };
  }
}
