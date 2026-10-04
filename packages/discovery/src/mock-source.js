export class MockDiscoverySource {
  constructor(candidates = []) { this.id = 'mock'; this.requiresNetwork = false; this.candidates = candidates; }
  async search() { return this.candidates; }
}
