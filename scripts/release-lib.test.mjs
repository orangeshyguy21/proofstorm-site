import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { describeRelease, parseTag, selectRelease, sha256, validateSnapshot } from './release-lib.mjs';

const fixture = JSON.parse(readFileSync(new URL('../src/data/release-snapshot.json', import.meta.url), 'utf8'));
const fresh = () => structuredClone(fixture);
const candidate = (tag, extra = {}) => ({ ...fixture.github_release, tag_name: tag, prerelease: tag.includes('-alpha.'), ...extra });

test('alpha selection uses numeric version precedence, excludes drafts and other channels', () => {
  const selected = selectRelease([
    candidate('v0.1.0-alpha.2', { published_at: '2026-09-11T00:00:00Z' }),
    candidate('v0.1.0-alpha.10', { published_at: '2026-09-10T00:00:00Z' }),
    candidate('v0.1.0-alpha.11', { draft: true }),
    candidate('v2.0.0'), candidate('v9.0.0-beta.1'),
  ]);
  assert.equal(selected.tag_name, 'v0.1.0-alpha.10');
});

test('stable and exact-tag selection are explicit', () => {
  const releases = [candidate('v1.9.0'), candidate('v1.10.0'), candidate('v2.0.0-alpha.1')];
  assert.equal(selectRelease(releases, { channel: 'stable' }).tag_name, 'v1.10.0');
  assert.equal(selectRelease(releases, { channel: 'stable', tag: 'v1.9.0' }).tag_name, 'v1.9.0');
  assert.throws(() => selectRelease(releases, { tag: 'v1.9.0' }), /RELEASE_TAG/);
  assert.throws(() => selectRelease(releases, { channel: 'beta' }), /RELEASE_CHANNEL/);
  assert.throws(() => selectRelease([], { tag: 'v0.1.0-alpha.8' }), /No published/);
  assert.equal(parseTag('v01.2.3'), null);
});

test('the saved public installer and all checksum receipts verify offline', () => {
  assert.equal(validateSnapshot(fresh()).tag, fixture.release.tag);
});

test('an incomplete newer release fails instead of silently promoting an older one', () => {
  const newer = candidate('v0.1.0-alpha.100', {
    html_url: 'https://github.com/orangeshyguy21/proofstorm/releases/tag/v0.1.0-alpha.100', assets: [],
  });
  const selected = selectRelease([fixture.github_release, newer]);
  assert.equal(selected.tag_name, newer.tag_name);
  assert.throws(() => describeRelease(selected), /Invalid asset/);
});

test('altered installer bytes and mismatched default versions are rejected', () => {
  const corrupt = fresh();
  corrupt.installer += '\n';
  assert.throws(() => validateSnapshot(corrupt), /Size mismatch/);
  const mismatched = fresh();
  mismatched.installer = mismatched.installer.replace(/^install_version="[^"]+"$/m, 'install_version="9.9.9"');
  const asset = mismatched.github_release.assets.find((entry) => entry.name === 'install.sh');
  asset.size = Buffer.byteLength(mismatched.installer);
  asset.digest = `sha256:${sha256(mismatched.installer)}`;
  mismatched.release = describeRelease(mismatched.github_release);
  assert.throws(() => validateSnapshot(mismatched), /default version/);
});

test('a validly hashed receipt must name and hash the matching archive', () => {
  for (const mutation of ['filename', 'digest']) {
    const snapshot = fresh();
    const platform = snapshot.release.platforms[0];
    const receipt = mutation === 'filename'
      ? `${platform.archive.sha256}  other.tar.gz\n`
      : `${'0'.repeat(64)}  ${platform.archive.name}\n`;
    snapshot.checksums[platform.id] = receipt;
    const asset = snapshot.github_release.assets.find((entry) => entry.name === platform.checksum.name);
    asset.size = Buffer.byteLength(receipt);
    asset.digest = `sha256:${sha256(receipt)}`;
    snapshot.release = describeRelease(snapshot.github_release);
    assert.throws(() => validateSnapshot(snapshot), /different archive|disagrees/);
  }
});

test('foreign URLs, missing hashes, duplicate assets, and missing checksums are rejected', () => {
  const foreign = fresh().github_release;
  foreign.assets.find((asset) => asset.name === 'install.sh').browser_download_url = 'https://example.com/install.sh';
  assert.throws(() => describeRelease(foreign), /official release/);
  const unsigned = fresh().github_release;
  unsigned.assets.find((asset) => asset.name === 'install.sh').digest = null;
  assert.throws(() => describeRelease(unsigned), /SHA-256 digest/);
  const duplicate = fresh().github_release;
  duplicate.assets.push(duplicate.assets[0]);
  assert.throws(() => describeRelease(duplicate), /Duplicate/);
  const missing = fresh().github_release;
  missing.assets = missing.assets.filter((asset) => !asset.name.endsWith('.sha256'));
  assert.throws(() => describeRelease(missing), /Invalid asset/);
});

test('legacy target names and new platform filenames produce the same platform identity', () => {
  for (const suffix of ['x86_64-unknown-linux-gnu', 'linux-amd64']) {
    const release = fresh().github_release;
    for (const asset of release.assets) {
      asset.name = asset.name.replace(/x86_64-unknown-linux-gnu|linux-amd64/g, suffix);
      asset.browser_download_url = asset.browser_download_url.replace(/x86_64-unknown-linux-gnu|linux-amd64/g, suffix);
    }
    const linux = describeRelease(release).platforms.find((platform) => platform.id === 'linux-amd64');
    assert(linux);
    assert(linux.archive.name.endsWith(`-${suffix}.tar.gz`));
  }
});
