import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

export function createTerminalApprovalResolver({ input = stdin, output = stdout } = {}) {
  return async ({ capability, details }) => {
    if (!input.isTTY || !output.isTTY) return { approved: false, scope: 'once' };
    const line = createInterface({ input, output });
    try {
      output.write(`\nNOVA requests ${capability}: ${details.command || 'action'}\n`);
      const answer = (await line.question('[Y] Allow once  [A] Allow for task  [D] Deny: ')).trim().toLowerCase();
      if (answer === 'y') return { approved: true, scope: 'once' };
      if (answer === 'a') return { approved: true, scope: 'task' };
      return { approved: false, scope: 'once' };
    } finally {
      line.close();
    }
  };
}
