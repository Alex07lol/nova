# AI Dev Team Orchestrator

## Product Specification & Implementation Blueprint

> Working concept: a UI-first command center that coordinates an arbitrary number of independent terminal-based AI coding tools (Claude Code, Codex CLI, Agy, OpenCode, Aider, Gemini CLI, custom tools, etc.) on one project. The system does not replace those tools; it gives them a shared workspace, tasks, communication, Git isolation, and a visual control layer.

---

## 1. Product Definition

### Core idea

The user provides **one large project prompt**. A designated **Lead AI** analyzes the goal and converts it into a structured set of tasks for the available AI coding terminals.

Each team member is an independent terminal process. The orchestrator manages them without requiring them to be the same model, provider, or coding tool.

Example:

```text
                          USER
                            |
                            v
                    +----------------+
                    | Giant Prompt   |
                    +-------+--------+
                            |
                            v
                    +----------------+
                    | Lead AI        |
                    | Planner        |
                    +-------+--------+
                            |
             +--------------+---------------+
             |              |               |
             v              v               v
        +---------+    +---------+     +---------+
        | Claude  |    | Codex   |     | Agy     |
        | Lead/UI |    | Backend |     | QA      |
        +----+----+    +----+----+     +----+----+
             |              |               |
             +--------------+---------------+
                            |
                            v
                    ONE PROJECT / REPO
```

### Primary UX principle

**One command-center tab. Actual AI terminals occupy the remaining tabs.**

Do not create a web-app-style interface with dozens of pages or 100 individual agent tabs. The application should feel like a modern development cockpit sitting on top of normal terminal workflows.

---

# 2. Goals

## Must have

- One giant prompt input for the project objective.
- A Lead AI that decomposes the prompt into tasks.
- Unlimited practical team members, constrained only by machine resources and user choice.
- Every team member can be a different terminal-based AI coding application.
- Arbitrary custom terminal commands must be supported.
- Each worker gets a real terminal session.
- Terminals remain interactive and manually controllable by the user.
- One primary visual Command Center tab.
- Additional tabs represent the real terminal sessions that are currently open.
- Live worker status.
- Task assignment and dependencies.
- AI-to-AI messaging through a shared protocol.
- Git worktree-based isolation to reduce simultaneous edit conflicts.
- Shared project objective, architecture, contracts, and state.
- Worker lifecycle management: create, start, pause, restart, stop, remove.
- Project persistence so the team can resume later.

## Should have

- Automatic Git diff summaries.
- Automatic task progress detection.
- Dependency-aware task scheduling.
- Notifications when a worker becomes blocked or finishes.
- Lead review queue.
- Merge/rebase assistance.
- Worker resource monitoring.
- Searchable team activity history.
- Configurable worker roles and system prompts.
- Project templates.

## Future

- Agent capability scoring and automatic worker selection.
- Automatic conflict resolution.
- Cost/token tracking where the underlying tool exposes it.
- Multiple projects/workspaces.
- Remote workers.
- Local model workers.
- Plugin ecosystem for AI CLIs.
- Shared visual code/architecture maps.

---

# 3. Non-Goals

The first version should **not** attempt to become:

- Another AI coding model.
- Another general-purpose chat client.
- A replacement for Claude Code, Codex, Agy, OpenCode, Aider, etc.
- A full Jira/Linear clone.
- A cloud CI/CD platform.
- A browser IDE that hides terminals from users.

The application is an **orchestration and visualization layer**.

---

# 4. Target User Experience

The ideal flow is:

```text
Open Project
    |
    v
Add / detect AI coding tools
    |
    v
Assign roles
    |
    v
Enter one gigantic prompt
    |
    v
Lead AI analyzes project
    |
    v
Lead creates task graph
    |
    v
Tasks distributed to workers
    |
    v
Workers modify isolated worktrees
    |
    v
Workers communicate through Team Protocol
    |
    v
Lead reviews integration state
    |
    v
Tests / checks execute
    |
    v
Changes merge into project branch
```

The user can interrupt any time.

The user can open a terminal, type directly into the AI, inspect files, run commands, stop the process, or take over a task.

---

# 5. UI / Visual Design

## Design direction

The UI should feel like:

- A premium developer tool.
- Dense enough for real development use.
- Minimal enough to understand instantly.
- Motion-rich without becoming distracting.
- Clearly technical rather than corporate-dashboard-like.

### Recommended visual stack

Use:

- **React** for the interface.
- **Tailwind CSS** for layout and utility styling.
- **shadcn/ui** or a compatible component foundation where useful.
- **BKLIT UI** for the project's visual/component language where applicable.
- **Motion / Motion.dev** for high-quality UI transitions and interactions.
- **Anime.js** for timeline-based or more decorative/complex animations where it adds value.
- **xterm.js** for live terminal rendering.
- **Lucide** or another lightweight icon system.

Yes: **Motion.dev, BKLIT UI, and Anime.js can all be used together.** They should have clearly separated responsibilities rather than all animating the same element.

### Animation responsibilities

**Motion.dev**
- Layout transitions.
- Worker cards appearing/disappearing.
- Command-center panel transitions.
- Modal and drawer animation.
- Shared-layout transitions.
- Hover/focus interactions.
- Task graph movement.

**Anime.js**
- Complex timeline sequences.
- Startup/deployment sequences.
- Decorative ambient motion.
- Data-flow effects.
- Special one-off visual sequences.

**BKLIT UI**
- Core visual components.
- Buttons.
- Inputs.
- Cards.
- Panels.
- Dialogs.
- Navigation primitives.
- Status indicators.

Do not animate everything. Terminal text, logs, and frequently changing states should remain readable and stable.

---

# 6. Main Layout

The application has one persistent Command Center and a dynamic terminal tab strip.

```text
+--------------------------------------------------------------------+
|  ORCHESTRATOR   Project: Warranty Checker       4 Active    +      |
+--------------------------------------------------------------------+
| COMMAND CENTER | Claude Lead | Codex UI | Agy Backend | OpenCode QA|
+--------------------------------------------------------------------+
|                                                                    |
|  PROJECT OBJECTIVE                                                 |
|  +--------------------------------------------------------------+  |
|  | Build a complete warranty management platform...             |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  [ Team ]             [ Tasks ]              [ Activity ]          |
|                                                                    |
|  +-------------------------+  +-------------------------------+   |
|  | TEAM                    |  | PROJECT PULSE                 |   |
|  |                         |  |                               |   |
|  | ● Claude  Lead          |  | Authentication     70%        |   |
|  | ● Codex   Frontend      |  | Warranty API       45%        |   |
|  | ● Agy     Backend       |  | Dashboard           20%        |   |
|  | ◌ OpenCode QA           |  |                               |   |
|  +-------------------------+  +-------------------------------+   |
|                                                                    |
|  LIVE ACTIVITY                                                     |
|  ----------------------------------------------------------------  |
|  13:24 Claude created task #12                                     |
|  13:25 Agy started backend implementation                          |
|  13:28 Agy changed API contract                                    |
|  13:28 -> Codex notified                                           |
|                                                                    |
+--------------------------------------------------------------------+
```

### Persistent tab behavior

The tab bar contains:

1. **Command Center** — always present and not killable.
2. One tab per active terminal process.
3. Optional temporary system/preview tabs when needed.
4. A `+` button to add a worker.

When a worker is closed, its terminal tab disappears while its task/history remains available in the Command Center.

---

# 7. Worker Model

A worker is an external terminal program plus orchestration metadata.

```ts
interface Worker {
  id: string;
  name: string;
  role: string;
  command: string;
  args: string[];
  cwd: string;
  worktreePath?: string;
  branchName?: string;
  status: WorkerStatus;
  capabilities: string[];
  systemPrompt?: string;
  environment?: Record<string, string>;
  createdAt: string;
  lastActiveAt?: string;
}
```

### Worker statuses

```text
starting
idle
working
waiting
blocked
review
error
stopped
finished
```

### Example workers

```yaml
workers:
  - name: Claude Lead
    role: Lead Engineer
    command: claude

  - name: Codex UI
    role: Frontend Engineer
    command: codex

  - name: Agy Backend
    role: Backend Engineer
    command: agy

  - name: OpenCode QA
    role: QA Engineer
    command: opencode
```

The orchestrator should not care what the underlying AI is.

---

# 8. Universal Terminal Layer

The most important abstraction is the **Universal Terminal Worker**.

```text
                    Orchestrator
                         |
                         v
                  Terminal Manager
                         |
        +----------------+----------------+
        |                |                |
        v                v                v
      PTY 1            PTY 2            PTY 3
        |                |                |
        v                v                v
     Claude            Codex             Agy
```

The terminal manager must provide:

- Process spawn.
- PTY allocation.
- stdin forwarding.
- stdout/stderr capture.
- terminal resize.
- process signals.
- environment variables.
- working directory.
- exit code.
- process health.
- reconnect/resume where practical.
- terminal recording/logging where enabled.

### Recommended implementation

For a desktop app:

- Tauri shell/runtime.
- Rust process management.
- PTY library in Rust.
- xterm.js frontend terminal.

The exact PTY crate/library can be selected during implementation based on platform support and maintenance status.

---

# 9. Supported Terminal Types

The system should support two categories.

## Interactive AI terminal

Example:

```bash
claude
codex
agy
opencode
```

Launch the command in a PTY and render it as a real terminal.

## Non-interactive task command

Example:

```bash
codex exec "Implement task #31"
```

The worker abstraction should support both.

Do not hardcode model/provider assumptions into the core.

---

# 10. Add Worker Flow

Click:

```text
+ Add Worker
```

Show:

```text
+------------------------------------------------+
| ADD TEAM MEMBER                                |
|                                                |
| Name                                           |
| [ Codex Frontend                            ]  |
|                                                |
| Role                                           |
| [ Frontend Engineer                         ]  |
|                                                |
| Command                                        |
| [ codex                                     ]  |
|                                                |
| Arguments                                      |
| [                                            ]  |
|                                                |
| Working Directory                              |
| [ /project/worktrees/frontend               ]  |
|                                                |
| [ Test Terminal ]           [ Add Worker ]     |
+------------------------------------------------+
```

A worker should be testable before becoming part of the active team.

---

# 11. The Giant Prompt

The main prompt is the user's top-level project objective.

It should support:

- Very large text.
- Markdown.
- Drag/drop files in future versions.
- Paste architecture notes.
- Project constraints.
- Explicit requirements.
- Non-functional requirements.

Example:

```text
Build a warranty management platform.

Requirements:
- Authentication
- Warranty registration
- OCR serial number extraction
- Manufacturer lookup
- Dashboard
- Admin panel
- Responsive UI
- Tests
- Docker support

Constraints:
- Do not break the current API
- Use the existing database
- Maintain TypeScript strict mode
...
```

Button:

```text
[ ANALYZE & DEPLOY TEAM ]
```

---

# 12. Lead AI

The Lead AI is itself one of the terminal workers.

The orchestrator should not implement a proprietary reasoning engine for the first version.

Instead, it gives the selected Lead terminal a structured instruction and the necessary project/team context.

### Lead responsibilities

- Understand the giant prompt.
- Inspect the codebase.
- Determine required work.
- Break work into tasks.
- Assign tasks to suitable team members.
- Track dependencies.
- Request clarification internally when needed.
- Review completed work.
- Identify integration problems.
- Create follow-up tasks.
- Decide when the project milestone is complete.

The Lead should not automatically monopolize implementation.

---

# 13. Team Protocol

The Team Protocol is the layer that allows unrelated AI CLIs to cooperate.

The team creates a hidden/shared directory in the project:

```text
.ai-team/
├── project.json
├── objective.md
├── architecture.md
├── state.db
├── tasks/
├── messages/
├── contracts/
├── decisions/
├── events/
└── worker-config/
```

The protocol should be accessible through a CLI named, for example:

```bash
team
```

Examples:

```bash
team status
team task list
team task create
team task update
team task complete 14
team message send agy "Need the auth API schema"
team messages
team contract list
team event emit
```

This CLI is the neutral communication mechanism.

---

# 14. Team Message Protocol

Messages should be structured.

```json
{
  "id": "msg_01",
  "from": "codex-ui",
  "to": "agy-backend",
  "type": "question",
  "subject": "Auth API schema",
  "body": "What is the expected POST /login response?",
  "taskId": "task-auth-ui",
  "createdAt": "2026-09-13T13:00:00Z",
  "status": "unread"
}
```

Supported message types:

```text
question
answer
notification
blocker
handoff
review_request
contract_change
completion
```

---

# 15. Task System

Tasks are the system's primary unit of orchestration.

```ts
interface Task {
  id: string;
  title: string;
  description: string;
  assignee?: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high" | "critical";
  dependencies: string[];
  blockedBy?: string[];
  files?: string[];
  branch?: string;
  worktree?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

### Task status

```text
planned
queued
assigned
working
blocked
review
approved
rejected
completed
cancelled
```

---

# 16. Task Graph

The UI should visualize task dependencies without turning into a giant project-management application.

Example:

```text
                [ Architecture ]
                       |
           +-----------+-----------+
           |                       |
           v                       v
     [ Backend API ]         [ Database ]
           |
           v
      [ Frontend UI ]
           |
           v
         [ QA ]
```

Clicking a node opens task details in a side panel rather than navigating to a new page.

---

# 17. Git Isolation

Never assume multiple coding AIs can safely edit the exact same working tree concurrently.

Use Git worktrees.

```text
project/

main working repository

worktrees/
├── claude-lead/
├── codex-ui/
├── agy-backend/
└── opencode-qa/
```

### Workflow

```text
Task assigned
    |
    v
Create/attach worktree
    |
    v
Create worker branch
    |
    v
Worker edits files
    |
    v
Worker commits changes
    |
    v
Lead reviews diff
    |
    +---- approved ----> integration branch
    |
    +---- rejected ----> worker receives revision task
```

### Important rule

A worker should not merge directly to the user's protected/main branch unless the user explicitly enables that behavior.

---

# 18. Shared Project State

Use a small local database, preferably SQLite, for dynamic runtime state.

Suggested tables:

```text
projects
workers
sessions
tasks
task_dependencies
messages
contracts
events
commits
reviews
settings
```

Use files for human-readable long-lived context:

```text
.ai-team/objective.md
.ai-team/architecture.md
.ai-team/decisions/*.md
.ai-team/contracts/*.json
```

Use SQLite for mutable runtime state and indexes.

---

# 19. State Synchronization

Workers do not need to continuously poll everything.

The orchestrator can watch:

- `.ai-team` changes.
- Git changes.
- task state.
- process output.
- explicit team commands.

Recommended event loop:

```text
PTY output
Git watcher
Team CLI
Task DB
     |
     v
Event Bus
     |
     +--> UI
     +--> Lead
     +--> Worker notifications
     +--> Activity log
```

---

# 20. Event System

Events should have a common structure.

```json
{
  "id": "evt_123",
  "type": "TASK_COMPLETED",
  "actor": "codex-ui",
  "payload": {
    "taskId": "task-12",
    "commit": "a84fd91"
  },
  "timestamp": "2026-09-13T13:31:00Z"
}
```

Useful event types:

```text
WORKER_STARTED
WORKER_STOPPED
WORKER_ERROR
WORKER_BLOCKED
TASK_CREATED
TASK_ASSIGNED
TASK_STARTED
TASK_COMPLETED
MESSAGE_SENT
MESSAGE_RECEIVED
CONTRACT_CHANGED
COMMIT_CREATED
REVIEW_REQUESTED
REVIEW_APPROVED
REVIEW_REJECTED
MERGE_COMPLETED
MERGE_CONFLICT
TEST_FAILED
TEST_PASSED
```

---

# 21. Live Activity Feed

The feed should translate machine events into readable summaries.

Example:

```text
13:24  Claude created #18 "Implement authentication API"
13:25  Agy started #18
13:28  Agy published auth contract
13:28  Codex received contract change
13:31  Codex completed #19
13:32  OpenCode started QA
13:33  OpenCode found 2 failures
13:34  Claude created #21 "Fix auth validation"
```

The raw terminal remains available when the user needs detail.

---

# 22. Worker Detail Panel

Clicking a worker should show a compact drawer/panel:

```text
+-------------------------------------+
| Codex UI                         X  |
| Frontend Engineer                   |
|                                     |
| ● Working                           |
| Task #19                            |
| Dashboard redesign                 |
|                                     |
| Branch                             |
| feature/frontend-dashboard         |
|                                     |
| Files touched                      |
|  src/components/Dashboard.tsx      |
|  src/styles/dashboard.css          |
|                                     |
| Messages: 3                         |
| Last commit: 2 min ago             |
|                                     |
| [ Open Terminal ]                   |
| [ Stop ]  [ Restart ] [ Reassign ]  |
+-------------------------------------+
```

---

# 23. Terminal UX

The embedded terminals must feel like real terminals, not fake log viewers.

Requirements:

- Full stdin support.
- Copy/paste.
- Search.
- Resize.
- ANSI color support.
- Mouse support where possible.
- Scrollback.
- Keyboard shortcuts.
- Selection.
- Shell prompt handling.
- Terminal reset.
- Process interrupt.
- Full-screen TUI compatibility where practical.

The user must be able to take over manually.

---

# 24. Human Override

At every level, the user is allowed to intervene.

Examples:

```text
Stop Worker
Restart Worker
Send Prompt
Reassign Task
Pause Team
Approve Merge
Reject Merge
Open Worktree
Open External Terminal
```

The system should never trap the user inside orchestration logic.

---

# 25. Team Templates

Provide simple presets:

### Full-stack

```text
Lead
Frontend
Backend
QA
```

### Solo + reviewer

```text
Lead
Reviewer
```

### UI-heavy

```text
Lead
UI/UX
Frontend
QA
```

### Research-heavy

```text
Lead
Research
Implementation
QA
```

These are starting points, not fixed agent types.

---

# 26. Dynamic Team Expansion

The user should be able to add workers during an active project.

Example:

```text
User clicks + Add Worker
        |
        v
OCR Research Specialist
        |
        v
Lead sees new capability
        |
        v
Lead assigns OCR research task
```

No restart should be required.

---

# 27. Capability System

Workers may optionally declare capabilities:

```yaml
capabilities:
  - frontend
  - react
  - css
  - ui
```

Another:

```yaml
capabilities:
  - backend
  - node
  - postgres
  - api-design
```

The Lead can use these to select workers.

For custom CLIs without known capabilities, the user can manually specify them.

---

# 28. Context Sharing

Do not dump every terminal's full history into every other terminal.

Instead share:

- Objective.
- Relevant task.
- Relevant architecture.
- Relevant contracts.
- Relevant messages.
- Relevant recent decisions.
- Relevant Git diff summary.

This keeps context manageable.

---

# 29. Contracts

Shared public interfaces should be represented separately from normal chatter.

Examples:

```text
.ai-team/contracts/auth.json
.ai-team/contracts/api.yaml
.ai-team/contracts/database.md
.ai-team/contracts/ui-state.md
```

When a worker changes a contract, it should emit:

```text
CONTRACT_CHANGED
```

The orchestrator can identify workers with dependent tasks and notify them.

---

# 30. Lead Review Loop

When a worker completes a task:

```text
Worker completes
     |
     v
Commit created
     |
     v
Task -> review
     |
     v
Lead receives review request
     |
 +---+----------------+
 |                    |
 v                    v
Approve              Reject
 |                    |
 v                    v
Merge             Revision task
```

Optional later feature:

A dedicated Reviewer AI can inspect diffs before the Lead.

---

# 31. Merge Strategy

Recommended initial policy:

```text
worker branch
      |
      v
integration branch
      |
      v
user/main branch
```

The user can configure:

```text
Manual merge
Lead-approved merge
Auto merge after tests
```

Default should be **Lead-approved merge**, not blind auto-merge.

---

# 32. Conflict Handling

When a merge conflict occurs:

```text
MERGE_CONFLICT
     |
     v
Command Center highlights conflict
     |
     +----> Open affected files
     |
     +----> Ask Lead AI to resolve
     |
     +----> Ask user to resolve
```

The system must never silently overwrite changes to resolve a conflict.

---

# 33. Project Initialization

Command-line fallback should be available even though the primary UI is graphical.

Example:

```bash
devteam init
```

Creates:

```text
.ai-team/
```

GUI launch:

```bash
devteam open
```

Optional direct project launch:

```bash
devteam open ./my-project
```

---

# 34. CLI Companion

The graphical application and external terminals need a lightweight companion command.

Example:

```bash
team status
team task list
team task show 18
team task complete 18
team message send codex-ui "API contract updated"
team message inbox
team worker status
team project info
```

This should be tiny and fast.

Possible implementation:

- Same codebase.
- Shared core package.
- CLI communicates with the local orchestrator daemon through a local IPC/socket/HTTP endpoint.

---

# 35. Desktop Architecture

Recommended high-level architecture:

```text
+------------------------------------------------------+
|                  Desktop UI                         |
| React + Tailwind + BKLIT + Motion + Anime.js        |
| xterm.js                                             |
+-------------------------+----------------------------+
                          |
                    IPC / Commands
                          |
+-------------------------v----------------------------+
|                 Orchestrator Core                   |
|                                                      |
| Project Manager                                      |
| Worker Manager                                       |
| Task Engine                                          |
| Event Bus                                            |
| Team Protocol                                        |
| Git Manager                                          |
| State Store                                          |
| Notification Manager                                 |
+-----------+---------------+--------------------------+
            |               |
            v               v
       PTY Manager       SQLite
            |
      +-----+------+----------------+
      |            |                |
    Claude       Codex            Agy ... N
```

---

# 36. Recommended Technology Stack

## Frontend

- TypeScript.
- React.
- Vite.
- Tailwind CSS.
- BKLIT UI.
- Motion / Motion.dev.
- Anime.js.
- xterm.js.
- Zustand or another small state manager.
- React Flow or equivalent for task graphs if needed.

## Desktop / backend

- Tauri.
- Rust for process/PTY/system integration.
- SQLite.
- Git CLI integration initially.

## Optional later

- Local WebSocket event stream.
- Better Git library integration.
- Plugin SDK.

---

# 37. Why Tauri

The application needs direct access to:

- Processes.
- Terminals.
- File systems.
- Git.
- Environment variables.
- Local project directories.

A browser-only application is unnecessarily restrictive.

Tauri provides a suitable boundary:

```text
React UI
   |
   v
Tauri IPC
   |
   v
Rust Core
   |
   +--> PTY
   +--> Process
   +--> Git
   +--> File System
   +--> SQLite
```

---

# 38. Security Model

Because the application launches arbitrary terminal commands, security is critical.

### Default rules

- Clearly display the command being launched.
- Clearly display working directory.
- Clearly display environment changes.
- Require confirmation for destructive actions when triggered by the orchestrator.
- Never silently execute commands outside the configured project scope.
- Never expose secrets in UI logs by default.
- Keep credentials in environment/keychain systems, not `.ai-team` files.
- Provide an allowlist/denylist for destructive shell commands later.

The application itself is local-first and should not upload project code unless the underlying AI tool does so.

---

# 39. Permissions

Worker configuration should support:

```text
Filesystem access
Shell access
Network access
Git access
Environment variables
```

These can be represented conceptually even if enforcement is platform-specific.

---

# 40. Resource Management

N workers means N processes.

The application must show basic resource usage where feasible:

```text
TEAM RESOURCES
CPU     34%
RAM     7.2 GB
Workers 6 / 8
```

Optional worker limit:

```text
Maximum active workers: 8
```

A queued task should wait rather than spawning unlimited processes when resources are constrained.

---

# 41. UX States

Important global states:

```text
No project
Project loaded
Team configuring
Planning
Deploying
Working
Waiting
Blocked
Reviewing
Integrating
Conflict
Completed
Error
Paused
```

The UI should visibly communicate these states.

---

# 42. Motion Design Rules

Use motion as information, not decoration.

### Good uses

- A new worker card slides into the team layout.
- A task node activates when its dependency unlocks.
- A message indicator gently appears.
- A worker status changes from waiting to working.
- A merge transition shows progress.
- A panel expands without snapping.

### Avoid

- Constant pulsing everywhere.
- Excessive particle effects.
- Animating terminal text.
- Long transitions on routine actions.
- Decorative motion that reduces scan speed.

### Suggested motion language

```text
Fast: 120-180ms
Normal: 180-280ms
Large transition: 300-500ms
Ambient: slow and very subtle
```

Exact timings can be refined during implementation.

---

# 43. Startup Experience

A polished startup sequence can be used once, not on every UI interaction.

Example:

```text
                 CONDUCTOR

        INITIALIZING DEV TEAM...

        Project     ✓
        Git         ✓
        Terminal    ✓
        Workers     ✓
        Protocol    ✓

              [ ENTER TEAM ]
```

This is a good place for an Anime.js timeline if desired.

---

# 44. Empty State

First launch should not look empty or confusing.

```text
                Build with your AI team.

     Connect your terminal coding tools and
       orchestrate them from one workspace.

        [ Open Project ]   [ Add Worker ]
```

---

# 45. Project Persistence

On reload:

- Reopen project metadata.
- Restore workers that can be safely reattached.
- Mark dead processes as stopped.
- Restore task graph.
- Restore messages and activity.
- Preserve terminal logs where configured.

The UI should distinguish between:

```text
Restored state
New session
Detached process
```

---

# 46. Failure Handling

A worker may:

- Crash.
- Exit unexpectedly.
- Lose terminal state.
- Produce malformed team messages.
- Edit conflicting files.
- Get stuck.
- Ignore its task instructions.

The orchestrator should not collapse the whole team because one worker failed.

Example:

```text
Agy Backend
● ERROR

The worker process exited with code 1.

[ Restart ] [ Open Terminal ] [ Reassign Task ]
```

---

# 47. Malformed AI Output

The Lead may not always produce valid task JSON.

Do not trust free-form model output blindly.

Use a structured request format and validate responses.

If invalid:

```text
Lead returned an invalid team plan.

Automatically requesting a corrected plan...
```

After a configurable number of failures, ask the user.

---

# 48. Protocol Safety

Workers are AI programs and should be considered untrusted with respect to orchestration state.

Examples of invalid behavior:

```text
worker tries to assign itself unrelated privileged tasks
worker attempts to modify protected branch
worker tries to edit another worker's private state
worker emits malformed task state
```

The orchestrator must enforce permissions rather than relying only on prompts.

---

# 49. File Ownership

A task can optionally have expected file areas.

Example:

```json
{
  "taskId": "frontend-dashboard",
  "allowedPaths": [
    "src/components/dashboard/**",
    "src/styles/dashboard/**"
  ]
}
```

Initially, this can be advisory.

Later, the system can detect out-of-scope changes and warn before merge.

---

# 50. Project-Level Instructions

The project should support:

```text
.ai-team/objective.md
.ai-team/architecture.md
.ai-team/rules.md
```

`rules.md` might include:

```text
Do not use Redux.
Use existing API clients.
Do not modify database migrations without Lead approval.
Keep UI accessible.
Do not add dependencies without justification.
```

Every worker receives the relevant instructions through its task context.

---

# 51. Example Full Interaction

User enters:

```text
Create a full warranty management application with authentication,
OCR serial number scanning, manufacturer lookup, warranty tracking,
administrator tools, a modern dashboard, tests, and Docker support.
Preserve the current project architecture where practical.
```

The Lead analyzes it and creates:

```text
#01 Architecture audit          Lead
#02 Auth API                    Agy Backend
#03 Auth UI                     Codex UI
#04 OCR pipeline                Research
#05 Warranty API                Agy Backend
#06 Warranty dashboard          Codex UI
#07 Admin interface             Codex UI
#08 Integration tests           OpenCode QA
#09 End-to-end tests            OpenCode QA
#10 Docker                      Lead
```

The Command Center shows:

```text
TEAM

● Claude Lead         Planning
● Codex UI            Waiting
● Agy Backend         Working
● OpenCode QA         Waiting
● Research            Working
```

Later:

```text
Agy Backend
  -> completed #02
  -> published auth contract

Codex UI
  -> dependency unlocked
  -> started #03
```

The UI animates the dependency unlock.

The user clicks Codex UI and lands in the actual live Codex terminal.

---

# 52. Application Navigation

Keep navigation shallow.

Recommended top-level surfaces:

```text
Command Center
Project Menu
Worker Tabs
```

Secondary details should use:

- drawers.
- popovers.
- modals.
- expandable panels.

Avoid deep routes such as:

```text
/projects/project/teams/team/worker/tasks/task/messages/message
```

The user should rarely be more than one interaction away from what they need.

---

# 53. Project Menu

Include:

```text
Project
├── Open
├── Recent
├── Team Settings
├── Git Settings
├── Protocol Settings
├── Appearance
└── Export / Backup
```

---

# 54. Team Configuration

Configuration should include:

```text
Lead worker
Default branch
Worktree root
Auto-start workers
Auto-review policy
Merge policy
Max active workers
Protocol settings
```

---

# 55. Appearance

Support a highly polished dark theme first.

Suggested aesthetic:

```text
Deep dark base
Subtle borders
Glass/blur used sparingly
High-contrast text
Clear status colors
Soft depth
Monospaced terminal region
Modern geometric UI typography
```

Do not overdo gradients or glassmorphism to the point that the application feels like a concept demo instead of a developer tool.

---

# 56. Responsive Behavior

The primary target is desktop.

Minimum useful layout:

```text
1280x800
```

At smaller widths:

- Collapse side panels.
- Preserve terminal visibility.
- Convert worker cards into compact rows.
- Keep Command Center usable.

No need to optimize for phones in v1.

---

# 57. Accessibility

Must support:

- Keyboard navigation.
- Visible focus states.
- Reduced-motion preference.
- Sufficient text contrast.
- Screen-reader labels for controls.
- Terminal keyboard behavior that does not conflict with the application.

When reduced motion is enabled, disable decorative animations while preserving state transitions that communicate meaning.

---

# 58. Suggested Source Structure

```text
ai-dev-team/
├── apps/
│   ├── desktop/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   │   ├── command-center/
│   │   │   │   ├── workers/
│   │   │   │   ├── tasks/
│   │   │   │   ├── activity/
│   │   │   │   └── terminals/
│   │   │   ├── stores/
│   │   │   ├── hooks/
│   │   │   └── styles/
│   │   └── src-tauri/
│   │       ├── src/
│   │       │   ├── process/
│   │       │   ├── pty/
│   │       │   ├── git/
│   │       │   ├── ipc/
│   │       │   ├── state/
│   │       │   └── protocol/
│   │       └── Cargo.toml
│   │
│   └── cli/
│       └── src/
│
├── packages/
│   ├── protocol/
│   ├── core/
│   ├── schemas/
│   └── shared/
│
├── scripts/
├── docs/
└── README.md
```

---

# 59. Core Modules

## ProjectManager

Responsibilities:

- Open project.
- Initialize `.ai-team`.
- Load/save project metadata.
- Manage project configuration.

## WorkerManager

Responsibilities:

- Register workers.
- Spawn workers.
- Stop workers.
- Restart workers.
- Track status.
- Map workers to PTYs.

## TerminalManager

Responsibilities:

- PTY allocation.
- Input/output forwarding.
- Resize.
- Process signals.
- Terminal lifecycle.

## TaskEngine

Responsibilities:

- Create tasks.
- Assign tasks.
- Resolve dependencies.
- Update state.
- Unlock downstream tasks.

## TeamProtocol

Responsibilities:

- Messages.
- Events.
- Contracts.
- Worker command interface.

## GitManager

Responsibilities:

- Worktrees.
- Branches.
- Commits.
- Diffs.
- Merge/rebase.
- Conflict state.

## EventBus

Responsibilities:

- Broadcast events.
- Feed UI.
- Trigger orchestration.
- Maintain event history.

---

# 60. Installation

The installer should eventually:

1. Install desktop application.
2. Install `team` CLI.
3. Register CLI PATH if requested.
4. Verify Git.
5. Verify required local dependencies.
6. Detect available AI coding CLIs.
7. Present discovered workers to the user.

Example detection screen:

```text
DETECTED CODING TOOLS

✓ Claude Code
✓ Codex
✓ Agy
✓ OpenCode
✓ Aider

5 tools detected.

[ Configure Team ]
```

Detection must not assume that a known tool is present or licensed.

---

# 61. AI Tool Detection

Use simple executable detection initially:

```bash
which claude
which codex
which agy
which opencode
which aider
```

On Windows/macOS/Linux use platform-appropriate process lookup.

Allow manual custom commands even when automatic detection fails.

---

# 62. Environment Handling

Workers may require specific environment variables.

Configuration should support:

```yaml
environment:
  ANTHROPIC_BASE_URL: ...
  OPENAI_BASE_URL: ...
```

Do not save secret values in plaintext project files.

Support references to OS keychain/credential stores later.

---

# 63. Observability

Provide a developer mode showing:

```text
Process PID
PTY status
Worker command
Exit codes
IPC events
Protocol events
Git operations
```

This is essential during early development because terminal orchestration is inherently difficult to debug.

---

# 64. Logging

Separate logs into:

```text
Application log
Worker process log
Protocol event log
Git operation log
```

User-facing activity should remain human-readable.

Raw debugging logs should be accessible separately.

---

# 65. Testing Strategy

## Unit tests

- Task dependency logic.
- Worker state machine.
- Event serialization.
- Protocol validation.
- Project config.
- Git path calculations.

## Integration tests

- Spawn fake terminal worker.
- Send input.
- Capture output.
- Create task.
- Complete task.
- Publish message.
- Worktree creation.
- Commit detection.
- Merge simulation.

## End-to-end tests

Use fake coding CLI programs rather than real AI services.

Example fake worker:

```bash
fake-ai --role frontend
```

It should:

- Print terminal output.
- Read commands.
- Create a test file.
- Run `team task complete`.

This gives deterministic testing without consuming AI credits.

---

# 66. Terminal Test Harness

Build a reusable fake terminal AI harness early.

Example:

```text
FakeAI
  |
  +--> reads stdin
  +--> emits ANSI output
  +--> modifies test repository
  +--> uses team CLI
  +--> exits with configurable status
```

This is one of the most important pieces for reliable development.

---

# 67. Security Testing

Test that:

- Workers cannot accidentally escape intended directories through orchestrator operations.
- Protected branches require policy approval.
- Malformed messages are rejected.
- Invalid task assignments are rejected.
- Secrets do not appear in logs.
- Terminal input cannot be spoofed as a trusted system event.

---

# 68. Performance Targets

Targets for a normal desktop:

- Command Center first render: fast and responsive.
- Terminal rendering remains smooth with several simultaneous sessions.
- UI remains responsive with at least 10 active workers in a normal project.
- Event processing should be asynchronous.
- Large terminal scrollback should be bounded/configurable.

Do not assume all users will actually run 50+ heavy AI workers simultaneously; design the data model for N workers while keeping UI/resource behavior practical.

---

# 69. MVP Definition

MVP should include only:

```text
✓ Create/open project
✓ Initialize .ai-team
✓ Add arbitrary terminal worker
✓ Spawn PTY
✓ Embed live terminal
✓ Command Center
✓ Giant project prompt
✓ One Lead worker
✓ Basic task creation
✓ Worker assignment
✓ Task status
✓ Team CLI
✓ Shared messages
✓ Git worktrees
✓ Worker tabs
✓ Activity feed
```

Do not build automatic conflict resolution, sophisticated analytics, or a plugin marketplace in MVP.

---

# 70. Phase 1 — Foundation

### Deliverables

- Tauri shell.
- React application.
- Basic command center.
- Project open/create.
- Worker model.
- PTY manager.
- xterm.js.
- Add worker form.
- Terminal tabs.

### Acceptance test

The user can configure:

```text
Codex
command: codex
```

and see a real interactive Codex terminal inside the app.

---

# 71. Phase 2 — Project Team Layer

### Deliverables

- `.ai-team` directory.
- SQLite state.
- Worker state.
- Task model.
- Basic team CLI.
- Message model.
- Activity events.

### Acceptance test

A worker can run:

```bash
team task complete 1
```

and the Command Center updates live.

---

# 72. Phase 3 — Lead Orchestration

### Deliverables

- Giant prompt.
- Lead worker designation.
- Structured Lead prompt.
- Task decomposition.
- Automatic assignment.
- Dependency graph.

### Acceptance test

One large prompt creates a valid task graph assigned across multiple workers.

---

# 73. Phase 4 — Git Isolation

### Deliverables

- Automatic worktrees.
- Branch naming.
- Commit tracking.
- Diff display.
- Review states.
- Merge integration.

### Acceptance test

Two workers can modify different files concurrently without writing to the same worktree.

---

# 74. Phase 5 — UI Polish

### Deliverables

- BKLIT-based visual system.
- Motion.dev transitions.
- Anime.js timeline sequences where appropriate.
- Task graph animation.
- Worker status motion.
- Responsive drawers.
- Startup experience.
- Command Center refinement.

### Acceptance test

The application feels like one coherent product rather than a collection of terminal windows.

---

# 75. Phase 6 — Reliability

### Deliverables

- Reconnect behavior.
- Crash recovery.
- Process cleanup.
- Better merge error handling.
- Protocol validation.
- Resource limits.
- Comprehensive logging.
- Fake worker test harness.

---

# 76. Phase 7 — Advanced Team Intelligence

Possible additions:

- Dynamic team creation.
- Capability-aware assignment.
- Automatic task splitting.
- Smart review routing.
- Git conflict analysis.
- Project health scoring.
- AI-generated summaries.

These should remain optional extensions of the core system.

---

# 77. Example Configuration

```yaml
project:
  name: warranty-checker
  root: /projects/warranty-checker
  defaultBranch: main

team:
  lead: claude-lead
  maxActiveWorkers: 8
  mergePolicy: lead_approval

workers:
  claude-lead:
    name: Claude Lead
    role: Lead Engineer
    command: claude
    cwd: /projects/warranty-checker/worktrees/lead
    capabilities:
      - architecture
      - planning
      - review

  codex-ui:
    name: Codex UI
    role: Frontend Engineer
    command: codex
    cwd: /projects/warranty-checker/worktrees/ui
    capabilities:
      - react
      - frontend
      - ui

  agy-backend:
    name: Agy Backend
    role: Backend Engineer
    command: agy
    cwd: /projects/warranty-checker/worktrees/backend
    capabilities:
      - node
      - api
      - backend

  opencode-qa:
    name: OpenCode QA
    role: QA Engineer
    command: opencode
    cwd: /projects/warranty-checker/worktrees/qa
    capabilities:
      - tests
      - qa
      - debugging
```

---

# 78. Lead Prompt Template

The orchestrator should generate a strong role prompt for the designated Lead.

```text
You are the Lead Engineer for this project.

PROJECT OBJECTIVE:
{{objective}}

TEAM:
{{team_summary}}

PROJECT RULES:
{{rules}}

CURRENT ARCHITECTURE:
{{architecture}}

Your responsibilities:
1. Inspect the project before creating implementation tasks.
2. Break the objective into concrete tasks.
3. Assign tasks to team members based on capabilities.
4. Define dependencies.
5. Avoid duplicate work.
6. Publish important architectural/API changes through the Team Protocol.
7. Review completed work before integration.
8. Create follow-up tasks when necessary.
9. Do not modify protected branches without approval.
10. Keep the project state synchronized using the `team` CLI.

When creating tasks, provide:
- task ID
- title
- description
- assignee
- dependencies
- relevant files
- acceptance criteria
```

---

# 79. Worker Prompt Template

```text
You are a member of a coordinated AI development team.

ROLE:
{{role}}

TASK:
{{task}}

PROJECT OBJECTIVE:
{{objective}}

PROJECT RULES:
{{rules}}

READ BEFORE WORKING:
- .ai-team/objective.md
- .ai-team/architecture.md
- your assigned task
- relevant team messages

RULES:
- Work only on your assigned task unless the Lead explicitly expands scope.
- Check for relevant contract changes before editing dependent code.
- Use the `team` CLI for team communication.
- Update task state when starting, blocking, or completing work.
- Commit coherent changes when complete.
- Never modify the protected branch directly.
```

---

# 80. User Control Modes

Support three orchestration modes eventually:

### Manual

The system shows suggestions but the user starts/assigns tasks.

### Assisted

The Lead creates and assigns tasks, but merges require approval.

### Autonomous

The Lead can assign, review, test, and merge according to configurable policies.

Default: **Assisted**.

---

# 81. Future Plugin System

A future plugin interface could allow custom integrations:

```ts
interface ToolAdapter {
  id: string;
  detect(): Promise<boolean>;
  launch(config: WorkerConfig): Promise<WorkerSession>;
  capabilities(): string[];
}
```

However, the core system should **not require adapters** for basic terminal tools.

Adapter plugins are useful only when a tool exposes specialized APIs or deeper lifecycle features.

---

# 82. Key Design Principle

The application must remain useful even if the AI tools change.

Today's team might be:

```text
Claude Code
Codex
Agy
OpenCode
```

Tomorrow it might be:

```text
NewToolA
NewToolB
LocalAgent
CustomCompanyCLI
```

The orchestrator should not require a rewrite.

The terminal is the universal interface.

---

# 83. Product Differentiation

The differentiating idea is not:

> "We have multiple AI agents."

It is:

> **"Use the AI coding tools you already have as a coordinated development team."**

The user's existing tools remain visible, interactive, and independently useful.

The application simply adds:

```text
coordination
+ context
+ task management
+ communication
+ isolation
+ visualization
```

---

# 84. Critical Engineering Risks

## PTY complexity

Interactive terminal applications can behave differently from normal stdout processes.

Mitigation:

- Build terminal infrastructure first.
- Test with real interactive CLIs and fake tools.

## Concurrent file changes

Mitigation:

- Git worktrees.
- Explicit ownership.
- Integration branch.

## AI unreliability

Mitigation:

- Structured protocol.
- Schema validation.
- Lead review.
- Human override.

## Context explosion

Mitigation:

- Share task-specific summaries rather than full histories.
- Keep contracts and decisions structured.

## Resource usage

Mitigation:

- Worker queue.
- Maximum active worker setting.
- Resource monitoring.

---

# 85. Definition of Done for V1

V1 is successful when the following scenario works:

```text
1. User opens an existing Git project.

2. User adds:
   - Claude Code as Lead
   - Codex as Frontend
   - Agy as Backend
   - OpenCode as QA

3. Each tool appears as its own terminal tab.

4. User pastes one gigantic project prompt.

5. Lead analyzes the repository and produces a task graph.

6. Orchestrator assigns tasks.

7. Workers use separate Git worktrees.

8. Workers communicate using `team` commands.

9. Command Center shows progress and events.

10. User can click any terminal tab and interact directly.

11. Worker commits are reviewed.

12. Approved changes integrate into the project.

13. The user remains able to intervene at any point.
```

If this works reliably, the core product exists.

---

# 86. AI Execution Prompt

Use this prompt when handing the project specification to an AI coding tool tasked with implementing it.

```text
You are implementing a desktop application called AI Dev Team Orchestrator.

Read the complete specification before writing code.

The product is NOT an AI coding model. It is an orchestration UI for multiple independent terminal-based AI coding tools such as Claude Code, Codex, Agy, OpenCode, Aider, Gemini CLI, or arbitrary custom terminal commands.

CORE REQUIREMENT

The user enters one large project prompt. A designated Lead AI terminal converts that prompt into a structured task graph and delegates work to any number of other terminal-based AI workers.

Each worker remains a real interactive terminal process. The application must never hide or replace the underlying terminal experience.

UI REQUIREMENT

Use a single Command Center as the primary visual workspace. Additional tabs are the currently open worker terminals. Do not build dozens of application pages or one page per AI.

The Command Center must show:
- Project objective
- Team members
- Worker status
- Task graph/progress
- Live activity
- Blockers
- Integration/review state

TECHNOLOGY DIRECTION

Use:
- Tauri
- Rust
- React
- TypeScript
- Vite
- Tailwind CSS
- BKLIT UI
- Motion / Motion.dev
- Anime.js
- xterm.js
- SQLite

Use Motion.dev primarily for UI/layout transitions. Use Anime.js selectively for complex sequences and decorative system-level motion. Do not over-animate the interface.

ARCHITECTURE

Implement:
- ProjectManager
- WorkerManager
- TerminalManager
- TaskEngine
- TeamProtocol
- EventBus
- GitManager
- SQLite state layer

TERMINAL SYSTEM

Implement a universal terminal worker abstraction using PTYs. The worker should accept:
- command
- arguments
- cwd
- environment
- role
- capabilities

Do not hardcode support for only a few AI vendors.

A command such as `codex`, `claude`, `agy`, `opencode`, or any custom executable should be launchable.

PROJECT STATE

Create `.ai-team/` with:
- objective.md
- architecture.md
- rules.md
- state.db or equivalent state reference
- tasks/
- messages/
- contracts/
- decisions/
- events/

TEAM CLI

Provide a companion `team` CLI for use by external coding terminals.
Support at minimum:
- team status
- team task list
- team task show <id>
- team task complete <id>
- team task update <id>
- team message send <worker> <message>
- team message inbox

The UI and CLI must communicate through a shared local orchestrator state/event mechanism.

GIT

Use Git worktrees so workers do not directly share one mutable working directory.
Each worker should normally have its own branch/worktree.
The protected/main branch must not be silently modified by workers.

TEAM COORDINATION

Use structured JSON schemas for tasks, messages, events, and contracts.
Validate all machine-generated state.
Do not blindly trust arbitrary model output.

LEAD

The Lead is itself one of the external AI terminals. Do not implement a separate proprietary reasoning model in the core application.
The orchestrator provides the Lead with:
- project objective
- team summary
- architecture
- project rules
- task protocol

WORKER INTERACTION

Every terminal must remain manually controllable by the user.
The user can:
- type into the terminal
- interrupt the AI
- stop/restart a worker
- inspect files
- run normal commands
- reassign tasks

DESIGN

The visual style should be premium, modern, dark-first, technical, and fast.
Prefer compact dense layouts over dashboard bloat.
Use side panels/drawers rather than deep navigation.

IMPLEMENTATION ORDER

1. Desktop shell
2. Project loading
3. Universal PTY/terminal layer
4. xterm.js terminal tabs
5. Worker management
6. `.ai-team` state and protocol
7. Team CLI
8. Task engine
9. Lead orchestration
10. Git worktrees
11. Activity/event system
12. Command Center UI polish
13. Reliability/recovery

TESTING

Create a fake terminal AI test harness so orchestration can be tested deterministically without real AI services.
Test multiple simultaneous workers, task dependencies, messaging, Git worktrees, process crashes, and merge conflicts.

DO NOT prematurely implement:
- cloud backend
- marketplace
- analytics suite
- automatic conflict resolution
- giant project management system

Build the smallest robust end-to-end system first.

Before making architectural decisions that affect portability, inspect the repository and existing conventions. Preserve working code where appropriate instead of replacing it unnecessarily.
```

---

# 87. Immediate Build Order

The best starting milestone is not the Lead AI.

Build this first:

```text
Tauri app
   |
   v
Project picker
   |
   v
Command Center
   |
   v
Add Worker
   |
   v
Spawn arbitrary command
   |
   v
PTy
   |
   v
xterm.js
   |
   v
Multiple terminal tabs
```

Once this is stable, the rest of the orchestration layer can be added on top.

The reason is simple: **the terminal system is the foundation of the entire product.** If the application cannot reliably run and expose arbitrary interactive coding CLIs, none of the higher-level AI teamwork features matter.

---

# 88. Final Product Vision

The finished experience should feel like this:

```text
+---------------------------------------------------------------------+
|  AI DEV TEAM                                        ● TEAM ACTIVE    |
+---------------------------------------------------------------------+
| COMMAND CENTER | CLAUDE | CODEX | AGY | OPENCODE | +              |
+---------------------------------------------------------------------+
|                                                                     |
|  BUILD SOMETHING GREAT                                              |
|  +---------------------------------------------------------------+  |
|  | One gigantic project objective...                            |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
|  TEAM                         TASK FLOW                             |
|  ┌───────────────────┐        ┌───────────────────────────────┐    |
|  │ ● Claude  LEAD    │        │ Architecture                   │    |
|  │ ● Codex   UI      │───────>│       ↓                       │    |
|  │ ● Agy     API     │───────>│ Backend ──> Frontend ──> QA   │    |
|  │ ◌ OpenCode QA     │        └───────────────────────────────┘    |
|  └───────────────────┘                                              |
|                                                                     |
|  LIVE                                                                  |
|  Claude assigned Backend API                                         |
|  Agy modified contract                                               |
|  Codex received notification                                          |
|  OpenCode waiting for integration                                    |
|                                                                     |
+---------------------------------------------------------------------+
```

The key feeling should be:

> **"I have several of the best coding AIs running at once, but they finally feel like one coherent development team."**

That is the product.
