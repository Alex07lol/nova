import { validateProvider } from '../../providers/src/provider.js';

export class ModelRouter {
  constructor({ providers = [], events } = {}) {
    if (!providers.length) throw new Error('ModelRouter requires at least one provider');
    providers.forEach(validateProvider);
    this.providers = providers;
    this.events = events;
  }

  candidates({ capability = 'text', preferred } = {}) {
    const ordered = preferred
      ? [...this.providers.filter((provider) => provider.id === preferred), ...this.providers.filter((provider) => provider.id !== preferred)]
      : [...this.providers];
    return ordered.filter((provider) => provider.getCapabilities().includes(capability) || capability === 'text');
  }

  async complete(request, { capability = 'text', preferred } = {}) {
    const candidates = this.candidates({ capability, preferred });
    if (!candidates.length) throw new Error(`No provider supports capability: ${capability}`);
    const failures = [];
    for (const provider of candidates) {
      this.events?.publish('model.route_selected', { provider: provider.id, capability });
      try {
        const response = await provider.complete(request);
        return { ...response, provider: provider.id, routed: true, failures };
      } catch (error) {
        failures.push({ provider: provider.id, code: error.code || 'PROVIDER_ERROR' });
        this.events?.publish('model.provider_failed', { provider: provider.id, code: error.code || 'PROVIDER_ERROR' });
      }
    }
    const error = new Error('All model providers failed');
    error.code = 'ALL_PROVIDERS_FAILED';
    error.failures = failures;
    throw error;
  }
}
