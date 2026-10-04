import { createId } from '../../shared/src/ids.js';

export class EventBus {
  #listeners = new Set();
  #history = [];

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  publish(type, payload = {}, metadata = {}) {
    const event = {
      id: createId('event'),
      timestamp: new Date().toISOString(),
      type,
      ...metadata,
      payload
    };
    this.#history.push(event);
    for (const listener of this.#listeners) listener(event);
    return event;
  }

  history() {
    return [...this.#history];
  }
}
