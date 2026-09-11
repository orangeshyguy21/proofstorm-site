import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const REPOSITORY = 'orangeshyguy21/proofstorm';
export const RELEASES_URL = `https://github.com/${REPOSITORY}/releases`;
export const PLATFORMS = [
  { id: 'linux-amd64', label: 'Linux', architecture: 'x86-64 / AMD64', target: 'x86_64-unknown-linux-gnu' },
  { id: 'macos-arm64', label: 'macOS', architecture: 'Apple Silicon / ARM64', target: 'aarch64-apple-darwin' },
];
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function parseTag(tag) {
  const match = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-alpha\.(0|[1-9]\d*))?$/.exec(tag);
  if (!match) return null;
  return { version: tag.slice(1), channel: match[4] === undefined ? 'stable' : 'alpha', order: match.slice(1).map((value) => BigInt(value ?? 0)) };
}

export function selectRelease(releases, { channel = 'alpha', tag } = {}) {
  assert(['alpha', 'stable'].includes(channel), 'RELEASE_CHANNEL must be alpha or stable');
  assert(Array.isArray(releases), 'GitHub releases response must be an array');
  if (tag) assert(parseTag(tag)?.channel === channel, 'RELEASE_TAG must be a valid tag in RELEASE_CHANNEL');
  const candidates = releases.filter((release) => {
    const parsed = parseTag(release.tag_name);
    return parsed?.channel === channel && release.draft === false &&
      release.prerelease === (channel === 'alpha') && Boolean(release.published_at) &&
      (!tag || release.tag_name === tag);
  });
  candidates.sort((a, b) => {
    const left = parseTag(a.tag_name).order;
    const right = parseTag(b.tag_name).order;
    for (let i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) return left[i] > right[i] ? -1 : 1;
    }
    return 0;
  });
  assert(candidates.length > 0, `No published ${tag || channel} release found`);
  // Select first, then validate. An incomplete newest release must fail the build.
  return candidates[0];
}

function digest(value) {
  assert.match(value ?? '', /^sha256:[0-9a-f]{64}$/, 'Published asset has no valid GitHub SHA-256 digest');
  return value.slice(7);
}

export function describeAsset(asset, tag) {
  assert(asset && /^[A-Za-z0-9._+-]+$/.test(asset.name), 'Invalid asset filename');
  const url = `${RELEASES_URL}/download/${tag}/${asset.name}`;
  assert.equal(asset.browser_download_url, url, 'Asset URL must belong to the exact official release');
  assert(asset.state === 'uploaded', `Asset is not uploaded: ${asset.name}`);
  assert(Number.isSafeInteger(asset.size) && asset.size > 0, 'Invalid asset size');
  return { name: asset.name, url, bytes: asset.size, sha256: digest(asset.digest) };
}

export function describeRelease(release) {
  const parsed = parseTag(release.tag_name);
  assert(parsed, 'Invalid release tag');
  assert.equal(release.draft, false, 'Draft releases cannot be served');
  assert.equal(release.prerelease, parsed.channel === 'alpha', 'Release channel mismatch');
  assert(Number.isSafeInteger(release.id) && release.id > 0, 'Invalid release identity');
  assert.equal(release.html_url, `${RELEASES_URL}/tag/${release.tag_name}`, 'Invalid release URL');
  assert(Number.isFinite(Date.parse(release.published_at)), 'Missing release publication date');
  assert(Array.isArray(release.assets), 'Missing release asset inventory');
  const inventory = new Map(release.assets.map((asset) => [asset.name, asset]));
  assert.equal(inventory.size, release.assets.length, 'Duplicate release asset names');
  const installer = describeAsset(inventory.get('install.sh'), release.tag_name);
  const platforms = [];
  for (const platform of PLATFORMS) {
    const prefix = `proofstorm-${parsed.version}-`;
    const archiveNames = [`${prefix}${platform.id}.tar.gz`, `${prefix}${platform.target}.tar.gz`];
    const names = archiveNames.filter((name) => inventory.has(name));
    assert(names.length <= 1, `Ambiguous archive for ${platform.id}`);
    if (names.length === 0) {
      assert(!archiveNames.some((name) => inventory.has(`${name}.sha256`)), 'Orphaned archive checksum');
      continue;
    }
    platforms.push({
      id: platform.id, label: platform.label, architecture: platform.architecture,
      archive: describeAsset(inventory.get(names[0]), release.tag_name),
      checksum: describeAsset(inventory.get(`${names[0]}.sha256`), release.tag_name),
    });
  }
  assert(platforms.length > 0, 'Release has no supported platform archives');
  return {
    schema_version: 1, repository: REPOSITORY, release_id: release.id,
    version: parsed.version, tag: release.tag_name, channel: parsed.channel,
    published_at: release.published_at, release_url: release.html_url,
    metadata_source: 'github-release-assets', installer, platforms,
  };
}

export function verifyBytes(bytes, asset) {
  assert.equal(bytes.length, asset.bytes, `Size mismatch: ${asset.name}`);
  assert.equal(sha256(bytes), asset.sha256, `SHA-256 mismatch: ${asset.name}`);
}

export function validateSnapshot(snapshot) {
  assert.equal(snapshot?.schema_version, 1, 'Unsupported snapshot schema');
  // Re-derive the public metadata from the captured API response, rather than trusting edited JSON.
  const expected = describeRelease(snapshot.github_release);
  assert.deepEqual(snapshot.release, expected, 'Snapshot metadata differs from the published asset inventory');
  assert.equal(typeof snapshot.installer, 'string', 'Missing installer');
  verifyBytes(Buffer.from(snapshot.installer, 'utf8'), expected.installer);
  const defaultVersion = /^install_version="([^"]+)"$/m.exec(snapshot.installer)?.[1];
  assert.equal(defaultVersion, expected.version, 'Installer default version does not match release');
  assert.deepEqual(Object.keys(snapshot.checksums).sort(), expected.platforms.map((platform) => platform.id).sort(), 'Checksum inventory mismatch');
  for (const platform of expected.platforms) {
    const receipt = snapshot.checksums[platform.id];
    assert.equal(typeof receipt, 'string', 'Missing checksum receipt');
    verifyBytes(Buffer.from(receipt, 'utf8'), platform.checksum);
    const match = /^([a-f0-9]{64})[ \t]+([^\s]+)\r?\n?$/.exec(receipt);
    assert(match, 'Invalid checksum receipt');
    assert.equal(match[1], platform.archive.sha256, 'Checksum receipt disagrees with GitHub archive digest');
    assert.equal(match[2], platform.archive.name, 'Checksum receipt names a different archive');
  }
  return expected;
}
