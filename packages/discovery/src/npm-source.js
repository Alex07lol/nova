export class NpmSource {
  constructor({ fetchImpl = globalThis.fetch } = {}) { this.id = 'npm'; this.requiresNetwork = true; this.fetch = fetchImpl; }

  async search(requirement) {
    const response = await this.fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(requirement)}&size=10`, { headers: { Accept: 'application/json' } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(`npm search failed: ${response.status}`); error.code = 'NPM_SEARCH_FAILED'; throw error; }
    return (body.objects || []).map((entry) => ({
      id: entry.package?.name,
      name: entry.package?.name,
      description: entry.package?.description || '',
      url: entry.package?.links?.npm || null,
      license: entry.package?.license || 'unknown',
      updatedAt: entry.package?.date || null,
      source: this.id
    }));
  }
}
