import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRegistry } from './verify-assets.mjs';

const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Build deterministic local byte receipts for a reviewed asset checkout.
 * These hashes do not establish release signature or publishing provenance.
 */
export function buildReceipts(registry, directory = checkout) {
  validateRegistry(registry, directory);
  const assets = registry.assets.map(({ id, source }) => {
    const bytes = readFileSync(join(directory, source));
    return {
      id,
      source,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  });
  assets.sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return { schema_version: 1, assets };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const registry = JSON.parse(readFileSync(join(checkout, 'branding/manifest.json'), 'utf8'));
  process.stdout.write(JSON.stringify(buildReceipts(registry), null, 2) + '\n');
}
