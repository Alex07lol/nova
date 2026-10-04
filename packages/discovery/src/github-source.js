export class GitHubSource {
  constructor({ token, fetchImpl = globalThis.fetch } = {}) {
    this.id = 'github';
    this.requiresNetwork = true;
    this.token = token;
    this.fetch = fetchImpl;
  }

  async search(requirement) {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'nova-agent' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const response = await this.fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(requirement)}&per_page=10`, { headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(`GitHub search failed: ${response.status}`); error.code = 'GITHUB_SEARCH_FAILED'; throw error; }
    return (body.items || []).map((item) => ({
      id: item.full_name,
      name: item.full_name,
      description: item.description || '',
      url: item.html_url,
      license: item.license?.spdx_id || 'unknown',
      stars: item.stargazers_count,
      updatedAt: item.updated_at,
      source: this.id
    }));
  }
}
