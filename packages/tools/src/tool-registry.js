export class ToolRegistry {
  #tools = new Map();

  register(tool) {
    if (!tool?.name) throw new Error('Tools require a name');
    this.#tools.set(tool.name, tool);
    return tool;
  }

  get(name) {
    const tool = this.#tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return tool;
  }

  list() {
    return [...this.#tools.keys()].sort();
  }
}
