import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRegistry } from '../scripts/verify-assets.mjs';

const original = JSON.parse(readFileSync(new URL('../branding/manifest.json', import.meta.url), 'utf8'));
test('tracked registry and binary logo are valid', () => {
  assert.equal(validateRegistry(original), 1);
});

test('manifest integrity refuses traversal, duplicate IDs, swapped bytes and symlinks', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'cliptown-assets-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'branding'));
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  writeFileSync(join(root, 'branding', 'logo.png'), png);
  const asset = { id: 'logo', source: 'branding/logo.png', media_type: 'image/png', role: 'application_branding' };
  const valid = { schema_version: 1, assets: [asset] };
  assert.equal(validateRegistry(valid, root), 1);
  const invalid = [
    { ...valid, assets: [{ ...asset, source: 'branding/../secret.png' }] },
    { ...valid, assets: [{ ...asset, source: 'branding//logo.png' }] },
    { ...valid, assets: [{ ...asset, source: '../branding/logo.png' }] },
    { ...valid, assets: [asset, asset] },
    { ...valid, assets: [{ ...asset, media_type: 'image/jpeg' }] },
    { ...valid, assets: [{ ...asset, id: 'logo', credential: 'nope' }] },
    { ...valid, assets: [{ ...asset, role: 'admin' }] },
  ];
  for (const candidate of invalid) assert.throws(() => validateRegistry(candidate, root));
  writeFileSync(join(root, 'branding', 'logo.png'), Buffer.from('not a PNG'));
  assert.throws(() => validateRegistry(valid, root), /PNG signature/);
  symlinkSync('missing.png', join(root, 'branding', 'linked.png'));
  assert.throws(
    () => validateRegistry({ schema_version: 1, assets: [{ ...asset, source: 'branding/linked.png' }] }, root),
    /symlinks/,
  );
});
