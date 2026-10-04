//! Team facade — the high-level API used by the CLI and desktop orchestrator.
//!
//! Each high-level operation both mutates the underlying store AND appends a
//! structured event, so the activity feed and any watchers stay in sync.

import * as stateModule from './state.js';
import * as tasksModule from './tasks.js';
import * as messagesModule from './messages.js';
import * as contractsModule from './contracts.js';
import * as decisionsModule from './decisions.js';
import * as eventsModule from './events.js';
import * as worktreesModule from './worktrees.js';

export function createTeam(root, options = {}) {
  const actor = options.actor || 'orchestrator';

  /** Append an event, tagging the current actor. */
  function log(type, payload = {}, summary) {
    return eventsModule.appendEvent(root, type, actor, payload, summary);
  }

  return {
    // -- project state ------------------------------------------------------
    async init(name) {
      const state = await stateModule.init(root, name);
      log('PROJECT_INITIALIZED', { name }, `Initialized .ai-team protocol for "${name}"`);
      return state;
    },
    async load() {
      return stateModule.loadState(root);
    },
    async save(state) {
      return stateModule.saveState(root, state);
    },
    async objective() {
      return stateModule.readObjective(root);
    },
    async setObjective(content) {
      await stateModule.writeObjective(root, content);
      log('OBJECTIVE_UPDATED', {}, 'Updated the project objective');
    },

    // -- tasks --------------------------------------------------------------
    async listTasks() {
      return tasksModule.listTasks(root);
    },
    async getTask(id) {
      return tasksModule.getTask(root, id);
    },
    async createTask(fields) {
      const task = await tasksModule.createTask(root, fields);
      log('TASK_CREATED', { taskId: task.id, title: task.title, assignee: task.assignee }, `Created ${task.id}: ${task.title}`);
      return task;
    },
    async updateTask(id, fields) {
      const before = await tasksModule.getTask(root, id);
      const task = await tasksModule.updateTask(root, id, fields);
      if (before && before.status !== task.status) {
        log(`TASK_${task.status.toUpperCase()}`, { taskId: id, from: before.status, to: task.status }, `${id}: ${before.status} → ${task.status}`);
      }
      return task;
    },
    async completeTask(id) {
      const task = await tasksModule.completeTask(root, id);
      log('TASK_COMPLETED', { taskId: id, title: task.title }, `Completed ${id}: ${task.title}`);
      return task;
    },
    async readyTasks() {
      return tasksModule.readyTasks(root);
    },

    // -- messages -----------------------------------------------------------
    async listMessages() {
      return messagesModule.listMessages(root);
    },
    async inbox(workerId) {
      return messagesModule.inbox(root, workerId);
    },
    async sendMessage(fields) {
      const msg = await messagesModule.sendMessage(root, { ...fields, from: fields.from || actor });
      log('MESSAGE_SENT', { messageId: msg.id, to: msg.to, type: msg.type }, `Sent a ${msg.type} to ${msg.to}`);
      return msg;
    },
    async markRead(id) {
      return messagesModule.markRead(root, id);
    },

    // -- contracts ----------------------------------------------------------
    async listContracts() {
      return contractsModule.listContracts(root);
    },
    async publishContract(name, content, ext) {
      const result = await contractsModule.publishContract(root, name, content, ext);
      log('CONTRACT_CHANGED', { contract: name }, `Published contract "${name}"`);
      return result;
    },

    // -- decisions ----------------------------------------------------------
    async recordDecision(title, body) {
      return decisionsModule.recordDecision(root, title, body, actor);
    },

    // -- events -------------------------------------------------------------
    emit(type, payload = {}) {
      return log(type, payload);
    },
    async recentEvents(limit) {
      return eventsModule.recentEvents(root, limit);
    },

    // -- task analysis ------------------------------------------------------
    sortedByDependency(tasks) {
      return tasksModule.sortedByDependency(tasks);
    },
    blockersOf(tasks, id) {
      return tasksModule.blockersOf(tasks, id);
    },

    // -- git worktrees (spec §17) ------------------------------------------
    createWorktree(workerId, branchName) {
      return worktreesModule.createWorktree(root, workerId, branchName);
    },
    removeWorktree(workerId) {
      return worktreesModule.removeWorktree(root, workerId);
    },
    listWorktrees() {
      return worktreesModule.listWorktrees(root);
    },
  };
}