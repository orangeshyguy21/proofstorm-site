import './environment.mjs';
import assert from 'node:assert/strict';
import { mkdir, rename, writeFile, rm } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { REPOSITORY, describeRelease, selectRelease, validateSnapshot, verifyBytes } from './release-lib.mjs';

const apiOrigin = 'https://api.github.com';
const destination = new URL('../src/data/release-snapshot.json', import.meta.url);
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

async function download(url, limit = 4 * 1024 * 1024) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const headers = { 'User-Agent': 'proofstorm-site-release-sync' };
    if (new URL(url).origin === apiOrigin) {
      headers.Accept = 'application/vnd.github+json';
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await response.body?.cancel();
      await setTimeout(1000 * (attempt + 1));
      continue;
    }
    assert(response.ok, `Download failed (${response.status}): ${url}`);
    assert(new URL(response.url).protocol === 'https:', 'Refusing an insecure download redirect');
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      assert(size <= limit, 'Release metadata download is too large');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  throw new Error('Download retries exhausted');
}

async function api(path) {
  return JSON.parse((await download(`${apiOrigin}/repos/${REPOSITORY}/${path}`)).toString('utf8'));
}

async function main() {
  const tag = process.env.RELEASE_TAG || undefined;
  const channel = process.env.RELEASE_CHANNEL || 'alpha';
  // Validate inputs before constructing a URL, including for pinned versions.
  assert(['alpha', 'stable'].includes(channel), 'RELEASE_CHANNEL must be alpha or stable');
  if (tag) assert(/^v\d+\.\d+\.\d+(?:-alpha\.\d+)?$/.test(tag), 'Invalid RELEASE_TAG');
  let releases = [];
  if (tag) {
    releases = [await api(`releases/tags/${tag}`)];
  } else {
    for (let page = 1; ; page++) {
      const batch = await api(`releases?per_page=100&page=${page}`);
      assert(Array.isArray(batch), 'Invalid releases response');
      releases.push(...batch);
      if (batch.length < 100) break;
      assert(page < 100, 'Release pagination limit exceeded');
    }
  }
  const selected = selectRelease(releases, { channel, tag });
  // Refetch the chosen release and its full, paginated asset inventory.
  const githubRelease = await api(`releases/${selected.id}`);
  assert.equal(githubRelease.tag_name, selected.tag_name, 'Release changed while selecting it');
  githubRelease.assets = [];
  for (let page = 1; ; page++) {
    const batch = await api(`releases/${selected.id}/assets?per_page=100&page=${page}`);
    assert(Array.isArray(batch), 'Invalid assets response');
    githubRelease.assets.push(...batch);
    if (batch.length < 100) break;
    assert(page < 100, 'Asset pagination limit exceeded');
  }
  const release = describeRelease(githubRelease);
  const installerBytes = await download(release.installer.url, 1024 * 1024);
  verifyBytes(installerBytes, release.installer);
  const installer = new TextDecoder('utf-8', { fatal: true }).decode(installerBytes);
  const checksums = {};
  for (const platform of release.platforms) {
    const bytes = await download(platform.checksum.url, 4096);
    verifyBytes(bytes, platform.checksum);
    checksums[platform.id] = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  // Only store public fields needed to independently recheck this snapshot offline.
  const evidence = {
    id: githubRelease.id, tag_name: githubRelease.tag_name, draft: githubRelease.draft,
    prerelease: githubRelease.prerelease, published_at: githubRelease.published_at,
    html_url: githubRelease.html_url,
    assets: githubRelease.assets.map(({ name, state, size, digest, browser_download_url }) => ({ name, state, size, digest, browser_download_url })),
  };
  const snapshot = { schema_version: 1, release, github_release: evidence, installer, checksums };
  validateSnapshot(snapshot);
  await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
  const temporary = new URL(`../src/data/release-snapshot.${process.pid}.tmp`, import.meta.url);
  try {
    await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  console.log(`Synced ${release.tag}: ${release.platforms.map((platform) => platform.id).join(', ')}. Installer and checksum receipts verified.`);
}

main().catch((error) => {
  console.error(`Release sync failed: ${error.message}. The previous snapshot was not replaced.`);
  process.exitCode = 1;
});
