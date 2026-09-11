import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSnapshot, verifyBytes } from './release-lib.mjs';

const read = (path) => readFile(new URL(path, import.meta.url));
const snapshot = JSON.parse(await read('../src/data/release-snapshot.json'));
const release = validateSnapshot(snapshot);
verifyBytes(await read('../dist/install'), release.installer);
verifyBytes(await read('../dist/install.sh'), release.installer);
assert.deepEqual(JSON.parse(await read('../dist/release.json')), release, 'Built release metadata differs from the verified snapshot');
await read('../dist/404.html');
const html = (await read('../dist/index.html')).toString('utf8');
assert(/curl -fsSL https?:\/\/[^\s"<]+\/install \| sh/.test(html), 'Landing page must use the canonical /install endpoint');
assert(html.includes('View Proofstorm source on GitHub'), 'Landing page is missing the source link');
console.log('Canonical installer, legacy installer, release metadata, and landing page verified.');
