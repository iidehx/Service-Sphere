// Cross-platform replacement for the old `sh -c` preinstall guard: removes
// lockfiles from other package managers and refuses to run under npm/yarn.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
for (const lockfile of ['package-lock.json', 'yarn.lock']) {
  fs.rmSync(path.join(root, lockfile), { force: true });
}

if (!(process.env.npm_config_user_agent || '').startsWith('pnpm/')) {
  console.error('Use pnpm instead');
  process.exit(1);
}
