import { createId } from '../../shared/src/ids.js';

export class AgentRegistry {
  #agents = new Map();

  register(role, handler) {
    const agent = { id: createId(`agent_${role}`), role, handler };
    this.#agents.set(role, agent);
    return agent;
  }

  get(role) {
    const agent = this.#agents.get(role);
    if (!agent) throw new Error(`Unknown agent role: ${role}`);
    return agent;
  }

  list() { return [...this.#agents.values()]; }
}
