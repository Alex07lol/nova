function parseCommand(command) {
  if (!command || /[;&|><`$()]/.test(command)) {
    const error = new Error('Project test command contains unsupported shell syntax');
    error.code = 'UNSAFE_TEST_COMMAND';
    throw error;
  }
  const parts = command.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) throw new Error('Project test command is empty');
  return { command: parts[0], args: parts.slice(1) };
}

export function createProjectChecks({ discovery, shell }) {
  return (discovery.commands || []).map((entry) => ({
    id: entry.id,
    run: async () => {
      const parsed = parseCommand(entry.command);
      const result = await shell.execute(parsed);
      return result.code === 0;
    }
  }));
}
