//! Nova Team Protocol — shared `.ai-team` engine.
//!
//! This module is the single source of truth for how the orchestrator reads
//! and writes the protocol directory. Both the `team` CLI and the desktop
//! orchestrator use it, so task/message/contract state stays consistent no
//! matter which surface a worker uses.
//!
//! Layout (see spec §13):
//! ```text
//! .ai-team/
//! ├── state.json        orchestrator state (workers, objective, lead)
//! ├── objective.md      the giant project prompt
//! ├── architecture.md   shared architecture notes
//! ├── rules.md          rules every worker must follow
//! ├── tasks/            one JSON file per task
//! ├── messages/         worker-to-worker messages
//! ├── contracts/        shared public interfaces
//! ├── decisions/        durable decision records
//! ├── events/           log.jsonl activity history
//! └── worker-config/    per-worker configuration
//! ```

export * from './tasks.js';
export * from './messages.js';
export * from './contracts.js';
export * from './decisions.js';
export * from './events.js';
export * from './state.js';
export * from './team.js';
export * from './worktrees.js';