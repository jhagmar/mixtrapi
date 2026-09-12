#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const forbidden = /from ['"]node:|require\(|from ['"]fs['"]|from ['"]path['"]/;

const names = await readdir(root);
let failed = false;
for (const name of names) {
  if (!name.endsWith('.js')) {
    continue;
  }
  const text = await readFile(join(root, name), 'utf8');
  if (forbidden.test(text)) {
    console.error(`${name} imports a Node host module`);
    failed = true;
  }
}
if (failed) {
  process.exit(1);
}
