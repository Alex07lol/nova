import { runProcess } from './process-runner.js';

export function createGitTool({ root, policy, events }) {
  async function readGit(args) {
    policy.assert('git.read');
    events?.publish('tool.started', { tool: 'git', args });
    const result = await runProcess('git', args, { cwd: root });
    if (result.code !== 0) {
      const error = new Error(result.stderr.trim() || `git exited with code ${result.code}`);
      error.code = 'GIT_FAILED';
      error.result = result;
      throw error;
    }
    events?.publish('tool.completed', { tool: 'git', args, code: result.code });
    return result;
  }

  return {
    name: 'git',
    async status() {
      const result = await readGit(['status', '--short', '--branch']);
      return { ...result, lines: result.stdout.split('\n').filter(Boolean) };
    },
    async diff({ staged = false } = {}) {
      const result = await readGit(['diff', ...(staged ? ['--cached'] : [])]);
      return { ...result, patch: result.stdout };
    }
  };
}
