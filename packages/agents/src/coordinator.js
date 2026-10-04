export function createCoordinator({ registry, events }) {
  return {
    async run(context) {
      const result = {};
      for (const role of ['planner', 'discovery', 'reviewer', 'verifier']) {
        const agent = registry.get(role);
        events.publish('agent.started', { role }, { taskId: context.taskId, agentId: agent.id });
        result[role] = await agent.handler({ ...context, result });
        events.publish('agent.completed', { role, summary: result[role].summary }, { taskId: context.taskId, agentId: agent.id });
      }
      return result;
    }
  };
}
