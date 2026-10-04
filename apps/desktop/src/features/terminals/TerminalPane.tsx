import { useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import * as ipc from "../../lib/ipc";

const TERM_FONT =
  'ui-monospace, "SFMono-Regular", "Cascadia Mono", "JetBrains Mono", Menlo, Consolas, monospace';

export interface TerminalPaneProps {
  /** Live PTY session id; null while spawning or after exit. */
  sessionId: string | null;
  command: string;
  args?: string[];
  pid?: number | null;
  exitCode?: number | null;
  active: boolean;
  /** Called with the exit code when the session ends. */
  onExit?: (code: number) => void;
}

/**
 * A real terminal bound to one PTY session. Panes stay mounted while their
 * tab exists (hidden tabs keep rendering), so scrollback survives tab
 * switches. Terminal text is never animated.
 */
export function TerminalPane({
  sessionId,
  command,
  args,
  pid,
  exitCode,
  active,
  onExit,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(sessionId);

  sessionIdRef.current = sessionId;

  // Create the terminal once per pane.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily: TERM_FONT,
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 5000,
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: "#0b0e14",
        foreground: "#dfe6f1",
        cursor: "#5cc8ff",
        selectionBackground: "#24354a",
        black: "#0b0e14",
        red: "#f26d6d",
        green: "#3ecf8e",
        yellow: "#f5b453",
        blue: "#5cc8ff",
        magenta: "#b78cff",
        cyan: "#5ce4d0",
        white: "#dfe6f1",
        brightBlack: "#5b6474",
        brightRed: "#ff8b8b",
        brightGreen: "#63e0a8",
        brightYellow: "#ffca7a",
        brightBlue: "#82d6ff",
        brightMagenta: "#cdaaff",
        brightCyan: "#82f0e2",
        brightWhite: "#f2f6fc",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    try {
      fit.fit();
    } catch {
      // Container can be zero-sized when first hidden; resize observer fixes it.
    }
    termRef.current = term;
    fitRef.current = fit;

    const dataDisposable = term.onData((data) => {
      const id = sessionIdRef.current;
      if (id) void ipc.ptyWrite(id, data).catch(() => undefined);
    });

    return () => {
      dataDisposable.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  // Stream output + exit for the live session id.
  useEffect(() => {
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    void ipc
      .listenPtyOutput((payload) => {
        if (payload.id === sessionIdRef.current) {
          termRef.current?.write(ipc.decodeBase64(payload.data));
        }
      })
      .then((unlisten) => {
        if (disposed) unlisten();
        else unlisteners.push(unlisten);
      });

    void ipc
      .listenPtyExit((payload) => {
        if (payload.id === sessionIdRef.current) {
          termRef.current?.writeln("");
          termRef.current?.write(`\r\n\x1b[90m[process exited with code ${payload.code}]\x1b[0m\r\n`);
          onExit?.(payload.code);
        }
      })
      .then((unlisten) => {
        if (disposed) unlisten();
        else unlisteners.push(unlisten);
      });

    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [onExit]);

  // Keep the PTY size in sync with the pane.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const fit = fitRef.current;
        const term = termRef.current;
        if (!fit || !term) return;
        try {
          fit.fit();
        } catch {
          return;
        }
        const id = sessionIdRef.current;
        if (id) void ipc.ptyResize(id, term.rows, term.cols).catch(() => undefined);
      });
    });
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // Refit + focus when the tab becomes visible.
  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
      } catch {
        // ignore
      }
      termRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  const running = sessionId !== null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0b0e14]">
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-edge bg-panel px-3 text-xs">
        <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-ok animate-pulse-soft" : "bg-faint"}`} />
        <span className="font-mono text-ink/90">
          {command}
          {args && args.length > 0 ? ` ${args.join(" ")}` : ""}
        </span>
        <span className="ml-auto flex items-center gap-3 font-mono text-faint">
          {pid != null && <span>pid {pid}</span>}
          <span>{running ? "attached" : exitCode != null ? `exit ${exitCode}` : "detached"}</span>
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0 px-1 py-1" />
        {!running && (
          <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
            <span className="rounded-full border border-edge bg-panel px-3 py-1 text-xs text-faint">
              {exitCode != null
                ? `Process exited with code ${exitCode}`
                : "Spawning process…"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
