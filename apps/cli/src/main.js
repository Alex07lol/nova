#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { EventBus } from '../../../packages/events/src/event-bus.js';
import { attachJsonlSink } from '../../../packages/events/src/jsonl-sink.js';
import { PermissionPolicy } from '../../../packages/security/src/policy.js';
import { ApprovalManager } from '../../../packages/security/src/approval-manager.js';
import { CommandPolicy } from '../../../packages/security/src/command-policy.js';
import { createFilesystemTool } from '../../../packages/tools/src/filesystem-tool.js';
import { createFilesystemMutationTool } from '../../../packages/tools/src/filesystem-mutation-tool.js';
import { createShellTool } from '../../../packages/tools/src/shell-tool.js';
import { createGitTool } from '../../../packages/tools/src/git-tool.js';
import { ToolRegistry } from '../../../packages/tools/src/tool-registry.js';
import { createConfiguredProvider } from '../../../packages/config/src/provider-config.js';
import { SessionStore } from '../../../packages/storage/src/session-store.js';
import { VerificationStore } from '../../../packages/storage/src/verification-store.js';
import { SkillManager } from '../../../packages/skills/src/skill-manager.js';
import { AgentRegistry } from '../../../packages/agents/src/agent-registry.js';
import { createCoordinator } from '../../../packages/agents/src/coordinator.js';
import { AgentRuntime } from '../../../packages/agent/src/runtime.js';
import { ModelRouter } from '../../../packages/orchestrator/src/model-router.js';
import { VerificationRunner } from '../../../packages/verification/src/verification-runner.js';
import { createProjectChecks } from '../../../packages/verification/src/project-checks.js';
import { DiscoveryEngine } from '../../../packages/discovery/src/discovery-engine.js';
import { GitHubSource } from '../../../packages/discovery/src/github-source.js';
import { NpmSource } from '../../../packages/discovery/src/npm-source.js';
import { createTerminalRenderer } from '../../../packages/ui/src/terminal-renderer.js';
import { createTerminalApprovalResolver } from '../../../packages/ui/src/approval-prompt.js';

const root = resolve(process.cwd());
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const jsonEvents = args.includes('--json-events');
const commandArgs = args.filter((arg) => arg !== '--json' && arg !== '--json-events');
const ciMode = commandArgs[0] === 'ci';
const events = new EventBus();
const sessionStore = new SessionStore({ root: resolve(root, '.nova/sessions') });
const verificationStore = new VerificationStore({ root: resolve(root, '.nova/verifications') });
const renderer = createTerminalRenderer();
if (jsonEvents) attachJsonlSink(events);
else if (!jsonOutput) renderer.attach(events);

const policy = new PermissionPolicy({ 'process.execute': ciMode && process.env.NOVA_CI_ALLOW_EXECUTION === '1' });
const approval = new ApprovalManager({ events, resolver: createTerminalApprovalResolver() });
const tools = new ToolRegistry();
tools.register(createFilesystemTool({ root, policy }));
tools.register(createFilesystemMutationTool({ root, policy, approval, events }));
tools.register(createShellTool({ root, policy, events, approval, commandPolicy: new CommandPolicy({ allowlist: ['git', 'node', 'npm'] }) }));
tools.register(createGitTool({ root, policy, events }));
const localSkillsRoot = resolve(root, '.nova/skills');
const skillManager = new SkillManager({ roots: [resolve(here, '../../../skills/builtin'), localSkillsRoot], statePath: resolve(root, '.nova/skills-state.json') });
const skills = await skillManager.load();
if (commandArgs[0] === 'sessions') {
  const sessions = await sessionStore.list();
  if (!sessions.length) console.log('No NOVA sessions found.');
  for (const session of sessions) console.log(`${session.id}  ${session.status}  ${session.goal || '(no goal)'}`);
  process.exit(0);
}
if (commandArgs[0] === 'skills') {
  const action = commandArgs[1] || 'list';
  if (action === 'install' && commandArgs[2]) {
    const installed = await skillManager.install(resolve(root, commandArgs[2]), localSkillsRoot);
    console.log(`Installed skill ${installed.id} v${installed.version}`);
    process.exit(0);
  }
  if (action === 'enable' || action === 'disable') {
    if (!commandArgs[2]) { console.error(`Usage: nova skills ${action} <skill-id>`); process.exitCode = 2; process.exit(); }
    const skill = await skillManager.setEnabled(commandArgs[2], action === 'enable');
    console.log(`${action === 'enable' ? 'Enabled' : 'Disabled'} skill ${skill.id}`);
    process.exit(0);
  }
  if (action === 'remove' && commandArgs[2]) {
    await skillManager.remove(commandArgs[2], localSkillsRoot);
    console.log(`Removed local skill ${commandArgs[2]}`);
    process.exit(0);
  }
  if (action === 'list') {
    if (jsonOutput) console.log(JSON.stringify(skills));
    else for (const skill of skills) console.log(`${skill.id}  v${skill.version}  ${skill.description}`);
    process.exit(0);
  }
  if (action === 'inspect' && commandArgs[2]) {
    const skill = skillManager.get(commandArgs[2]);
    if (!skill) { console.error(`Skill not found: ${commandArgs[2]}`); process.exit(1); }
    if (jsonOutput) console.log(JSON.stringify(skill));
    else {
      renderer.renderPanel(`SKILL ${skill.id}`, [
        ['version', skill.version],
        ['trust', skill.trustLevel],
        ['approval', skill.activationRequiresApproval ? 'required' : 'not required'],
        ['permissions', skill.permissions.join(', ') || 'none'],
        ['tools', skill.tools.join(', ') || 'none']
      ]);
      console.log(skill.description);
    }
    process.exit(0);
  }
  console.error('Usage: nova skills list | inspect <skill-id> | install <path> | enable <id> | disable <id> | remove <id>');
  process.exitCode = 2;
  process.exit();
}
if (commandArgs[0] === 'discover') {
  const requirement = commandArgs.slice(1).join(' ').trim();
  if (!requirement) { console.error('Usage: nova discover <capability requirement>'); process.exitCode = 2; process.exit(); }
  const discovery = new DiscoveryEngine({
    events,
    approval,
    sources: [new GitHubSource({ token: process.env.GITHUB_TOKEN }), new NpmSource()]
  });
  const candidates = await discovery.search(requirement);
  const recommendation = discovery.recommend(candidates);
  if (jsonOutput) console.log(JSON.stringify({ requirement, candidates, recommendation }));
  else {
    renderer.renderPanel('DISCOVERY', [['requirement', requirement], ['candidates', candidates.length], ['recommendation', recommendation?.name || 'none']]);
    for (const candidate of candidates) console.log(`  ${candidate.score}  ${candidate.name}  ${candidate.license}  ${candidate.url || ''}`);
  }
  process.exit(0);
}
if (commandArgs[0] === 'verify' || commandArgs[0] === 'ci') {
  const workspace = await tools.get('filesystem').inspect();
  const verification = await new VerificationRunner({ events }).run(createProjectChecks({ discovery: workspace.tests, shell: tools.get('shell') }));
  await verificationStore.save(verification);
  if (jsonOutput) console.log(JSON.stringify(verification));
  else renderer.renderVerification(verification);
  process.exitCode = verification.passed ? 0 : 1;
  process.exit();
}
if (commandArgs[0] === 'verification' || commandArgs[0] === 'verifications') {
  const action = commandArgs[1] || 'list';
  if (action === 'list') {
    const receipts = await verificationStore.list();
    if (jsonOutput) console.log(JSON.stringify(receipts));
    else {
      if (!receipts.length) console.log('No verification receipts found.');
      for (const receipt of receipts) console.log(`${receipt.runId}  ${receipt.passed ? 'PASSED' : 'FAILED'}  ${receipt.createdAt}`);
    }
    process.exit(0);
  }
  if (action === 'inspect' && commandArgs[2]) {
    const receipt = await verificationStore.get(commandArgs[2]);
    if (jsonOutput) console.log(JSON.stringify(receipt));
    else renderer.renderVerification(receipt);
    process.exit(receipt.passed ? 0 : 1);
  }
  console.error('Usage: nova verification list | nova verification inspect <run-id>');
  process.exitCode = 2;
  process.exit();
}
const isResume = commandArgs[0] === 'resume';
const sessionId = isResume ? commandArgs[1] : undefined;
if (isResume && !sessionId) {
  console.error('Usage: nova resume <session-id> [prompt]');
  process.exitCode = 2;
  process.exit();
}
const prompt = (isResume ? commandArgs.slice(2) : commandArgs).join(' ') || 'Read this project and explain its architecture.';
const registry = new AgentRegistry();
registry.register('planner', async ({ prompt: task }) => ({ summary: `Plan created for ${task}`, steps: ['inspect workspace', 'analyze files', 'verify result'] }));
registry.register('discovery', async ({ workspace }) => ({ summary: `Workspace contains ${workspace.fileCount} top-level files`, files: workspace.files }));
registry.register('reviewer', async ({ workspace }) => ({ summary: `Review prepared for ${workspace.fileCount} files` }));
registry.register('verifier', async ({ workspace }) => ({ summary: `Verified workspace inspection (${workspace.fileCount} files)`, passed: true }));
const provider = createConfiguredProvider();
const runtime = new AgentRuntime({ events, coordinator: createCoordinator({ registry, events }), provider, router: new ModelRouter({ providers: [provider], events }), tools, sessionStore, verificationStore, verificationRunner: new VerificationRunner({ events }) });

if (!jsonOutput && !jsonEvents) {
  renderer.renderHeader({ root, skills: skills.map((skill) => skill.id) });
  console.log(`> ${prompt}`);
}
const result = await runtime.run(prompt, { sessionId, activeSkills: skills.map((skill) => skill.id) });
if (jsonOutput || jsonEvents) console.log(JSON.stringify(result));
else renderer.renderResult(result);
