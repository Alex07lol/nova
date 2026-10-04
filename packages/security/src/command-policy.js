const DEFAULT_DENYLIST = ['sudo', 'su', 'rm', 'mkfs', 'shutdown', 'reboot', 'passwd'];

export class CommandPolicy {
  constructor({ allowlist = [], denylist = DEFAULT_DENYLIST } = {}) {
    this.allowlist = new Set(allowlist);
    this.denylist = new Set(denylist);
  }

  evaluate(command, args = []) {
    if (this.denylist.has(command)) {
      return { allowed: false, reason: `${command} is in the command denylist`, code: 'DANGEROUS_COMMAND' };
    }
    if (this.allowlist.size && !this.allowlist.has(command)) {
      return { allowed: false, reason: `${command} is not in the command allowlist`, code: 'COMMAND_NOT_ALLOWED' };
    }
    if (args.some((arg) => /(^|\s)(-rf|--no-preserve-root)(\s|$)/.test(arg))) {
      return { allowed: false, reason: 'recursive force flags require explicit review', code: 'DANGEROUS_COMMAND' };
    }
    return { allowed: true, reason: 'command accepted', code: null };
  }

  assert(command, args = []) {
    const decision = this.evaluate(command, args);
    if (!decision.allowed) {
      const error = new Error(`${decision.reason}: ${command}`);
      error.code = decision.code;
      throw error;
    }
    return decision;
  }
}
