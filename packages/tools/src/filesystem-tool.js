import { resolve, relative, isAbsolute } from 'node:path';
import { detectWorkspace, readWorkspaceFile } from '../../context/src/workspace.js';

function safePath(root, requestedPath) {
  const target = resolve(root, requestedPath);
  const rel = relative(root, target);
  if (isAbsolute(rel) || rel.startsWith('..')) throw new Error(`Path escapes workspace: ${requestedPath}`);
  return rel;
}

export function createFilesystemTool({ root, policy }) {
  return {
    name: 'filesystem',
    async inspect() {
      policy.assert('filesystem.read');
      return detectWorkspace(root);
    },
    async read(path) {
      policy.assert('filesystem.read');
      return readWorkspaceFile(root, safePath(root, path));
    }
  };
}
