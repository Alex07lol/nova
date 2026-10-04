import { createId } from '../../shared/src/ids.js';
import { validateProvider } from '../../providers/src/provider.js';

const STATES = ['UNDERSTANDING', 'PLANNING', 'EXECUTING', 'OBSERVING', 'VERIFYING', 'REPLANNING', 'COMPLETE'];

export class AgentRuntime {
  constructor({ events, coordinator, provider, router, tools, sessionStore, verificationRunner, verificationChecks, verificationStore, maxSteps = 12 }) {
    this.events = events;
    this.coordinator = coordinator;
    this.provider = provider;
    this.router = router;
    this.tools = tools;
    this.sessionStore = sessionStore;
    this.verificationRunner = verificationRunner;
    this.verificationChecks = verificationChecks;
    this.verificationStore = verificationStore;
    this.maxSteps = maxSteps;
    validateProvider(provider);
  }

  async run(prompt, { sessionId, activeSkills = [] } = {}) {
    const taskId = createId('task');
    const session = this.sessionStore
      ? (sessionId ? await this.sessionStore.load(sessionId) : await this.sessionStore.create({ prompt, skills: activeSkills }))
      : null;
    const resolvedSessionId = session?.id || sessionId;
    const context = { taskId, prompt, state: 'UNDERSTANDING', tools: this.tools.list(), sessionId: resolvedSessionId };
    const unsubscribe = resolvedSessionId && this.sessionStore
      ? this.events.subscribe((event) => { void this.sessionStore.recordEvent(resolvedSessionId, event); })
      : () => {};
    this.events.publish('task.started', { prompt }, { taskId, sessionId: resolvedSessionId });
    let steps = 0;
    const transition = (state) => {
      if (!STATES.includes(state)) throw new Error(`Invalid runtime state: ${state}`);
      context.state = state;
      steps += 1;
      if (steps > this.maxSteps) throw new Error('Agent step limit exceeded');
      this.events.publish('task.state_changed', { state }, { taskId, sessionId: resolvedSessionId });
    };

    transition('PLANNING');
    const workspace = await this.tools.get('filesystem').inspect();
    transition('EXECUTING');
    const agents = await this.coordinator.run({ ...context, workspace });
    const complete = () => this.router
      ? this.router.complete({ prompt: `${prompt}\nFiles: ${workspace.files.join(', ')}` }, { capability: 'text' })
      : this.provider.complete({ prompt: `${prompt}\nFiles: ${workspace.files.join(', ')}` });
    let response;
    let verification = agents.verifier;
    let attempt = 0;
    do {
      transition('OBSERVING');
      response = await complete();
      transition('VERIFYING');
      verification = this.verificationRunner
        ? await this.verificationRunner.run([
          { id: 'workspace-inspection', run: async () => workspace.fileCount >= 0 },
          { id: 'model-response', run: async () => Boolean(response.text) },
          ...(this.verificationChecks ? await this.verificationChecks({ workspace, taskId }) : [])
        ])
        : agents.verifier;
      if (verification.passed !== false || attempt >= 1) break;
      attempt += 1;
      transition('REPLANNING');
      transition('EXECUTING');
    } while (attempt <= 1);
    transition('COMPLETE');
    const result = { taskId, sessionId: resolvedSessionId, state: context.state, workspace, agents, response, verification, replans: attempt };
    if (this.verificationStore && verification.results) await this.verificationStore.save(verification, { sessionId: resolvedSessionId, taskId });
    this.events.publish('task.completed', { summary: response.text }, { taskId, sessionId: resolvedSessionId });
    if (session && this.sessionStore) {
      session.status = 'complete';
      session.tasks.push({ taskId, prompt, status: verification.passed === false ? 'failed' : 'complete', verification });
      session.importantFindings.push(...(workspace.files || []).slice(0, 20));
      await this.sessionStore.save(session);
    }
    unsubscribe();
    return result;
  }
}
