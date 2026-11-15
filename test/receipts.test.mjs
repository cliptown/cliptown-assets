import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildReceipts } from '../scripts/asset-receipts.mjs';

test('produces reproducible byte receipts sorted by stable asset identifier', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'cliptown-receipts-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'branding'));
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  writeFileSync(join(root, 'branding', 'second.png'), png);
  writeFileSync(join(root, 'branding', 'first.png'), png);
  const asset = (id, source) => ({
    id, source, media_type: 'image/png', role: 'application_branding',
  });
  const registry = {
    schema_version: 1,
    assets: [asset('second', 'branding/second.png'), asset('first', 'branding/first.png')],
  };
  const receipts = buildReceipts(registry, root);
  assert.deepEqual(receipts.assets.map(({ id }) => id), ['first', 'second']);
  const digest = createHash('sha256').update(png).digest('hex');
  for (const item of receipts.assets) {
    assert.equal(item.bytes, png.length);
    assert.equal(item.sha256, digest);
  }
  assert.deepEqual(buildReceipts(registry, root), receipts);
});

test('does not issue receipts for symlinks or traversal', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'cliptown-receipts-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'branding'));
  writeFileSync(join(root, 'branding', 'logo.png'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  symlinkSync('logo.png', join(root, 'branding', 'alias.png'));
  const asset = { id: 'logo', source: 'branding/alias.png', media_type: 'image/png', role: 'application_branding' };
  assert.throws(() => buildReceipts({ schema_version: 1, assets: [asset] }, root), /symlinks/);
  assert.throws(() => buildReceipts({
    schema_version: 1, assets: [{ ...asset, source: 'branding/../logo.png' }],
  }, root));
});
