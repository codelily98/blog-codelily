import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries
        .filter((entry) => !['node_modules', '.next'].includes(entry.name))
        .map((entry) =>
          entry.isDirectory()
            ? files(path.join(directory, entry.name))
            : /\.(ts|tsx|mjs)$/.test(entry.name)
              ? [path.join(directory, entry.name)]
              : [],
        ),
    )
  ).flat();
}
const errors = [];
for (const file of [...(await files('apps')), ...(await files('packages'))]) {
  const content = await readFile(file, 'utf8');
  const normalized = file.replaceAll('\\', '/');
  const imports = [...content.matchAll(/(?:from\s*|import\s*\(|import\s*)['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  );
  for (const specifier of imports) {
    if (normalized.startsWith('packages/') && /(?:@\/|apps\/|code-lily)/.test(specifier))
      errors.push(`${file}: shared package imports an app`);
    if (
      normalized.startsWith('apps/') &&
      /^(suneditor(?:\/|$)|chart\.js|react-chartjs-2|tabulator-tables)/.test(specifier)
    )
      errors.push(`${file}: use shared library wrappers`);
    if (
      normalized.includes('/domain/') &&
      /(?:infrastructure|presentation|next\/|pg$|better-auth)/.test(specifier)
    )
      errors.push(`${file}: domain depends on an outer layer`);
    if (
      normalized.includes('/application/') &&
      /(?:infrastructure|presentation|next\/|pg$)/.test(specifier)
    )
      errors.push(`${file}: application depends on an adapter`);
    if (/apps\/(?!code-lily)/.test(specifier)) errors.push(`${file}: cross-app import`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Module boundaries passed: apps/shared, domain/application, UI library wrappers.');
