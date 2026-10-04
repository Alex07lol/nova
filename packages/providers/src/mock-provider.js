export class MockProvider {
  id = 'mock';
  models = [{ id: 'mock-explorer', capabilities: ['analysis', 'planning'] }];

  async authenticate() { return { authenticated: true, method: 'local-runtime' }; }

  async listModels() { return this.models; }

  getCapabilities() { return ['text', 'planning', 'analysis']; }

  async complete({ prompt }) {
    return {
      model: 'mock-explorer',
      text: `Mock analysis complete for: ${prompt}`,
      usage: { inputTokens: prompt.length, outputTokens: 8 }
    };
  }

  async healthCheck() { return { healthy: true, provider: this.id }; }
}
