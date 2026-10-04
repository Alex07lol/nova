export class InstallationGate {
  constructor({ approval } = {}) { this.approval = approval; }

  async request(candidate, { packageManager = 'npm' } = {}) {
    const decision = await this.approval?.request('dependency.install', {
      name: candidate.name,
      source: candidate.source,
      url: candidate.url,
      packageManager
    }) || { approved: false };
    if (!decision.approved) {
      const error = new Error(`Dependency installation denied: ${candidate.name}`);
      error.code = 'INSTALLATION_DENIED';
      throw error;
    }
    return { candidate: candidate.name, source: candidate.source, packageManager, approved: true };
  }
}
