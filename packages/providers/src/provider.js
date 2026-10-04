const REQUIRED_METHODS = ['listModels', 'getCapabilities', 'complete', 'healthCheck'];

export function validateProvider(provider) {
  for (const method of REQUIRED_METHODS) {
    if (typeof provider?.[method] !== 'function') {
      throw new Error(`Provider adapter is missing ${method}()`);
    }
  }
  if (!provider.id) throw new Error('Provider adapters require an id');
  return provider;
}

export function providerModel({ provider, id, displayName = id, capabilities = [] }) {
  return { provider, id, displayName, capabilities };
}
