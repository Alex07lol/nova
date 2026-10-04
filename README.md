# NOVA

NOVA is an open-source, modular coding-agent runtime designed around explicit tools, permission boundaries, skills, and specialized agents.

## Quick start

```bash
npm test
npm start -- "Explain this project"
npm start -- sessions
npm start -- resume <session-id> "Continue the investigation"
npm start -- verify
npm start -- verification list
npm start -- verification inspect <run-id>
npm start -- skills list
npm start -- skills inspect filesystem
npm start -- skills install ./path/to/skill
npm start -- skills enable example-skill
npm start -- skills disable example-skill
npm start -- skills remove example-skill
npm start -- discover "PDF generation"
nova ci --json
```

CI execution requires explicit opt-in for process execution:

```bash
NOVA_CI_ALLOW_EXECUTION=1 npm start -- ci --json

npm start -- "Explain this project" --json
npm start -- "Explain this project" --json-events
```

The first milestone is intentionally offline and deterministic. It detects the workspace, loads built-in skills, runs a bounded agent workflow, and reports structured activity without requiring provider credentials.

## Layout

- `apps/cli` — terminal entry point
- `packages/agent` — bounded lifecycle runtime
- `packages/agents` — role registry and coordinator
- `packages/context` — workspace discovery
- `packages/events` — structured event bus
- `packages/providers` — model provider contracts and mock provider
- `packages/security` — permission policy boundary
- `packages/skills` — skill manifest loading and validation
- `packages/tools` — explicit tool implementations
- `skills/builtin` — built-in skill manifests
