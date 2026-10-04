export function createTextDiff(path, before, after) {
  if (before === after) return '';
  const oldLines = (before || '').split('\n');
  const newLines = (after || '').split('\n');
  const lines = [`--- a/${path}`, `+++ b/${path}`];
  const max = Math.max(oldLines.length, newLines.length);
  for (let index = 0; index < max; index += 1) {
    if (oldLines[index] !== newLines[index]) {
      if (oldLines[index] !== undefined) lines.push(`-${oldLines[index]}`);
      if (newLines[index] !== undefined) lines.push(`+${newLines[index]}`);
    }
  }
  return lines.join('\n');
}
