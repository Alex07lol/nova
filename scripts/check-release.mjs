import { access, readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
if (packageJson.bin?.nova !== 'apps/cli/src/main.js') throw new Error('nova executable target is missing');
for (const file of ['README.md', 'LICENSE', 'CHANGELOG.md', packageJson.bin.nova]) await access(file);
if (!packageJson.files.includes('packages') || !packageJson.files.includes('skills')) throw new Error('release file allowlist is incomplete');
console.log(`release metadata ok: ${packageJson.name}@${packageJson.version}`);
