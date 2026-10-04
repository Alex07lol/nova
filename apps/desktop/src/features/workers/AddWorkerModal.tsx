import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Square, X } from "lucide-react";
import * as ipc from "../../lib/ipc";
import type { SpawnResult } from "../../lib/ipc";
import { TerminalPane } from "../terminals/TerminalPane";

export interface AddWorkerModalProps {
  open: boolean;
  projectRoot: string;
  onClose: () => void;
  onAdd: (draft: {
    name: string;
    role: string;
    command: string;
    args: string[];
    cwd: string | null;
    capabilities: string[];
    autoStart: boolean;
    isLead: boolean;
  }) => Promise<void>;
}

const fieldLabel = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint";
const fieldInput =
  "w-full rounded-md border border-edge bg-panel-2 px-2.5 py-2 text-sm text-ink placeholder:text-faint/70 outline-none transition-colors duration-150 focus:border-accent/60";

interface TestState {
  session: SpawnResult;
  exitCode: number | null;
}

export function AddWorkerModal({ open, projectRoot, onClose, onAdd }: AddWorkerModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [cwd, setCwd] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [autoStart, setAutoStart] = useState(false);
  const [isLead, setIsLead] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [test, setTest] = useState<TestState | null>(null);

  const reset = () => {
    setName("");
    setRole("");
    setCommand("");
    setArgs("");
    setCwd("");
    setCapabilities("");
    setAutoStart(false);
    setIsLead(false);
    setFormError(null);
    setTest(null);
  };

  const parsedArgs = () =>
    args
      .trim()
      .split(/\s+/)
      .filter((segment) => segment.length > 0);

  const killTest = (session: TestState | null) => {
    if (session?.session.id && session.exitCode === null) {
      void ipc.ptyKill(session.session.id).catch(() => undefined);
    }
  };

  // Kill the test session when the modal closes.
  useEffect(() => {
    if (!open && test) killTest(test);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runTest = async () => {
    if (!command.trim()) {
      setFormError("Enter a command to test the terminal.");
      return;
    }
    if (test) {
      killTest(test);
      setTest(null);
      return;
    }
    setFormError(null);
    try {
      const session = await ipc.ptySpawn({
        command: command.trim(),
        args: parsedArgs(),
        cwd: cwd.trim() || projectRoot,
      });
      setTest({ session, exitCode: null });
    } catch (spawnError) {
      setFormError(`Test spawn failed: ${String(spawnError)}`);
    }
  };

  const submit = async () => {
    if (!name.trim() || !command.trim()) {
      setFormError("Name and command are required.");
      return;
    }
    killTest(test);
    setTest(null);
    await onAdd({
      name: name.trim(),
      role: role.trim() || "Contributor",
      command: command.trim(),
      args: parsedArgs(),
      cwd: cwd.trim() || null,
      capabilities: capabilities
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0),
      autoStart,
      isLead,
    });
    reset();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="modal-backdrop"
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => {
              killTest(test);
              onClose();
            }}
          />
          <motion.div
            key="modal-panel"
            role="dialog"
            aria-label="Add team member"
            className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[560px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-edge-2 bg-panel shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-edge px-5 py-3">
              <h2 className="text-sm font-semibold tracking-wide text-ink">ADD TEAM MEMBER</h2>
              <button
                type="button"
                aria-label="Close add worker dialog"
                onClick={() => {
                  killTest(test);
                  onClose();
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 px-5 py-4">
              <div>
                <label className={fieldLabel} htmlFor="worker-name">Name</label>
                <input
                  id="worker-name"
                  className={fieldInput}
                  placeholder="Codex Frontend"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className={fieldLabel} htmlFor="worker-role">Role</label>
                <input
                  id="worker-role"
                  className={fieldInput}
                  placeholder="Frontend Engineer"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                />
              </div>
              <div>
                <label className={fieldLabel} htmlFor="worker-command">Command</label>
                <input
                  id="worker-command"
                  className={`${fieldInput} font-mono`}
                  placeholder="claude / codex / agy / opencode / any CLI"
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  spellCheck={false}
                />
              </div>
              <div>
                <label className={fieldLabel} htmlFor="worker-args">Arguments</label>
                <input
                  id="worker-args"
                  className={`${fieldInput} font-mono`}
                  placeholder="--model opus"
                  value={args}
                  onChange={(event) => setArgs(event.target.value)}
                  spellCheck={false}
                />
              </div>
              <div className="col-span-2">
                <label className={fieldLabel} htmlFor="worker-cwd">
                  Working directory (defaults to project root)
                </label>
                <input
                  id="worker-cwd"
                  className={`${fieldInput} font-mono text-xs`}
                  placeholder={projectRoot}
                  value={cwd}
                  onChange={(event) => setCwd(event.target.value)}
                  spellCheck={false}
                />
              </div>
              <div className="col-span-2">
                <label className={fieldLabel} htmlFor="worker-capabilities">
                  Capabilities (comma separated)
                </label>
                <input
                  id="worker-capabilities"
                  className={fieldInput}
                  placeholder="frontend, react, css"
                  value={capabilities}
                  onChange={(event) => setCapabilities(event.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-accent"
                  checked={autoStart}
                  onChange={(event) => setAutoStart(event.target.checked)}
                />
                Auto-start when project opens
              </label>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-review"
                  checked={isLead}
                  onChange={(event) => setIsLead(event.target.checked)}
                />
                Designate as Lead
              </label>
            </div>

            {test && (
              <div className="mx-5 mb-4 overflow-hidden rounded-lg border border-edge">
                <TerminalPane
                  sessionId={test.session.id}
                  pid={test.session.pid}
                  command={command.trim()}
                  args={parsedArgs()}
                  exitCode={test.exitCode}
                  active
                  onExit={(code) => setTest((current) => (current ? { ...current, exitCode: code } : current))}
                />
              </div>
            )}

            {formError && (
              <p className="mx-5 mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {formError}
              </p>
            )}

            <div className="flex items-center justify-between border-t border-edge px-5 py-3">
              <button
                type="button"
                onClick={runTest}
                className="flex items-center gap-2 rounded-md border border-edge bg-panel-2 px-3 py-2 text-xs font-medium text-ink transition-colors duration-150 hover:border-edge-2"
              >
                {test ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {test ? "Stop Test" : "Test Terminal"}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    killTest(test);
                    onClose();
                  }}
                  className="rounded-md px-3 py-2 text-xs font-medium text-muted transition-colors duration-150 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  className="rounded-md border border-accent/40 bg-accent/15 px-4 py-2 text-xs font-semibold text-accent transition-colors duration-150 hover:bg-accent/25"
                >
                  Add Worker
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
