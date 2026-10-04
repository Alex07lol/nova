# Nova Desktop: AI Dev Team Orchestrator

**Date:** 2026-09-13  
**Status:** Phase 1 - Visual Foundation  
**Author:** Claude Code

## Executive Summary

We're evolving Nova from a CLI-based agent runtime into a desktop application that orchestrates multiple Nova agent instances as a coordinated development team. This design document covers **Phase 1: Visual Foundation** - building the complete Command Center UI with Tauri, React, and mock data before connecting real backend orchestration.

## Context

**Current State:**
- Nova is a modular Node.js coding agent runtime
- CLI-based interface with packages for agents, events, tools, security, skills
- Bounded agent lifecycle with coordinator pattern
- Session management, verification, and discovery systems

**Target Vision:**
- Desktop application with visual Command Center
- Multiple Nova agent instances working as a coordinated team
- Each agent has a role (Lead, Frontend, Backend, QA)
- Git worktree isolation for concurrent work
- Task graph with dependencies
- Real-time activity feed and status visualization

**Phase 1 Scope:**
Build the complete UI shell with mock data to establish visual language, interaction patterns, and animation system before adding backend complexity.

## Architecture

### High-Level Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Tauri Desktop Application                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  React Frontend (TypeScript + Vite)                 │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │  Command Center                                 │ │   │
│  │  │  - Project Objective Input                      │ │   │
│  │  │  - Team Panel (Worker Cards)                    │ │   │
│  │  │  - Task Flow Visualization                      │ │   │
│  │  │  - Live Activity Feed                           │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │  Worker Tabs (xterm.js terminals - future)     │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  │  Styling: Tailwind + BKLIT UI + Motion.dev         │   │
│  └──────────────────┬───────────────────────────────────   │
│                     │ Tauri IPC (Phase 2+)                 │
│  ┌──────────────────▼───────────────────────────────────   │
│  │  Rust Backend (minimal for Phase 1)                 │   │
│  │  - Main window management                            │   │
│  │  - IPC command stubs                                 │   │
│  └──────────────────────────────────────────────────────   │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React 18+ with TypeScript
- Vite for build tooling
- Tailwind CSS for utility styling
- BKLIT UI for component foundation
- Motion.dev (Framer Motion) for UI transitions
- Anime.js for timeline-based sequences
- Zustand for state management
- xterm.js for terminal rendering (Phase 2+)

**Desktop Runtime:**
- Tauri 2.x
- Rust backend (minimal in Phase 1)
- SQLite for persistence (Phase 2+)

**Node.js Integration (Phase 2+):**
- Existing Nova packages remain as Node.js
- Rust spawns Nova agents as child processes
- IPC between Tauri and Node.js agents

## Phase 1: Visual Foundation

### Goals

1. Prove the visual design direction works
2. Establish component patterns and styling system
3. Validate UX flows with mock data
4. Build animation system (Motion.dev + Anime.js)
5. Create foundation for backend integration

### Deliverables

#### 1. Tauri Project Scaffold

**Location:** `apps/desktop/`

**Structure:**
```
apps/desktop/
├── src/                          # React frontend
│   ├── components/
│   │   ├── command-center/
│   │   │   ├── CommandCenter.tsx
│   │   │   ├── ProjectObjective.tsx
│   │   │   ├── TeamPanel.tsx
│   │   │   ├── TaskFlow.tsx
│   │   │   └── ActivityFeed.tsx
│   │   ├── workers/
│   │   │   ├── WorkerCard.tsx
│   │   │   ├── WorkerStatus.tsx
│   │   │   ├── AddWorkerModal.tsx
│   │   │   └── WorkerDetailPanel.tsx
│   │   ├── tasks/
│   │   │   ├── TaskGraph.tsx
│   │   │   └── TaskNode.tsx
│   │   ├── ui/                   # BKLIT UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Tabs.tsx
│   │   └── layout/
│   │       ├── TabBar.tsx
│   │       └── MainLayout.tsx
│   ├── features/
│   │   └── startup/
│   │       └── StartupSequence.tsx
│   ├── hooks/
│   │   ├── useWorkers.ts
│   │   ├── useTasks.ts
│   │   └── useActivity.ts
│   ├── stores/
│   │   └── teamStore.ts
│   ├── types/
│   │   ├── worker.ts
│   │   ├── task.ts
│   │   └── activity.ts
│   ├── styles/
│   │   └── globals.css
│   ├── utils/
│   │   └── mockData.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.html
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   └── commands.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── build.rs
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

#### 2. Visual Design System

**Theme: Premium Dark Developer Tool**

**Colors:**
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Base dark palette
        base: {
          bg: '#0a0a0a',        // Deep black background
          surface: '#141414',   // Card/panel background
          border: '#2a2a2a',    // Subtle borders
          hover: '#1a1a1a',     // Hover states
        },
        // Status colors
        status: {
          idle: '#64748b',      // Slate - idle worker
          working: '#10b981',   // Emerald - active work
          waiting: '#f59e0b',   // Amber - blocked/waiting
          blocked: '#ef4444',   // Red - error/blocked
          review: '#3b82f6',    // Blue - review state
          complete: '#22c55e',  // Green - completed
        },
        // UI accents
        accent: {
          primary: '#6366f1',   // Indigo - primary actions
          secondary: '#8b5cf6', // Violet - secondary
        }
      },
      // Typography
      fontFamily: {
        sans: ['Inter var', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    }
  }
}
```

**Spacing & Layout:**
- Compact, information-dense layouts
- Minimum window size: 1280x800
- Command Center takes full window
- Worker tabs appear as strip across top
- Side panels/drawers for details

**Typography:**
- UI text: Inter (system-ui fallback)
- Code/terminal: JetBrains Mono (monospace fallback)
- High contrast (WCAG AA minimum)

#### 3. Data Models (Mock)

**Worker:**
```typescript
interface Worker {
  id: string;                    // Unique worker ID
  name: string;                  // "Claude Lead", "Nova Frontend"
  role: string;                  // "Lead Engineer", "Frontend Developer"
  status: WorkerStatus;          // idle | working | waiting | blocked | review | error
  currentTask?: string;          // Task ID currently assigned
  capabilities: string[];        // ["react", "typescript", "ui"]
  lastActive?: string;           // ISO timestamp
  metadata?: {
    model?: string;              // "sonnet-4", "opus-5"
    branch?: string;             // Git branch
    worktree?: string;           // Worktree path
  };
}

type WorkerStatus = 
  | 'idle'      // Available for work
  | 'working'   // Actively executing task
  | 'waiting'   // Waiting on dependency
  | 'blocked'   // Blocked by issue
  | 'review'    // Work ready for review
  | 'error';    // Error state
```

**Task:**
```typescript
interface Task {
  id: string;                    // Unique task ID
  title: string;                 // "Implement authentication"
  description?: string;          // Detailed description
  assignee?: string;             // Worker ID
  status: TaskStatus;            // planned | assigned | working | blocked | review | complete
  priority: TaskPriority;        // low | medium | high | critical
  dependencies: string[];        // Task IDs that must complete first
  blockedBy?: string[];          // Task IDs blocking this one
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

type TaskStatus = 
  | 'planned'    // Created but not assigned
  | 'assigned'   // Assigned to worker
  | 'working'    // Worker actively working
  | 'blocked'    // Cannot proceed
  | 'review'     // Ready for review
  | 'complete'   // Finished and approved
  | 'cancelled'; // Cancelled

type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
```

**Activity Event:**
```typescript
interface ActivityEvent {
  id: string;
  timestamp: string;             // ISO timestamp
  type: ActivityEventType;
  actor: string;                 // Worker ID or 'system'
  message: string;               // Human-readable message
  metadata?: Record<string, any>;
}

type ActivityEventType =
  | 'worker.started'
  | 'worker.stopped'
  | 'task.created'
  | 'task.assigned'
  | 'task.completed'
  | 'message.sent'
  | 'contract.changed'
  | 'review.requested';
```

#### 4. Mock Data Provider

**Location:** `src/utils/mockData.ts`

Provides realistic mock data for:
- 4 workers: Lead, Frontend, Backend, QA
- 8-10 tasks with realistic dependencies
- 20+ activity events showing team coordination
- Simulated status transitions every few seconds

**Example Mock Workers:**
```typescript
export const mockWorkers: Worker[] = [
  {
    id: 'w1',
    name: 'Claude Lead',
    role: 'Lead Engineer',
    status: 'working',
    currentTask: 't1',
    capabilities: ['architecture', 'planning', 'review'],
    metadata: { model: 'opus-5', branch: 'main' }
  },
  {
    id: 'w2',
    name: 'Nova Frontend',
    role: 'Frontend Developer',
    status: 'working',
    currentTask: 't3',
    capabilities: ['react', 'typescript', 'ui', 'css'],
    metadata: { model: 'sonnet-4', branch: 'feature/ui', worktree: 'worktrees/frontend' }
  },
  {
    id: 'w3',
    name: 'Nova Backend',
    role: 'Backend Developer',
    status: 'waiting',
    capabilities: ['node', 'api', 'database'],
    metadata: { model: 'sonnet-4', branch: 'feature/api', worktree: 'worktrees/backend' }
  },
  {
    id: 'w4',
    name: 'Nova QA',
    role: 'QA Engineer',
    status: 'idle',
    capabilities: ['testing', 'debugging', 'verification'],
    metadata: { model: 'haiku-4', branch: 'main' }
  }
];
```

#### 5. Component Specifications

**CommandCenter.tsx**
- Main container component
- Tab bar at top (Command Center + worker tabs + add button)
- Four-quadrant layout:
  - Top: Project Objective (large)
  - Left: Team Panel
  - Center: Task Flow
  - Right: Activity Feed

**WorkerCard.tsx**
- Compact card showing worker state
- Status indicator (colored dot)
- Worker name and role
- Current task badge (if assigned)
- Click to open detail panel
- Hover effects with Motion.dev

**TaskGraph.tsx**
- Visual representation of task dependencies
- Nodes positioned using simple force layout or manual grid
- Connections show dependencies
- Node colors match task status
- Click node for task details
- Animate when dependencies unlock

**ActivityFeed.tsx**
- Scrollable timeline of events
- Newest at top
- Event type icons
- Timestamp (relative: "2 min ago")
- Color-coded by event type
- Auto-scroll to new events

**StartupSequence.tsx**
- One-time animated sequence
- Shows: "NOVA DEV TEAM" branding
- Checklist animation:
  - ✓ Project loaded
  - ✓ Git initialized
  - ✓ Workers ready
  - ✓ Protocol active
- "ENTER TEAM" button
- Uses Anime.js timeline
- After first load, goes directly to Command Center

#### 6. Animation Specifications

**Motion.dev (UI Transitions):**

All component-level transitions use Motion.dev:

```tsx
// Worker card appearance
<motion.div
  initial={{ opacity: 0, scale: 0.9, y: 20 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.9 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
>
  <WorkerCard />
</motion.div>

// Status change animation
<motion.div
  animate={{ 
    backgroundColor: statusColor,
    scale: [1, 1.1, 1]
  }}
  transition={{ duration: 0.3 }}
>
  <StatusIndicator />
</motion.div>

// Task node unlock (dependency completed)
<motion.div
  animate={{
    scale: [1, 1.15, 1],
    boxShadow: [
      '0 0 0px rgba(16, 185, 129, 0)',
      '0 0 20px rgba(16, 185, 129, 0.6)',
      '0 0 0px rgba(16, 185, 129, 0)'
    ]
  }}
  transition={{ duration: 0.6 }}
>
  <TaskNode />
</motion.div>

// Panel slide-in
<motion.div
  initial={{ x: '100%' }}
  animate={{ x: 0 }}
  exit={{ x: '100%' }}
  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
>
  <WorkerDetailPanel />
</motion.div>
```

**Timing:**
- Fast: 120-180ms (hover, small state changes)
- Normal: 200-280ms (standard transitions)
- Large: 300-500ms (panel slides, modal open/close)

**Anime.js (Startup Sequence):**

One-time timeline for app initialization:

```typescript
// features/startup/StartupSequence.tsx
anime.timeline({ easing: 'easeOutExpo' })
  .add({
    targets: '.startup-logo',
    opacity: [0, 1],
    scale: [0.8, 1],
    duration: 800
  })
  .add({
    targets: '.startup-title',
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 600,
    offset: '-=400'
  })
  .add({
    targets: '.checklist-item',
    opacity: [0, 1],
    translateX: [-30, 0],
    delay: anime.stagger(150),
    duration: 400
  })
  .add({
    targets: '.enter-button',
    opacity: [0, 1],
    scale: [0.9, 1],
    duration: 500,
    offset: '+=200'
  });
```

**Accessibility (Reduced Motion):**

```css
/* globals.css */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Disable Anime.js startup sequence, keep functional Motion transitions at minimal duration.

#### 7. State Management

**Zustand Store** (`stores/teamStore.ts`):

```typescript
interface TeamState {
  // Data
  workers: Worker[];
  tasks: Task[];
  activities: ActivityEvent[];
  projectObjective: string;
  
  // UI State
  activeTab: string;
  selectedWorker: string | null;
  isAddWorkerOpen: boolean;
  
  // Actions
  setProjectObjective: (objective: string) => void;
  addWorker: (worker: Worker) => void;
  updateWorkerStatus: (id: string, status: WorkerStatus) => void;
  createTask: (task: Task) => void;
  assignTask: (taskId: string, workerId: string) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  addActivity: (event: ActivityEvent) => void;
  selectWorker: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
}
```

**Custom Hooks:**

```typescript
// hooks/useWorkers.ts
export function useWorkers() {
  const workers = useTeamStore(state => state.workers);
  const updateStatus = useTeamStore(state => state.updateWorkerStatus);
  return { workers, updateStatus };
}

// hooks/useTasks.ts
export function useTasks() {
  const tasks = useTeamStore(state => state.tasks);
  const createTask = useTeamStore(state => state.createTask);
  const assignTask = useTeamStore(state => state.assignTask);
  return { tasks, createTask, assignTask };
}

// hooks/useActivity.ts
export function useActivity() {
  const activities = useTeamStore(state => state.activities);
  return { activities };
}
```

#### 8. BKLIT UI Integration

Use BKLIT UI for foundational components:

- **Button** - Primary actions, secondary actions, icon buttons
- **Card** - Worker cards, task cards, info panels
- **Badge** - Status indicators, capability tags
- **Input/Textarea** - Project objective input
- **Modal** - Add worker dialog
- **Tabs** - Tab bar navigation
- **Drawer** - Worker detail panel (side panel)

Customize BKLIT components with Tailwind utilities to match dark theme.

#### 9. Responsive Behavior

**Minimum Target:** 1280x800

**Breakpoints:**
- < 1280px: Collapse side panels, stack vertically
- 1280px - 1600px: Standard two-column layout
- 1600px+: Three-column layout with wider task graph

**Mobile:** Not a priority for Phase 1. Desktop-first.

#### 10. Empty States

**No Workers:**
```
       Build with your AI team.

 Add Nova agents to start coordinating
      development work visually.

        [+ Add First Worker]
```

**No Tasks:**
```
     Enter a project objective above
       to let the team create tasks.
```

**No Activity:**
```
       Team activity will appear here
          as workers collaborate.
```

## Phase 2+ (Future)

After Phase 1 visual foundation is complete:

**Phase 2: Backend Integration**
- Rust PTY management for spawning Nova agents
- IPC commands between Tauri and React
- SQLite for persistent team state
- Real Nova agent process spawning

**Phase 3: Git Worktrees**
- Automatic worktree creation per worker
- Branch management
- Commit tracking
- Diff display

**Phase 4: Team Protocol**
- `.nova-team/` directory structure
- Task assignment system
- Worker-to-worker messaging
- Contract publication

**Phase 5: Terminal Integration**
- xterm.js terminals for each worker
- Real stdout/stderr streaming
- Interactive terminal input

## Development Workflow

### Setup

```bash
# Install Tauri prerequisites (Rust, system deps)
# See: https://tauri.app/v2/guides/getting-started/prerequisites

cd apps/desktop
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

### Testing Strategy

Phase 1 focuses on **visual testing**:
- Manual interaction testing
- Visual regression with screenshots
- Accessibility checks (keyboard nav, contrast, reduced motion)
- Different window sizes

No unit tests for mock data components initially - will add when connecting real backend.

## Success Criteria

Phase 1 is successful when:

1. ✅ Tauri app opens with Command Center visible
2. ✅ Dark theme looks polished and professional
3. ✅ All four mock workers display with correct status colors
4. ✅ Mock tasks show in graph with dependency connections
5. ✅ Activity feed displays events in chronological order
6. ✅ Animations work smoothly (Motion.dev + Anime.js)
7. ✅ "Add Worker" modal opens/closes
8. ✅ Worker detail panel slides in on card click
9. ✅ Tab bar shows Command Center tab + worker tabs + add button
10. ✅ Startup sequence plays once on first launch
11. ✅ Reduced motion preference disables decorative animations
12. ✅ Keyboard navigation works for all interactive elements
13. ✅ Application feels like a premium developer tool

## Open Questions

None - Phase 1 scope is well-defined with mock data. Backend integration decisions deferred to Phase 2.

## References

- Original AI Dev Team Orchestrator spec: `ai-dev-team-orchestrator.md`
- Nova current architecture: `README.md`, `progress.md`
- Tauri documentation: https://tauri.app/
- Motion.dev (Framer Motion): https://motion.dev/
- Anime.js: https://animejs.com/
- BKLIT UI: (component library reference - add link when available)

## Approval

This spec covers the visual foundation (Phase 1) for Nova Desktop. Once approved, implementation can proceed with parallel subagent work on:
1. Tauri scaffold
2. Styling system setup
3. Command Center layout
4. Worker components
5. Task visualization
6. Mock data layer
7. Animation integration
8. Startup sequence

---

**Next Steps:** Review and approve this specification, then invoke `writing-plans` skill to create detailed implementation plan.
