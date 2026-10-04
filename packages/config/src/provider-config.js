import { MockProvider } from '../../providers/src/mock-provider.js';
import { OpenAICompatibleProvider } from '../../providers/src/openai-compatible-provider.js';

export function readProviderConfig(env = process.env) {
  const provider = env.NOVA_PROVIDER || 'mock';
  if (provider === 'mock') return { provider, model: 'mock-explorer' };
  if (provider === 'openai-compatible') {
    return { provider, baseUrl: env.NOVA_PROVIDER_URL, model: env.NOVA_MODEL || 'default', apiKey: env.NOVA_API_KEY };
  }
  throw new Error(`Unsupported NOVA_PROVIDER: ${provider}`);
}

export function createConfiguredProvider({ env = process.env, fetchImpl } = {}) {
  const config = readProviderConfig(env);
  if (config.provider === 'mock') return new MockProvider();
  return new OpenAICompatibleProvider({ ...config, fetchImpl });
}

export function redactProviderConfig(config) {
  const { apiKey: _apiKey, ...safe } = config;
  return safe;
}
