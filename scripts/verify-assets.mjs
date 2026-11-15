import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ID = /^[a-z][a-z0-9_]*$/;
const SOURCE = /^branding\/[A-Za-z0-9._/-]+$/;
const mediaExtensions = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/svg+xml': '.svg',
};
const roles = new Set(['application_branding', 'marketing_branding', 'documentation']);

export function validateRegistry(registry, directory = root) {
  if (!registry || registry.schema_version !== 1 ||
      !Array.isArray(registry.assets) || registry.assets.length < 1 ||
      registry.assets.length > 64 || Object.keys(registry).sort().join(',') !== 'assets,schema_version') {
    throw new Error('invalid brand manifest envelope');
  }
  const seen = new Set();
  for (const asset of registry.assets) {
    if (!asset || Object.keys(asset).sort().join(',') !== 'id,media_type,role,source' ||
        typeof asset.id !== 'string' || !ID.test(asset.id) || seen.has(asset.id)) {
      throw new Error('duplicate or malformed brand asset identifier');
    }
    seen.add(asset.id);
    if (typeof asset.source !== 'string' || asset.source.length > 256 ||
        !SOURCE.test(asset.source) || !asset.source.startsWith('branding/') ||
        asset.source.split('/').some(segment => !segment || segment === '.' || segment === '..') ||
        !Object.hasOwn(mediaExtensions, asset.media_type) || !roles.has(asset.role)) {
      throw new Error('invalid brand asset path or metadata');
    }
    const extension = mediaExtensions[asset.media_type];
    if (!asset.source.endsWith(extension) && !(asset.media_type === 'image/jpeg' && asset.source.endsWith('.jpeg'))) {
      throw new Error('brand asset extension does not match media type');
    }
    let location = resolve(directory);
    for (const segment of asset.source.split('/')) {
      location = join(location, segment);
      const stat = lstatSync(location);
      if (stat.isSymbolicLink()) throw new Error('brand asset symlinks are not admitted');
    }
    if (!location.startsWith(resolve(directory) + sep)) throw new Error('brand asset escapes checkout');
    const bytes = readFileSync(location);
    if (bytes.length === 0 || bytes.length > 20 * 1024 * 1024) throw new Error('invalid brand asset byte length');
    if (asset.media_type === 'image/png' &&
        !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new Error('invalid PNG signature');
    }
    if (asset.media_type === 'image/jpeg' &&
        !(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
      throw new Error('invalid JPEG signature');
    }
    if (asset.media_type === 'image/svg+xml' && !/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/.test(bytes.toString('utf8'))) {
      throw new Error('invalid SVG source');
    }
  }
  return registry.assets.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const registry = JSON.parse(readFileSync(join(root, 'branding/manifest.json'), 'utf8'));
  console.log('ClipTown assets verified: ' + validateRegistry(registry));
}
