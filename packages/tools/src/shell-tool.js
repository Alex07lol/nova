import { runProcess } from './process-runner.js';
import { CommandPolicy } from '../../security/src/command-policy.js';

function validateCommand(command, args, commandPolicy) {
  if (!command || typeof command !== 'string' || command.includes('\0')) {
    throw new Error('Shell commands require a valid executable name');
  }
  if (command.includes('/') && command.startsWith('/')) {
    throw new Error('Absolute executable paths are not allowed');
  }
  commandPolicy.assert(command, args);
}

export function createShellTool({ root, policy, events, approval, commandPolicy = new CommandPolicy(), runner = runProcess }) {
  return {
    name: 'shell',
    async execute({ command, args = [], timeout, outputLimit } = {}) {
      validateCommand(command, args, commandPolicy);
      const permission = policy.evaluate('process.execute');
      const approvalResult = permission.allowed
        ? { approved: true, scope: 'policy', requestId: null }
        : await approval?.request('process.execute', { command, args }) || { approved: false, scope: 'once', requestId: null };
      policy.assert('process.execute', { approved: approvalResult.approved });
      events?.publish('tool.started', { tool: 'shell', command, args });
      try {
        const result = await runner(command, args, {
          cwd: root,
          timeout,
          outputLimit,
          env: { PATH: process.env.PATH, NODE_ENV: process.env.NODE_ENV }
        });
        events?.publish('tool.completed', { tool: 'shell', command, code: result.code });
        return result;
      } catch (error) {
        events?.publish('tool.failed', { tool: 'shell', command, code: error.code });
        throw error;
      }
    }
  };
}
