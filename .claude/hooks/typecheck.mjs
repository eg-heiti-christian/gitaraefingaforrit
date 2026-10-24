// Stop hook: when TypeScript files have uncommitted changes, run the
// workspace typecheck and send any errors back to Claude to fix.
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
// Already continuing because of this hook: don't block again (avoids loops).
if (input.stop_hook_active) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const changed = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' });
if (!/\.tsx?$/m.test(changed)) process.exit(0);

const result = spawnSync('npm run typecheck --silent', {
  cwd: root,
  encoding: 'utf8',
  shell: true,
});
if (result.status === 0) process.exit(0);

const output = `${result.stdout}${result.stderr}`.trim().slice(-4000);
console.log(
  JSON.stringify({
    decision: 'block',
    reason: `npm run typecheck failed. Fix these errors:\n${output}`,
  }),
);
