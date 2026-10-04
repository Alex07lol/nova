export function createTerminalRenderer({ output = console.log } = {}) {
  const render = (event) => {
    if (event.type === 'task.state_changed') output(`  ◉ ${event.payload.state.toLowerCase()}`);
    if (event.type === 'agent.started') output(`  ◌ ${event.payload.role} agent started`);
    if (event.type === 'agent.completed') output(`  ✓ ${event.payload.role} agent completed`);
    if (event.type === 'tool.failed') output(`  ! ${event.payload.tool} failed`);
  };

  return {
    attach(events) { return events.subscribe(render); },
    renderHeader({ root, skills }) {
      this.renderPanel('NOVA  ● READY', [
        ['workspace', root],
        ['skills', skills.join(', ') || 'none']
      ]);
    },
    renderPanel(title, rows) {
      output(`╭─ ${title} ─╮`);
      for (const [label, value] of rows) output(`│ ${label}: ${value}`);
      output('╰────────────╯');
    },
    renderResult(result) {
      this.renderPanel('SESSION', [
        ['id', result.sessionId],
        ['state', result.state],
        ['files', result.workspace.fileCount]
      ]);
      output(`\n${result.response.text}`);
    },
    renderVerification(result) {
      this.renderPanel('VERIFICATION', [
        ['run', result.runId],
        ['status', result.passed ? 'PASSED' : 'FAILED'],
        ['checks', result.results.length]
      ]);
      for (const check of result.results) {
        const detail = check.error ? ` (${check.error})` : '';
        output(`  ${check.passed ? '✓' : '✗'} ${check.id}${detail}`);
      }
    }
  };
}
