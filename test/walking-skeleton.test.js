import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../packages/events/src/event-bus.js';
import { PermissionPolicy } from '../packages/security/src/policy.js';
import { SkillManager } from '../packages/skills/src/skill-manager.js';
import { createShellTool } from '../packages/tools/src/shell-tool.js';
import { createGitTool } from '../packages/tools/src/git-tool.js';
import { MockProvider } from '../packages/providers/src/mock-provider.js';
import { validateProvider } from '../packages/providers/src/provider.js';
import { OpenAICompatibleProvider } from '../packages/providers/src/openai-compatible-provider.js';
import { createConfiguredProvider, readProviderConfig, redactProviderConfig } from '../packages/config/src/provider-config.js';
import { AccountManager } from '../packages/config/src/account-manager.js';
import { VerificationStore } from '../packages/storage/src/verification-store.js';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { verifySkillSignature, classifySkillTrust } from '../packages/skills/src/manifest-security.js';
import { SkillSandbox } from '../packages/skills/src/skill-sandbox.js';
import { DiscoveryEngine } from '../packages/discovery/src/discovery-engine.js';
import { MockDiscoverySource } from '../packages/discovery/src/mock-source.js';
import { GitHubSource } from '../packages/discovery/src/github-source.js';
import { NpmSource } from '../packages/discovery/src/npm-source.js';
import { evaluateCandidate } from '../packages/discovery/src/candidate-evaluator.js';
import { InstallationGate } from '../packages/discovery/src/installation-gate.js';
import { PackageInstaller } from '../packages/discovery/src/package-installer.js';
import { attachJsonlSink } from '../packages/events/src/jsonl-sink.js';
import { ModelRouter } from '../packages/orchestrator/src/model-router.js';
import { createFilesystemMutationTool } from '../packages/tools/src/filesystem-mutation-tool.js';
import { VerificationRunner } from '../packages/verification/src/verification-runner.js';
import { createProjectChecks } from '../packages/verification/src/project-checks.js';
import { AgentRuntime } from '../packages/agent/src/runtime.js';
import { AgentRegistry } from '../packages/agents/src/agent-registry.js';
import { createCoordinator } from '../packages/agents/src/coordinator.js';
import { ToolRegistry } from '../packages/tools/src/tool-registry.js';
import { createFilesystemTool } from '../packages/tools/src/filesystem-tool.js';
import { discoverTests } from '../packages/context/src/project-test-discovery.js';
import { SessionStore } from '../packages/storage/src/session-store.js';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTerminalRenderer } from '../packages/ui/src/terminal-renderer.js';
import { ApprovalManager } from '../packages/security/src/approval-manager.js';
import { createTerminalApprovalResolver } from '../packages/ui/src/approval-prompt.js';
import { CommandPolicy } from '../packages/security/src/command-policy.js';
import { resolve } from 'node:path';

test('permission policy denies shell by default', () => {
  assert.equal(new PermissionPolicy().evaluate('shell').allowed, false);
});

test('event bus retains structured history', () => {
  const bus = new EventBus();
  bus.publish('test.started', { ok: true }, { taskId: 'task_1' });
  assert.equal(bus.history()[0].type, 'test.started');
  assert.equal(bus.history()[0].taskId, 'task_1');
});

test('built-in skills load from manifests', async () => {
  const manager = new SkillManager({ roots: [resolve('skills/builtin')] });
  const skills = await manager.load();
  assert.deepEqual(skills.map((skill) => skill.id), ['filesystem', 'project-explorer']);
});

test('shell tool requires process permission before execution', async () => {
  const shell = createShellTool({ root: process.cwd(), policy: new PermissionPolicy(), events: new EventBus() });
  await assert.rejects(() => shell.execute({ command: 'node', args: ['-e', 'process.stdout.write("unexpected")'] }), {
    code: 'PERMISSION_DENIED'
  });
});

test('approval manager grants a capability for one task', async () => {
  const events = new EventBus();
  const approval = new ApprovalManager({ events, resolver: async () => ({ approved: true, scope: 'task' }) });
  assert.equal((await approval.request('process.execute')).approved, true);
  assert.equal((await approval.request('process.execute')).requestId, null);
  assert.equal(events.history().filter((event) => event.type === 'approval.requested').length, 1);
});

test('shell tool can execute only after explicit approval', async () => {
  const policy = new PermissionPolicy();
  const approval = new ApprovalManager({ resolver: async () => ({ approved: true, scope: 'once' }) });
  const shell = createShellTool({
    root: process.cwd(),
    policy,
    approval,
    events: new EventBus(),
    runner: async () => ({ code: 0, signal: null, stdout: 'approved', stderr: '', truncated: false })
  });
  const result = await shell.execute({ command: 'node', args: ['-e', 'ignored'] });
  assert.equal(result.stdout, 'approved');
});

test('approval resolver denies non-interactive environments', async () => {
  const resolver = createTerminalApprovalResolver({
    input: { isTTY: false },
    output: { isTTY: false, write() {} }
  });
  assert.deepEqual(await resolver({ capability: 'process.execute', details: { command: 'git' } }), {
    approved: false,
    scope: 'once'
  });
});

test('command policy supports allowlists and denylists', () => {
  const policy = new CommandPolicy({ allowlist: ['git'], denylist: ['git-danger'] });
  assert.equal(policy.evaluate('git').allowed, true);
  assert.equal(policy.evaluate('node').code, 'COMMAND_NOT_ALLOWED');
  assert.equal(policy.evaluate('git-danger').code, 'DANGEROUS_COMMAND');
});

test('approval manager exposes task approval history', async () => {
  const approval = new ApprovalManager({ resolver: async () => ({ approved: false, scope: 'once' }) });
  await approval.request('network', { host: 'example.test' });
  assert.deepEqual(approval.list().map((entry) => entry.approved), [false]);
});

test('shell tool rejects dangerous commands before execution', async () => {
  const policy = new PermissionPolicy({ 'process.execute': true });
  const shell = createShellTool({ root: process.cwd(), policy, events: new EventBus() });
  await assert.rejects(() => shell.execute({ command: 'rm', args: ['-rf', 'tmp'] }), {
    code: 'DANGEROUS_COMMAND'
  });
});

test('git tool exposes read-only status and diff operations', async () => {
  const git = createGitTool({ root: process.cwd(), policy: new PermissionPolicy(), events: new EventBus() });
  const status = await git.status();
  const diff = await git.diff();
  assert.equal(Array.isArray(status.lines), true);
  assert.equal(typeof diff.patch, 'string');
});

test('provider adapter exposes the normalized contract', async () => {
  const provider = validateProvider(new MockProvider());
  assert.deepEqual(await provider.healthCheck(), { healthy: true, provider: 'mock' });
  assert.equal((await provider.listModels())[0].id, 'mock-explorer');
});

test('HTTP provider normalizes models and chat responses without exposing credentials', async () => {
  const requests = [];
  const provider = new OpenAICompatibleProvider({
    id: 'test-provider',
    baseUrl: 'https://provider.test/v1',
    apiKey: 'secret-test-key',
    model: 'test-model',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith('/models')) return { ok: true, status: 200, json: async () => ({ data: [{ id: 'test-model' }] }) };
      return { ok: true, status: 200, json: async () => ({ model: 'test-model', choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }], usage: { total_tokens: 3 } }) };
    }
  });
  validateProvider(provider);
  assert.equal((await provider.listModels())[0].id, 'test-model');
  const result = await provider.complete({ prompt: 'hi' });
  assert.equal(result.text, 'hello');
  assert.equal(requests[1].options.headers.Authorization, 'Bearer secret-test-key');
  assert.equal(JSON.stringify(result).includes('secret-test-key'), false);
});

test('HTTP provider reports failed health checks without throwing', async () => {
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.test',
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: { message: 'offline' } }) })
  });
  assert.deepEqual(await provider.healthCheck(), { healthy: false, provider: 'openai-compatible', code: 'PROVIDER_REQUEST_FAILED' });
});

test('provider config selects mock by default and redacts API keys', () => {
  assert.deepEqual(readProviderConfig({}), { provider: 'mock', model: 'mock-explorer' });
  assert.deepEqual(redactProviderConfig({ provider: 'openai-compatible', apiKey: 'secret', model: 'x' }), { provider: 'openai-compatible', model: 'x' });
  assert.equal(createConfiguredProvider({ env: {} }).id, 'mock');
});

test('account manager stores provider metadata but no credentials', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nova-account-'));
  try {
    const manager = new AccountManager({ path: join(root, 'accounts.json') });
    await manager.connect({ provider: 'test-provider', authMethod: 'environment' });
    const saved = await readFile(join(root, 'accounts.json'), 'utf8');
    assert.equal(saved.includes('apiKey'), false);
    assert.equal((await manager.list())[0].provider, 'test-provider');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('model router fails over to the next compatible provider', async () => {
  const events = new EventBus();
  const failing = {
    id: 'failing',
    getCapabilities: () => ['text'],
    listModels: async () => [],
    complete: async () => { const error = new Error('offline'); error.code = 'OFFLINE'; throw error; },
    healthCheck: async () => ({ healthy: false })
  };
  const backup = {
    id: 'backup',
    getCapabilities: () => ['text'],
    listModels: async () => [],
    complete: async () => ({ text: 'fallback result', model: 'backup-model' }),
    healthCheck: async () => ({ healthy: true })
  };
  const result = await new ModelRouter({ providers: [failing, backup], events }).complete({ prompt: 'hello' });
  assert.equal(result.provider, 'backup');
  assert.deepEqual(result.failures, [{ provider: 'failing', code: 'OFFLINE' }]);
  assert.equal(events.history().some((event) => event.type === 'model.provider_failed'), true);
});

test('model router rejects unsupported capabilities', async () => {
  const provider = new MockProvider();
  await assert.rejects(() => new ModelRouter({ providers: [provider] }).complete({ prompt: 'x' }, { capability: 'vision' }), /No provider supports/);
});

test('filesystem mutation tool requires approval and performs exact edits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nova-edit-'));
  const requests = [];
  try {
    const policy = new PermissionPolicy();
    const approval = new ApprovalManager({ resolver: async (request) => { requests.push(request); return { approved: true, scope: 'once' }; } });
    const tool = createFilesystemMutationTool({ root, policy, approval, events: new EventBus() });
    await tool.write({ path: 'src/example.txt', content: 'before\nvalue\n' });
    const result = await tool.edit({ path: 'src/example.txt', find: 'value', replace: 'updated' });
    assert.equal(result.changed, true);
    assert.equal(result.after, 'before\nupdated\n');
    assert.equal(requests[1].details.diff.includes('-value'), true);
    assert.equal(requests[1].details.diff.includes('+updated'), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('verification runner records passing and failing evidence', async () => {
  const events = new EventBus();
  const runner = new VerificationRunner({ events });
  const result = await runner.run([
    { id: 'tests', run: async () => true },
    { id: 'lint', run: async () => { const error = new Error('lint failed'); error.code = 'LINT_FAILED'; throw error; } }
  ]);
  assert.equal(result.passed, false);
  assert.deepEqual(result.results.map((item) => item.passed), [true, false]);
  assert.equal(events.history().filter((event) => event.type === 'verification.failed').length, 1);
});

test('runtime completes through integrated verification', async () => {
  const events = new EventBus();
  const registry = new AgentRegistry();
  for (const role of ['planner', 'discovery', 'reviewer', 'verifier']) registry.register(role, async () => ({ summary: role, passed: true }));
  const tools = new ToolRegistry();
  tools.register(createFilesystemTool({ root: process.cwd(), policy: new PermissionPolicy() }));
  const runtime = new AgentRuntime({
    events,
    coordinator: createCoordinator({ registry, events }),
    provider: new MockProvider(),
    tools,
    verificationRunner: new VerificationRunner({ events })
  });
  const result = await runtime.run('verify this');
  assert.equal(result.verification.passed, true);
  assert.equal(result.replans, 0);
  assert.equal(events.history().some((event) => event.type === 'verification.passed'), true);
});

test('test discovery identifies package test commands and test directories', async () => {
  const result = await discoverTests(process.cwd());
  assert.equal(result.commands.some((command) => command.id === 'package-test'), true);
  assert.equal(result.source.includes('test'), true);
});

test('runtime replans once after a verification failure', async () => {
  const events = new EventBus();
  const registry = new AgentRegistry();
  for (const role of ['planner', 'discovery', 'reviewer', 'verifier']) registry.register(role, async () => ({ summary: role, passed: true }));
  const tools = new ToolRegistry();
  tools.register(createFilesystemTool({ root: process.cwd(), policy: new PermissionPolicy() }));
  let verificationRuns = 0;
  const verificationRunner = {
    run: async () => {
      verificationRuns += 1;
      return { runId: `verification_${verificationRuns}`, passed: verificationRuns > 1, results: [{ id: 'synthetic', passed: verificationRuns > 1 }] };
    }
  };
  const runtime = new AgentRuntime({
    events,
    coordinator: createCoordinator({ registry, events }),
    provider: new MockProvider(),
    tools,
    verificationRunner
  });
  const result = await runtime.run('recover from a failed check');
  assert.equal(result.replans, 1);
  assert.equal(verificationRuns, 2);
  assert.equal(events.history().filter((event) => event.payload.state === 'REPLANNING').length, 1);
});

test('discovered project checks run through the approved shell tool', async () => {
  const calls = [];
  const checks = createProjectChecks({
    discovery: { commands: [{ id: 'package-test', command: 'npm test' }] },
    shell: { execute: async (request) => { calls.push(request); return { code: 0 }; } }
  });
  assert.equal(await checks[0].run(), true);
  assert.deepEqual(calls, [{ command: 'npm', args: ['test'] }]);
});

test('discovered project checks reject shell metacharacters', () => {
  const checks = createProjectChecks({
    discovery: { commands: [{ id: 'unsafe', command: 'npm test && rm -rf .' }] },
    shell: { execute: async () => ({ code: 0 }) }
  });
  return assert.rejects(() => checks[0].run(), { code: 'UNSAFE_TEST_COMMAND' });
});

test('terminal renderer summarizes verification failures', () => {
  const lines = [];
  const renderer = createTerminalRenderer({ output: (line) => lines.push(line) });
  renderer.renderVerification({
    runId: 'verification_1',
    passed: false,
    results: [{ id: 'package-test', passed: false, error: 'PERMISSION_DENIED' }]
  });
  assert.equal(lines.some((line) => line.includes('FAILED')), true);
  assert.equal(lines.some((line) => line.includes('PERMISSION_DENIED')), true);
});

test('verification store persists redacted receipts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nova-receipts-'));
  try {
    const store = new VerificationStore({ root });
    const saved = await store.save({ runId: 'verification_1', passed: false, results: [{ id: 'tests', passed: false, durationMs: 4, error: 'FAILED' }] }, { sessionId: 'session_1', taskId: 'task_1' });
    assert.equal(saved.passed, false);
    assert.equal((await store.get('verification_1')).results[0].error, 'FAILED');
    assert.equal((await store.list()).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('JSONL event sink serializes structured events', () => {
  const lines = [];
  const events = new EventBus();
  attachJsonlSink(events, { output: (line) => lines.push(line) });
  events.publish('task.started', { prompt: 'hello' }, { taskId: 'task_1' });
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.type, 'task.started');
  assert.equal(parsed.taskId, 'task_1');
});

test('package metadata exposes the NOVA executable and release files', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(packageJson.bin.nova, 'apps/cli/src/main.js');
  assert.equal(packageJson.files.includes('packages'), true);
  assert.equal(packageJson.files.includes('LICENSE'), true);
  assert.equal(packageJson.engines.node, '>=20');
});

test('release smoke-check script and CI workflow are present', async () => {
  await access('scripts/check-release.mjs');
  await access('.github/workflows/ci.yml');
});

test('skill manager supports local install and enable/disable lifecycle', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nova-skills-'));
  const source = join(root, 'source');
  const installed = join(root, 'installed');
  try {
    await (await import('node:fs/promises')).mkdir(source, { recursive: true });
    await (await import('node:fs/promises')).writeFile(join(source, 'skill.json'), JSON.stringify({ id: 'local-demo', name: 'Local Demo', version: '1.0.0', description: 'test', permissions: [], tools: [] }));
    const manager = new SkillManager({ roots: [installed], statePath: join(root, 'state.json') });
    const manifest = await manager.install(source, installed);
    assert.equal(manifest.id, 'local-demo');
    await manager.load();
    assert.equal((await manager.setEnabled('local-demo', false)).enabled, false);
    assert.equal((await manager.setEnabled('local-demo', true)).enabled, true);
    await manager.remove('local-demo', installed);
    assert.equal(manager.get('local-demo'), undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('skill manager reports integrity and missing dependencies', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nova-skill-deps-'));
  try {
    await (await import('node:fs/promises')).mkdir(join(root, 'skills', 'dependent'), { recursive: true });
    await (await import('node:fs/promises')).writeFile(join(root, 'skills', 'dependent', 'skill.json'), JSON.stringify({ id: 'dependent', name: 'Dependent', version: '1.0.0', description: 'test', permissions: [], tools: [], dependencies: ['missing'] }));
    const manager = new SkillManager({ roots: [join(root, 'skills')] });
    const [skill] = await manager.load();
    assert.equal(skill.available, false);
    assert.deepEqual(skill.missingDependencies, ['missing']);
    const installed = await manager.install(join(root, 'skills', 'dependent'), join(root, 'installed'));
    assert.equal(installed.integrity.length, 64);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('skill manifest security verifies signed skills and flags unsigned community skills', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const manifest = { id: 'signed', name: 'Signed', version: '1.0.0', description: 'test', permissions: [], tools: [], publicKey: publicKey.export({ type: 'spki', format: 'pem' }) };
  const signer = createSign('SHA256');
  const unsigned = JSON.stringify(Object.keys(manifest).sort().reduce((result, key) => ({ ...result, [key]: manifest[key] }), {}));
  signer.update(unsigned);
  signer.end();
  manifest.signature = signer.sign(privateKey).toString('base64');
  assert.equal(verifySkillSignature(manifest), true);
  assert.equal(classifySkillTrust(manifest, '/tmp/community').trustLevel, 'signed');
  assert.equal(classifySkillTrust({ ...manifest, signature: undefined }, '/tmp/community').activationRequiresApproval, true);
});

test('skill sandbox requires trust approval and enforces declared capabilities', async () => {
  const skill = { id: 'community', permissions: ['filesystem.read'], activationRequiresApproval: true };
  assert.throws(() => new SkillSandbox({ skill }), { code: 'SKILL_APPROVAL_REQUIRED' });
  const sandbox = new SkillSandbox({ skill, approved: true });
  assert.equal(await sandbox.run('filesystem.read', async () => 'ok'), 'ok');
  await assert.rejects(() => sandbox.run('network', async () => 'nope'), { code: 'SKILL_CAPABILITY_UNDECLARED' });
});

test('discovery engine normalizes, scores, deduplicates, and flags external candidates', async () => {
  const engine = new DiscoveryEngine({ sources: [new MockDiscoverySource([
    { id: 'one', name: 'PDF Toolkit', description: 'PDF generation', license: 'MIT', stars: 200, updatedAt: '2026-01-01' },
    { id: 'one', name: 'Duplicate', license: 'MIT', stars: 1 },
    { id: 'two', name: 'Unknown Tool', description: 'unrelated' }
  ])] });
  const candidates = await engine.search('PDF generation');
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].id, 'one');
  assert.equal(candidates[0].untrusted, true);
  assert.equal(engine.recommend(candidates).id, 'one');
});

test('GitHub discovery adapter normalizes repository metadata', async () => {
  let request;
  const source = new GitHubSource({ token: 'secret', fetchImpl: async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ items: [{ full_name: 'acme/pdf', description: 'PDF generation', html_url: 'https://github.test/acme/pdf', license: { spdx_id: 'MIT' }, stargazers_count: 5, updated_at: '2026-01-01' }] }) };
  } });
  const [candidate] = await source.search('PDF generation');
  assert.equal(candidate.license, 'MIT');
  assert.equal(request.options.headers.Authorization, 'Bearer secret');
  assert.equal(JSON.stringify(candidate).includes('secret'), false);
});

test('npm discovery adapter normalizes package metadata', async () => {
  const source = new NpmSource({ fetchImpl: async () => ({ ok: true, json: async () => ({ objects: [{ package: { name: 'pdf-kit', description: 'PDF generation', license: 'MIT', links: { npm: 'https://npm.test/pdf-kit' } } }] }) }) });
  const [candidate] = await source.search('PDF generation');
  assert.equal(candidate.name, 'pdf-kit');
  assert.equal(candidate.source, 'npm');
});

test('discovery engine requires network approval and skips denied sources', async () => {
  const events = new EventBus();
  const source = new MockDiscoverySource([{ id: 'blocked', name: 'Blocked', license: 'MIT' }]);
  source.requiresNetwork = true;
  const discovery = new DiscoveryEngine({
    events,
    approval: new ApprovalManager({ resolver: async () => false }),
    sources: [source]
  });
  assert.deepEqual(await discovery.search('anything'), []);
  assert.equal(events.history().some((event) => event.type === 'discovery.source_denied'), true);
});

test('discovery engine searches approved sources', async () => {
  const discovery = new DiscoveryEngine({
    approval: new ApprovalManager({ resolver: async () => ({ approved: true, scope: 'task' }) }),
    sources: [new MockDiscoverySource([{ id: 'approved', name: 'Approved Tool', license: 'MIT' }])]
  });
  assert.equal((await discovery.search('Approved')).length, 1);
});

test('candidate evaluation exposes license and maintenance evidence', () => {
  const evaluated = evaluateCandidate({ name: 'tool', license: 'MIT', updatedAt: '2026-01-01', untrusted: true });
  assert.equal(evaluated.eligible, true);
  assert.equal(evaluated.evidence.licenseAllowed, true);
});

test('installation gate requires explicit dependency approval', async () => {
  const candidate = { name: 'pdf-kit', source: 'npm', url: 'https://npm.test/pdf-kit' };
  const denied = new InstallationGate({ approval: new ApprovalManager({ resolver: async () => false }) });
  await assert.rejects(() => denied.request(candidate), { code: 'INSTALLATION_DENIED' });
  const allowed = new InstallationGate({ approval: new ApprovalManager({ resolver: async () => ({ approved: true, scope: 'once' }) }) });
  assert.equal((await allowed.request(candidate)).approved, true);
});

test('package installer gates, invokes, and verifies npm installation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nova-package-install-'));
  try {
    await (await import('node:fs/promises')).writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { 'pdf-kit': '^1.0.0' } }));
    const calls = [];
    const installer = new PackageInstaller({
      root,
      gate: new InstallationGate({ approval: new ApprovalManager({ resolver: async () => ({ approved: true, scope: 'once' }) }) }),
      shell: { execute: async (request) => { calls.push(request); return { code: 0 }; } }
    });
    const result = await installer.install({ name: 'pdf-kit', source: 'npm' });
    assert.equal(result.installed, true);
    assert.deepEqual(calls, [{ command: 'npm', args: ['install', 'pdf-kit'] }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('filesystem mutation tool rejects paths outside workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nova-edit-path-'));
  try {
    const tool = createFilesystemMutationTool({
      root,
      policy: new PermissionPolicy({ 'filesystem.write': true }),
      events: new EventBus()
    });
    await assert.rejects(() => tool.write({ path: '../outside.txt', content: 'blocked' }), { code: 'PATH_OUTSIDE_WORKSPACE' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('session store persists durable task metadata without secrets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nova-session-'));
  try {
    const store = new SessionStore({ root });
    const created = await store.create({ prompt: 'inspect', skills: ['filesystem'] });
    created.tasks.push({ taskId: 'task_1', status: 'complete' });
    await store.save(created);
    await store.recordEvent(created.id, { type: 'task.completed', payload: { ok: true } });
    const loaded = await store.load(created.id);
    assert.equal(loaded.tasks[0].status, 'complete');
    assert.equal((await readFile(join(root, created.id, 'events.jsonl'), 'utf8')).includes('task.completed'), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('session store lists sessions newest first', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nova-session-list-'));
  try {
    const store = new SessionStore({ root });
    await store.create({ prompt: 'first' });
    const second = await store.create({ prompt: 'second' });
    const sessions = await store.list();
    assert.equal(sessions.length, 2);
    assert.equal(sessions[0].id, second.id);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('terminal renderer translates lifecycle events into concise output', () => {
  const lines = [];
  const renderer = createTerminalRenderer({ output: (line) => lines.push(line) });
  const events = new EventBus();
  renderer.attach(events);
  events.publish('task.state_changed', { state: 'PLANNING' });
  events.publish('agent.completed', { role: 'reviewer' });
  assert.deepEqual(lines, ['  ◉ planning', '  ✓ reviewer agent completed']);
});
