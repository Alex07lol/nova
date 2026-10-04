import { providerModel } from './provider.js';

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Provider endpoint must use HTTP or HTTPS');
  return url.toString().replace(/\/$/, '');
}

export class OpenAICompatibleProvider {
  constructor({ id = 'openai-compatible', baseUrl, apiKey, model = 'default', fetchImpl = globalThis.fetch } = {}) {
    if (!baseUrl) throw new Error('Provider endpoint is required');
    if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');
    this.id = id;
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.apiKey = apiKey;
    this.defaultModel = model;
    this.fetch = fetchImpl;
  }

  async authenticate() {
    return { authenticated: Boolean(this.apiKey), method: this.apiKey ? 'api-key' : 'none' };
  }

  getCapabilities() { return ['text', 'tool-calling', 'streaming']; }

  async #request(path, options = {}) {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    const response = await this.fetch(`${this.baseUrl}${path}`, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error?.message || `Provider request failed with HTTP ${response.status}`);
      error.code = 'PROVIDER_REQUEST_FAILED';
      error.status = response.status;
      throw error;
    }
    return body;
  }

  async listModels() {
    const body = await this.#request('/models');
    return (body.data || []).map((model) => providerModel({
      provider: this.id,
      id: model.id,
      displayName: model.id,
      capabilities: this.getCapabilities()
    }));
  }

  async complete({ prompt, model = this.defaultModel, system } = {}) {
    const messages = [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt }
    ];
    const body = await this.#request('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model, messages })
    });
    const choice = body.choices?.[0];
    return {
      model: body.model || model,
      text: choice?.message?.content || '',
      usage: body.usage || null,
      finishReason: choice?.finish_reason || null
    };
  }

  async healthCheck() {
    try {
      await this.listModels();
      return { healthy: true, provider: this.id };
    } catch (error) {
      return { healthy: false, provider: this.id, code: error.code || 'PROVIDER_UNAVAILABLE' };
    }
  }
}
