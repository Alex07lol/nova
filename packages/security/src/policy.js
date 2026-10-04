const DEFAULTS = {
  'filesystem.read': true,
  'filesystem.write': false,
  shell: false,
  'process.execute': false,
  'git.read': true,
  network: false
};

export class PermissionPolicy {
  constructor(overrides = {}) {
    this.permissions = { ...DEFAULTS, ...overrides };
  }

  evaluate(capability) {
    return {
      capability,
      allowed: this.permissions[capability] === true,
      reason: this.permissions[capability] === true ? 'allowed by policy' : 'requires approval'
    };
  }

  assert(capability, { approved = false } = {}) {
    const decision = this.evaluate(capability);
    if (!decision.allowed && !approved) {
      const error = new Error(`Permission denied for ${capability}: ${decision.reason}`);
      error.code = 'PERMISSION_DENIED';
      throw error;
    }
    return { ...decision, approved };
  }
}
