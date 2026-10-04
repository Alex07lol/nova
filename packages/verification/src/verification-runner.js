import { createId } from '../../shared/src/ids.js';

export class VerificationRunner {
  constructor({ events, maxChecks = 10 } = {}) { this.events = events; this.maxChecks = maxChecks; }

  async run(checks = []) {
    if (checks.length > this.maxChecks) throw new Error(`Verification check limit exceeded: ${this.maxChecks}`);
    const runId = createId('verification');
    const results = [];
    for (const check of checks) {
      const startedAt = Date.now();
      this.events?.publish('verification.started', { check: check.id }, { runId });
      try {
        const value = await check.run();
        const result = { id: check.id, passed: value !== false, durationMs: Date.now() - startedAt };
        results.push(result);
        this.events?.publish(result.passed ? 'verification.passed' : 'verification.failed', result, { runId });
      } catch (error) {
        const result = { id: check.id, passed: false, durationMs: Date.now() - startedAt, error: error.code || error.message };
        results.push(result);
        this.events?.publish('verification.failed', result, { runId });
      }
    }
    return { runId, passed: results.length > 0 && results.every((result) => result.passed), results };
  }
}
