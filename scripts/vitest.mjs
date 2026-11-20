#!/usr/bin/env node
// Runs Vitest from a cwd with an upper-case drive letter.
// On Windows, a lower-case drive letter (VS Code terminals use "c:\") makes Vitest load
// itself twice and every suite fails with "Cannot read properties of undefined (reading 'config')".
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const cwd = process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const bin = join(cwd, 'node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
