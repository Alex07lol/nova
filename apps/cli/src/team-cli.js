#!/usr/bin/env node
/**
 * The `team` CLI companion (spec §13/§34).
 *
 * Used by external AI coding terminals and users to interact with the
 * `.ai-team` shared protocol directory in the current project.
 */

import { resolve } from 'node:path';
import { createTeam } from '../../../packages/team-protocol/src/team.js';

const root = resolve(process.cwd());
const args = process.argv.slice(2);
const command = args[0];
const sub = args[1];
const rest = args.slice(2);

const ACTOR = process.env.TEAM_ACTOR || 'cli-user';
const team = createTeam(root, { actor: ACTOR });

async function main() {
  try {
    if (!command || command === 'help' || command === '--help') {
      printHelp();
      process.exit(0);
    }

    if (command === 'init') {
      const name = sub || 'project';
      const state = await team.init(name);
      console.log(`Initialized .ai-team protocol for "${state.project.name}"`);
      process.exit(0);
    }

    if (command === 'status' || command === 'info') {
      const state = await team.load().catch(() => null);
      if (!state) {
        console.error('Project not initialized. Run: team init');
        process.exit(1);
      }
      const tasks = await team.listTasks();
      const objective = await team.objective();
      console.log(`Project:     ${state.project.name}`);
      console.log(`Root:        ${state.project.path}`);
      console.log(`Lead:        ${state.leadId || 'none'}`);
      console.log(`Workers:     ${state.workers?.length || 0}`);
      console.log(`Tasks:       ${tasks.filter(t => t.status === 'completed').length}/${tasks.length} completed`);
      console.log(`Objective:   ${objective.trim().split('\n')[0] || '(none)'}`);
      process.exit(0);
    }

    if (command === 'task') {
      if (sub === 'list') {
        const tasks = await team.listTasks();
        if (!tasks.length) {
          console.log('No tasks found.');
        } else {
          for (const t of tasks) {
            const assignee = t.assignee ? ` [${t.assignee}]` : '';
            console.log(`${t.id.padEnd(8)}  ${t.status.padEnd(10)}  ${t.priority.padEnd(8)}  ${t.title}${assignee}`);
          }
        }
        process.exit(0);
      }

      if (sub === 'ready') {
        const tasks = await team.readyTasks();
        if (!tasks.length) {
          console.log('No tasks ready.');
        } else {
          for (const t of tasks) {
            console.log(`${t.id}  ${t.title}`);
          }
        }
        process.exit(0);
      }

      if (sub === 'show') {
        const id = rest[0];
        if (!id) { console.error('Usage: team task show <id>'); process.exit(1); }
        const task = await team.getTask(id);
        if (!task) { console.error(`Task not found: ${id}`); process.exit(1); }
        console.log(JSON.stringify(task, null, 2));
        process.exit(0);
      }

      if (sub === 'create') {
        const restArgs = [...rest];
        let id;
        const idFlag = restArgs.indexOf('--id');
        if (idFlag !== -1) {
          id = restArgs[idFlag + 1];
          restArgs.splice(idFlag, 2);
        }
        const title = restArgs.join(' ');
        if (!title) { console.error('Usage: team task create <title> [--id <task-id>]'); process.exit(1); }
        if (id) {
          const existing = await team.getTask(id);
          if (existing) { console.error(`Task already exists: ${id}`); process.exit(1); }
        }
        const task = await team.createTask({ title, id, createdBy: ACTOR });
        console.log(`Created ${task.id}: ${task.title}`);
        process.exit(0);
      }

      if (sub === 'complete') {
        const id = rest[0];
        if (!id) { console.error('Usage: team task complete <id>'); process.exit(1); }
        const task = await team.completeTask(id);
        console.log(`Marked ${task.id} completed.`);
        process.exit(0);
      }

      if (sub === 'update') {
        const id = rest[0];
        const status = rest[1];
        if (!id || !status) { console.error('Usage: team task update <id> <status>'); process.exit(1); }
        const task = await team.updateTask(id, { status });
        console.log(`Updated ${task.id} status to ${task.status}`);
        process.exit(0);
      }

      console.error('Unknown task command. Try: list, ready, show, create, complete, update');
      process.exit(1);
    }

    if (command === 'message' || command === 'msg') {      if (sub === 'send') {
        const to = rest[0];
        const body = rest.slice(1).join(' ');

        if (!to || !body) { console.error('Usage: team message send <worker> <body...>'); process.exit(1); }
        const msg = await team.sendMessage({ to, body, type: 'notification' });
        console.log(`Sent message ${msg.id} to ${to}`);
        process.exit(0);
      }

      if (sub === 'inbox') {
        // An explicit worker wins; otherwise TEAM_ACTOR (set by worker CLIs)
        // scopes the inbox, and a plain human sees every message.
        const worker = rest[0] || process.env.TEAM_ACTOR || null;
        printMessages(worker ? await team.inbox(worker) : await team.listMessages());
        process.exit(0);
      }

      console.error('Unknown message command. Try: send, inbox');
      process.exit(1);
    }

    if (command === 'messages') {
      printMessages(await team.listMessages());
      process.exit(0);
    }

    if (command === 'event') {
      if (sub === 'emit') {
        const type = rest[0];
        const summary = rest.slice(1).join(' ');
        if (!type) { console.error('Usage: team event emit <TYPE> [summary...]'); process.exit(1); }
        const event = await team.emit(type, summary ? { summary } : {});
        console.log(`Emitted ${event.type} (${event.id})`);
        process.exit(0);
      }
      console.error('Unknown event command. Try: emit');
      process.exit(1);
    }

    if (command === 'contract') {
      if (sub === 'list') {
        const contracts = await team.listContracts();
        if (!contracts.length) console.log('No contracts published.');
        for (const c of contracts) console.log(c);
        process.exit(0);
      }
      console.error('Unknown contract command. Try: list');
      process.exit(1);
    }

    if (command === 'worktree') {
      if (sub === 'create') {
        const workerId = rest[0];
        const branch = rest[1];
        if (!workerId) { console.error('Usage: team worktree create <worker-id> [branch]'); process.exit(1); }
        const result = team.createWorktree(workerId, branch);
        console.log(`Created worktree at ${result.path} on branch ${result.branch}`);
        process.exit(0);
      }
      if (sub === 'remove') {
        const workerId = rest[0];
        if (!workerId) { console.error('Usage: team worktree remove <worker-id>'); process.exit(1); }
        team.removeWorktree(workerId);
        console.log(`Removed worktree for ${workerId}`);
        process.exit(0);
      }
      if (sub === 'list') {
        const worktrees = team.listWorktrees();
        if (!worktrees.length) console.log('No worktrees.');
        for (const wt of worktrees) console.log(`${(wt.branch || '(detached)').padEnd(30)}  ${wt.path}`);
        process.exit(0);
      }
      console.error('Unknown worktree command. Try: create, remove, list');
      process.exit(1);
    }

    console.error(`Unknown command "${command}". Run "team help" for usage.`);
    process.exit(1);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/** Print messages; unread ones get a bullet, newest first. */
function printMessages(messages) {
  if (!messages.length) {
    console.log('No messages.');
    return;
  }
  for (const m of messages) {
    const unread = m.status === 'read' ? ' ' : '•';
    const to = !m.to || m.to === '*' ? '*' : m.to;
    const subject = m.subject ? `${m.subject} — ` : '';
    console.log(`${unread} ${m.id}  ${m.from} → ${to} (${m.type}): ${subject}${m.body}`);
  }
}

function printHelp() {
  console.log(`
Nova Team CLI companion — coordinate AI dev team workers via .ai-team/

Usage:
  team init [project-name]              Initialize .ai-team protocol directory
  team status                           Show project overview & task progress
  team task list                        List all tasks
  team task ready                       List tasks whose dependencies are met
  team task show <id>                   Show task details
  team task create <title> [--id <id>]  Create a new task
  team task complete <id>               Mark a task completed
  team task update <id> <status>        Update task status
  team message send <to> <body...>      Send a message to a worker
  team message inbox [<worker>]         View a message inbox (default: TEAM_ACTOR)
  team messages                         Show every message, newest first
  team event emit <TYPE> [summary...]   Append an event to the activity log
  team contract list                    List published contracts
  team help                             Show this help message

Environment:
  TEAM_ACTOR                            Identity used for events and messages
`);
}

await main();
