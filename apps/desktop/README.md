# AI Dev Team Orchestrator (Nova Desktop)

A Tauri-based command center that coordinates any number of independent
terminal-based AI coding tools (Claude Code, Codex, Agy, OpenCode, Aider,
custom CLIs) on one project. One persistent Command Center tab, real
interactive terminal tabs for every worker.

This covers **Phase 1, the persistence slice of Phase 2, and the Team
Protocol slice** of `ai-dev-team-orchestrator.md`: the universal terminal
foundation plus the shared `.ai-team` protocol engine and its `team` CLI.

## What works today

- **Project picker** — open any folder; `.ai-team/` is initialized
  automatically (state.json, objective.md, architecture.md, rules.md, tasks/,
  messages/, contracts/, decisions/, events/, worker-config/).
- **Universal PTY layer** (`src-tauri/src/pty.rs`) — spawn arbitrary commands
  in a real pseudo-terminal (ConPTY on Windows, pipes+pty elsewhere via
  `portable-pty`), with stdin forwarding, resize, kill, live output streaming
  (base64 over Tauri events) and real exit codes.
- **xterm.js terminals** — one tab per worker, full ANSI support, scrollback,
  copy/paste, human takeover at any time. Hidden tabs keep running so
  scrollback and streams survive tab switches.
- **Worker management** — add (name, role, command, args, cwd, capabilities,
  auto-start, lead designation), start, stop, restart, remove. Workers are
  testable with a live PTY before joining the team ("Test Terminal").
- **Command Center** — giant project objective (auto-saved), team panel,
  task panel (reads `.ai-team/tasks/*.json`), live activity feed persisted to
  `.ai-team/events/log.jsonl`.
- **Persistence** — workers/objective/lead survive app restarts; restored
  workers come back detached (marked stopped).
- **Fake terminal AI harness** — `node scripts/fake-ai.mjs` (repo root)
  simulates an AI CLI deterministically for testing without real AI services:
  `--role frontend --auto --exit-code 3`, interactive commands (`status`,
  `work`, `write`, `complete`, `message`, `fail`, `exit`), and structured
  `TEAM:// {json}` protocol lines. When the working directory has an
  initialized `.ai-team`, `complete` and `message` also call the real
  `team` CLI so the actions land in the shared protocol (missing tasks are
  created by id on the fly); without it, they degrade to stdout events only.
- **Messages surface** — the Command Center shows `.ai-team/messages/` in a
  MESSAGES panel (type-colored, unread dots, "N new" badge) with an unread
  badge on the COMMAND CENTER tab. Updates stream via a file watcher with a
  5-second poll fallback. Workers spawn with `TEAM_ACTOR=<name>` so their
  `team` CLI actions carry their identity. Every incoming message has an
  inline Reply composer: replies are protocol messages with `from: "lead"`
  (spec §14) written through the Rust `messages_send` command, and replying
  marks the original message read — so `team message inbox` shows it handled.
  Triage without the mouse: `j`/`k` move the selection (scrolling it into
  view), `r` opens the reply composer, `Enter` opens or sends, `Esc` cancels.   Keys aimed at text fields or worker terminals are left alone. Replies
   thread under the message they answer via the protocol's `replyTo` field —
   chains resolve to one root, and threads sort by latest activity.
- **Team protocol + `team` CLI** (`packages/team-protocol` +
  `apps/cli/src/team-cli.js`) — the shared `.ai-team` engine (tasks with
  dependency unlocking, messages, contracts, decisions, JSONL events) and the
  `team` command any terminal AI worker can call: `team status`,
  `team task create|list|ready|show|update|complete`,
  `team message send|inbox`, `team messages`, `team event emit`,
  `team contract list`, `team worktree create|remove|list` (spec §13/§34).

## Running

Prerequisites: Node >= 20, npm, Rust toolchain (`rustup`), and platform deps
for Tauri 2 (see https://tauri.app/start/prerequisites/).

```bash
cd apps/desktop
npm install
npm run tauri dev     # development app with hot reload
npm run tauri build   # production bundle
npm run build         # frontend typecheck + vite build only
```

> Note: `npm run build` verifies the frontend only. The Rust core compiles
> during `tauri dev` / `tauri build`.

Rust unit tests (terminal resolution + `.ai-team` state):

```bash
cd apps/desktop/src-tauri
cargo test
```

Harness tests (repo root):

```bash
npm test              # includes the fake-ai, team-protocol, and team CLI tests
node scripts/fake-ai.mjs --role frontend --auto
```

## Architecture

```text
React + Tailwind v4 + Motion + Anime.js + xterm.js  (apps/desktop/src)
        │  Tauri IPC (commands + pty://output, pty://exit events)
        ▼
Rust core (apps/desktop/src-tauri/src)
├── pty.rs        TerminalManager: PTY sessions, streams, resize, exit
├── project.rs    .ai-team state, tasks, events (atomic writes, JSONL)
└── lib.rs        command surface + dialog plugin
```

Frontend layout:

```text
src/
├── lib/          types.ts, ipc.ts, status.ts
├── stores/       team-store.ts (zustand: workers, tabs, events, persistence)
└── features/
    ├── project/      ProjectGate (empty state + picker)
    ├── shell/        TabStrip, StartupSequence (animejs one-shot)
    ├── command-center/  objective + team/tasks/activity panels
    ├── workers/      WorkerCard, WorkerDrawer, AddWorkerModal (test terminal)
    ├── terminals/    TerminalPane (xterm.js <-> PTY session)
    └── activity/     ActivityFeed
```

## Design notes

- The orchestrator never hides or replaces the terminal: every worker is a
  real interactive process the user can drive manually at any time.
- Terminal text is never animated; Motion owns interface transitions, Anime.js
  owns the one-time startup sequence only.
- Arbitrary commands are supported; on Windows, extension-less commands are
  resolved through PATH+PATHEXT so npm-installed CLIs (`codex`, `claude`, …)
  spawn correctly.
- `.ai-team/` is plain files (JSON/MD/JSONL), human-readable and diffable;
  secrets stay out of it by design.

## Team CLI

Terminal AI workers participate in the protocol directly. From this repo's
root (or after `npm link`, which exposes a global `team` command):

```bash
TEAM_ACTOR=codex-ui node apps/cli/src/team-cli.js status
team task list
team task create "Add POST /login handler"
team task complete task-7
TEAM_ACTOR=codex-ui team message inbox
```

`TEAM_ACTOR` names the worker for events and messages; everything the CLI
appends to `.ai-team/events/log.jsonl` (with a human-readable `summary`)
shows up in the desktop Command Center activity feed.

## Next milestones (per spec §70–§76)

Review/merge flow with lead approval, task graph visualization, and
read-receipts for protocol messages (the `team` package already has
`markRead`).
