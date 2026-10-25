// Stop hook: when TypeScript files have uncommitted changes, run the
// workspace typecheck and send any errors back to Claude to fix.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
// Already continuing because of this hook: don't block again (avoids loops).
if (input.stop_hook_active) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

// -z keeps paths unquoted; --untracked-files=all lists files inside new folders.
let status;
try {
  status = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], {
    cwd: root,
    encoding: 'utf8',
  });
} catch {
  process.exit(0);
}

const entries = [];
const fields = status.split('\0');
for (let i = 0; i < fields.length; i++) {
  const field = fields[i];
  if (!field) continue;
  const code = field.slice(0, 2);
  entries.push({ code, path: field.slice(3) });
  // Renames and copies are followed by the original path.
  if (/[RC]/.test(code)) i++;
}
const tsEntries = entries.filter((e) => /\.[cm]?tsx?$/.test(e.path));
if (tsEntries.length === 0) process.exit(0);

// Skip when the changed TS files are the same as at the last run, so turns
// that edit nothing don't re-run tsc or re-report the same errors.
const fingerprint = createHash('sha256');
for (const { code, path } of tsEntries) {
  let stamp = 'missing';
  try {
    const s = statSync(join(root, path));
    stamp = `${s.mtimeMs}:${s.size}`;
  } catch {
    // Deleted file: the status code alone identifies it.
  }
  fingerprint.update(`${code} ${path} ${stamp}\n`);
}
const digest = fingerprint.digest('hex');
const rootKey = createHash('sha256').update(root).digest('hex').slice(0, 16);
const stateFile = join(tmpdir(), `claude-typecheck-${rootKey}.txt`);
try {
  if (readFileSync(stateFile, 'utf8') === digest) process.exit(0);
} catch {
  // No previous run recorded.
}
try {
  writeFileSync(stateFile, digest);
} catch {
  // Can't record this run: the next one just typechecks again.
}

const result = spawnSync('npm run typecheck --silent', {
  cwd: root,
  encoding: 'utf8',
  shell: true,
});
if (result.status === 0) process.exit(0);

let reason;
if (result.error || result.status === null) {
  const cause = result.error?.message ?? `killed by signal ${result.signal}`;
  reason = `npm run typecheck could not finish (${cause}). Run it manually to check for errors.`;
} else {
  const output = `${result.stdout}${result.stderr}`.trim().slice(-4000);
  reason = output
    ? `npm run typecheck failed. Fix these errors:\n${output}`
    : `npm run typecheck exited with code ${result.status} and printed nothing. Run it manually to see why.`;
}
console.log(JSON.stringify({ decision: 'block', reason }));
