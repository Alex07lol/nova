import { evaluateCandidate } from './candidate-evaluator.js';

function scoreCandidate(candidate, requirement) {
  let score = 0;
  const haystack = `${candidate.name} ${candidate.description || ''}`.toLowerCase();
  for (const term of requirement.toLowerCase().split(/\s+/).filter(Boolean)) if (haystack.includes(term)) score += 2;
  if (candidate.license) score += 1;
  if (candidate.updatedAt) score += 1;
  if (candidate.stars >= 100) score += 1;
  return score;
}

function normalizeCandidate(candidate, requirement) {
  return {
    id: candidate.id || candidate.url || candidate.name,
    name: candidate.name,
    description: candidate.description || '',
    url: candidate.url || null,
    source: candidate.source || 'unknown',
    license: candidate.license || 'unknown',
    stars: Number(candidate.stars || 0),
    updatedAt: candidate.updatedAt || null,
    untrusted: true,
    score: scoreCandidate(candidate, requirement)
  };
}

export class DiscoveryEngine {
  constructor({ sources = [], events, approval } = {}) {
    this.sources = sources;
    this.events = events;
    this.approval = approval;
  }

  async search(requirement, { limit = 10 } = {}) {
    if (!requirement?.trim()) throw new Error('Discovery requires a capability requirement');
    const results = [];
    for (const source of this.sources) {
      if (source.requiresNetwork !== false) {
        const permission = this.approval
          ? await this.approval.request('network', { source: source.id, requirement })
          : { approved: false };
        if (!permission.approved) {
          this.events?.publish('discovery.source_denied', { source: source.id, reason: 'network approval denied' });
          continue;
        }
      }
      this.events?.publish('discovery.source_started', { source: source.id, requirement });
      const candidates = await source.search(requirement);
      for (const candidate of candidates) results.push(normalizeCandidate({ ...candidate, source: candidate.source || source.id }, requirement));
      this.events?.publish('discovery.source_completed', { source: source.id, count: candidates.length });
    }
    const uniqueMap = new Map();
    for (const candidate of results) if (!uniqueMap.has(candidate.id)) uniqueMap.set(candidate.id, candidate);
    const unique = [...uniqueMap.values()];
    return unique.sort((a, b) => b.score - a.score || b.stars - a.stars).slice(0, limit);
  }

  recommend(candidates = []) {
    const eligible = candidates.map((candidate) => evaluateCandidate(candidate)).filter((candidate) => candidate.eligible);
    return eligible[0] || null;
  }

  evaluate(candidates = [], options) { return candidates.map((candidate) => evaluateCandidate(candidate, options)); }
}
