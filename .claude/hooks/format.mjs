// PostToolUse hook: run Prettier on the file Claude just wrote or edited.
// Respects .prettierignore; files Prettier can't parse are skipped.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const file = input.tool_response?.filePath ?? input.tool_input?.file_path;
if (!file) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const prettier = path.join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');

spawnSync(process.execPath, [prettier, '--write', '--ignore-unknown', '--log-level=warn', file], {
  cwd: root,
  stdio: 'inherit',
});
