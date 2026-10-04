/**
 * Pure selection math for the MESSAGES panel keyboard triage (spec: j/k to
 * move, r to reply, Enter to send). Kept free of React so `node --test` can
 * verify it directly from test/message-keys.test.js.
 */

/**
 * Compute the next selected row index for a j/k keystroke.
 *
 * `currentIndex` is -1 when nothing is selected: j enters from the top of
 * the list, k from the bottom. Movement clamps at both edges; an empty list
 * always yields -1.
 */
export function nextSelectedIndex(
  count: number,
  currentIndex: number,
  key: "j" | "k",
): number {
  if (count <= 0) return -1;
  if (currentIndex < 0 || currentIndex > count - 1) {
    return key === "j" ? 0 : count - 1;
  }
  const delta = key === "j" ? 1 : -1;
  return Math.min(Math.max(currentIndex + delta, 0), count - 1);
}
