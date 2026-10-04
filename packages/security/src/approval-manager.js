import { createId } from '../../shared/src/ids.js';

export class ApprovalManager {
  constructor({ events, resolver = async () => false } = {}) {
    this.events = events;
    this.resolver = resolver;
    this.grants = new Set();
    this.history = [];
  }

  async request(capability, details = {}) {
    if (this.grants.has(capability)) return { approved: true, scope: 'task', requestId: null };
    const requestId = createId('approval');
    this.events?.publish('approval.requested', { capability, details }, { requestId });
    const response = await this.resolver({ requestId, capability, details });
    const approved = response === true || response?.approved === true;
    const scope = typeof response === 'object' && response.scope === 'task' ? 'task' : 'once';
    if (approved && scope === 'task') this.grants.add(capability);
    const result = { approved, scope, requestId, capability };
    this.history.push(result);
    this.events?.publish(approved ? 'approval.granted' : 'approval.denied', { capability, scope }, { requestId });
    return result;
  }

  list() { return [...this.history]; }
}
