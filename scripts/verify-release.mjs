import { readFile } from 'node:fs/promises';
import { validateSnapshot } from './release-lib.mjs';

try {
  const snapshot = JSON.parse(await readFile(new URL('../src/data/release-snapshot.json', import.meta.url), 'utf8'));
  const release = validateSnapshot(snapshot);
  console.log(`Verified ${release.tag}: installer and download metadata agree.`);
} catch (error) {
  console.error(`Release verification failed: ${error.message}`);
  process.exitCode = 1;
}
