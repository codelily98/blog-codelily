import { cp, access, mkdir } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const app = path.join(root, 'apps/code-lily');
const target = path.join(app, '.next/standalone/apps/code-lily');
await mkdir(path.join(target, '.next'), { recursive: true });
await cp(path.join(app, '.next/static'), path.join(target, '.next/static'), { recursive: true });
try {
  await access(path.join(app, 'public'));
  await cp(path.join(app, 'public'), path.join(target, 'public'), { recursive: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
console.log('Standalone static assets prepared.');
