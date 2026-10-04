# NOVA Progress

## Current milestone: Walking skeleton

Started: 2026-09-07

### Completed

- [x] Establish a modular repository layout.
- [x] Add a runnable CLI entry point.
- [x] Add structured event publishing.
- [x] Add workspace detection and safe file inspection.
- [x] Add a bounded agent runtime with explicit lifecycle states.
- [x] Add coordinator-owned agent roles: planner, discovery, reviewer, and verifier.
- [x] Add declarative built-in skills and a local skill manager.
- [x] Add a permission policy boundary for tools.
- [x] Add a deterministic mock provider for offline development.
- [x] Add tests for the walking skeleton.
- [x] Add a normalized provider adapter contract.
- [x] Add durable local session metadata and event history.
- [x] Add session listing and resume command support.
- [x] Extract concise lifecycle rendering into a terminal UI module.
- [x] Add structured capability approval management.
- [x] Add compact terminal panels for runtime state.
- [x] Add interactive once/task/deny approval prompts with non-TTY denial.
- [x] Add configurable shell command allowlists/denylists.
- [x] Retain approval decisions as inspectable task history.
- [x] Add a tested OpenAI-compatible HTTP provider adapter.

### Next slice

- [x] Add an approval-aware shell tool.
- [x] Add Git status and diff tools.
- [x] Add a real provider adapter behind the provider interface.
- [x] Add provider configuration and metadata-only account storage.
- [x] Add capability-aware model routing and provider failover.
- [x] Add workspace-scoped atomic writes and exact-text edits.
- [x] Add compact proposed diffs to mutation approvals.
- [x] Add bounded verification runner with structured evidence.
- [x] Integrate verification into the bounded runtime loop.
- [x] Add failure-driven replan tests and project test discovery.
- [x] Route discovered checks through approved, non-shell execution.
- [x] Add opt-in `verify` command and richer failure summaries.
- [x] Add verification receipts and persistent check history.
- [x] Add `verification list` and receipt inspection commands.
- [x] Add structured JSON output and opt-in CI verification mode.
- [x] Add machine-readable JSONL task events and package dry-run validation.
- [x] Add release metadata, MIT license, changelog, and distribution tests.
- [x] Add installation metadata smoke test and CI release automation.
- [x] Add CLI skill listing and inspection commands.
- [x] Add local skill install/enable/disable/remove lifecycle commands.
- [x] Add skill integrity hashes and dependency resolution.
- [x] Add signed skill manifest verification and community trust classification.
- [x] Add capability-gated skill sandbox facade.
- [ ] Add operating-system sandbox backend for untrusted code.
- [x] Add offline-testable open-source discovery normalization and scoring.
- [x] Add GitHub and npm registry discovery adapters with mocked transport tests.
- [x] Add network approval and `discover` recommendation CLI integration.
- [x] Add repository evaluation evidence and package installation approval gate.
- [x] Add approved npm package installation and post-install verification.
- [ ] Add dependency rollback/checkpoint support.

## AI Dev Team Orchestrator (apps/desktop)

Milestone: Terminal foundation (Phase 1 of `ai-dev-team-orchestrator.md`)

Started: 2026-09-20

### Completed

- [x] Fix the desktop app toolchain (Tailwind v4 CSS-first wiring via `@tailwindcss/vite`).
- [x] Add a Rust PTY terminal manager (`portable-pty`): spawn arbitrary commands, stdin forwarding, resize, kill, base64 output streaming, real exit codes.
- [x] Add `.ai-team` project state in Rust: init/load/save with atomic writes, task listing, JSONL event log.
- [x] Add project picker and project persistence; restored workers come back detached and marked stopped.
- [x] Add xterm.js terminal tabs with per-worker sessions, scrollback, and human takeover.
- [x] Add Command Center: giant objective prompt, team panel, task panel (`.ai-team/tasks/*.json`), live activity feed.
- [x] Add worker lifecycle: add (with test-terminal preview), start, stop, restart, remove, lead designation, auto-start.
- [x] Add the deterministic fake terminal AI harness (`scripts/fake-ai.mjs`) with structured `TEAM://` protocol events.
- [x] Add harness tests (`test/fake-ai-harness.test.js`) and Rust unit tests for command resolution and `.ai-team` state.

### Next slice

- [x] `team` CLI companion (status, task list/complete, message send/inbox).
- [x] Task engine with dependency-aware unlocking (packages/team-protocol).
- [x] Shared `.ai-team` protocol package (tasks, messages, contracts, decisions, events, state).
- [x] Lead orchestration prompt and task decomposition (Analyze & Deploy Team).
- [x] Git worktree isolation and worker branches (team worktree create/remove/list).
- [x] End-to-end `team` CLI tests (`test/team-cli.test.js`); CLI activity events carry both `summary` and `payload` so the Command Center feed renders worker actions.
- [x] Fake-AI harness `complete`/`message` now call the real `team` CLI: actions land in `.ai-team` (missing tasks are upserted by id), with graceful degradation and no half-created protocol directories.
- [x] Workers spawn with `TEAM_ACTOR=<name>` so `team` CLI actions carry the worker's identity.
- [x] Command Center MESSAGES panel + unread badge: Rust `project_messages`/`watch_messages` (`team://message-changed`), file-watcher updates with a 5s poll fallback, and seen-tracking so the badge clears when viewed.
- [x] Reply from the MESSAGES panel: inline composer writes `from: "lead"` protocol messages via Rust `messages_send` (generates `msg_*` ids, validates from/body/createdAt, marks the replied-to message read); activity feed logs the reply.
- [x] Keyboard triage in the MESSAGES panel: j/k selection with scroll-into-view, r to reply, Enter to open/send (Shift+Enter newline in the composer), Esc to cancel — guarded so text fields, hidden worker terminals, and native buttons keep their own key handling; double-send hardened with an in-flight ref; selection math extracted to `src/features/command-center/message-keys.ts` and unit-tested (`test/message-keys.test.js`).
- [x] Threaded MESSAGES view: replies nest under their root via `replyTo` (chains flatten to one thread, dangling targets start their own, cycles cannot loop), threads sort by latest activity, and j/k walks display order; pure grouping in `message-threads.ts` unit-tested (`test/message-threads.test.js`).
- [x] Collapsed threads: long threads render only their newest two rows behind a "show N earlier" toggle (per-thread expand state, keyed by root id); j/k, Enter, r, and scroll-into-view traverse only visible rows (`flattenVisibleThreads`), and an open reply composer keeps its thread expanded so it can't be collapsed out of the DOM; collapse helpers unit-tested.
- [x] Threaded `team message inbox`: the CLI prints the same structure as the desktop panel (root first, replies indented `↳`, threads by latest activity via `groupThreads` in team-protocol); the inbox pulls in each reply's root for context, `team message send --reply-to <id>` threads new replies (validated, and marks the target read like the desktop composer); unit + CLI tests.
- [ ] Merge/review flow with lead approval.

## Verification

Run:

```bash
npm test
npm start -- "Explain this project"
```

Desktop app (requires the Rust toolchain for the Tauri shell):

```bash
cd apps/desktop && npm install && npm run tauri dev
```
