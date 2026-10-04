import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";

const STEPS = [
  { label: "Project", detail: "workspace bound" },
  { label: "Terminal", detail: "PTY layer ready" },
  { label: "Protocol", detail: ".ai-team connected" },
  { label: "Workers", detail: "roster loaded" },
];

/**
 * One-time startup sequence for a freshly opened project (spec §43).
 * Anime.js owns this decorative sequence; interface transitions stay in Motion.
 */
export function StartupSequence({
  projectName,
  workerCount,
  onDone,
}: {
  projectName: string;
  workerCount: number;
  onDone: () => void;
}) {
  const doneRef = useRef(false);
  const finishRef = useRef(onDone);
  finishRef.current = onDone;

  useEffect(() => {
    const finish = () => {
      if (!doneRef.current) {
        doneRef.current = true;
        finishRef.current();
      }
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      const timer = setTimeout(finish, 120);
      return () => clearTimeout(timer);
    }

    const rows = animate(".startup-row", {
      opacity: [0, 1],
      x: [-14, 0],
      delay: stagger(140, { start: 150 }),
      duration: 320,
      ease: "outQuad",
    });
    const checks = animate(".startup-check", {
      opacity: [0, 1],
      scale: [0.6, 1],
      delay: stagger(140, { start: 300 }),
      duration: 220,
      ease: "outQuad",
    });

    const exitTimer = setTimeout(finish, 1500);
    return () => {
      rows.pause();
      checks.pause();
      clearTimeout(exitTimer);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-base/95"
      role="status"
      aria-label="Team workspace starting"
    >
      <p className="text-[11px] font-semibold tracking-[0.3em] text-faint">AI DEV TEAM</p>
      <h1 className="mt-2 text-xl font-semibold text-ink">{projectName}</h1>
      <div className="mt-6 w-64 space-y-2">
        {STEPS.map((step) => (
          <div key={step.label} className="startup-row flex items-center gap-3 opacity-0">
            <span className="startup-check opacity-0 text-ok">✓</span>
            <span className="text-sm text-ink/90">{step.label}</span>
            <span className="ml-auto text-[11px] text-faint">
              {step.label === "Workers" ? `${workerCount} on roster` : step.detail}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-8 text-[10px] tracking-wide text-faint/70">
        entering the command center…
      </p>
    </div>
  );
}
