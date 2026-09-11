# Proofstorm site

The minimal alpha landing page and installer endpoint for [Proofstorm](https://github.com/orangeshyguy21/proofstorm), built with **Astro 7 + Tailwind CSS 4**. The output is a static Cloudflare Pages site with no server adapter or application database.

## Local development

Use Node 22.12 or newer. `.node-version` pins the version used for this project.

```sh
npm ci
npm run dev
```

Open the local address Astro prints. Astro 7 manages its development server in the background; use `npx astro dev status`, `npx astro dev logs`, and `npx astro dev stop` to manage it.

The checked-in release snapshot lets development and regular builds work without fetching GitHub. It contains the public release metadata, the exact published installer, and its platform checksum receipts. It is generated data, not a second installer implementation.

```sh
npm test
npm run check
npm run build
```

`build` verifies the saved release before compiling and then verifies the generated download endpoints. The static output is `dist/`.

## Updating release data

```sh
npm run sync:release
```

The default channel is `alpha`. Selection uses semantic version ordering, excludes drafts, and includes published alpha prereleases. The newest candidate must validate; an incomplete release causes failure rather than a fallback. Unsupported platforms are not advertised as downloadable.

The sync checks GitHub asset digests, downloads and verifies the installer and checksum receipts, and requires the installer's default version to match the tag. It supports both legacy Rust target filenames and the new `linux-amd64` / `macos-arm64` filenames. Archives remain on GitHub and are checksum-verified by the installer when a user downloads them.

All validation happens before the snapshot is replaced with an atomic rename. Failed syncs leave the previous snapshot untouched. These hashes establish byte consistency; they are not publisher signatures.

Copy `.env.example` to `.env` to configure local defaults, or supply environment variables directly:

```sh
RELEASE_TAG=v0.1.0-alpha.2 npm run sync:release
RELEASE_CHANNEL=stable npm run sync:release
```

An exact tag must belong to the selected channel. A stable build intentionally fails until a stable release exists. An optional `GITHUB_TOKEN` (or `GH_TOKEN`) is used only for GitHub API requests; it is never sent to asset hosts or emitted into the site.

The public origin defaults to `https://proofstorm.com`. The install command is `curl -fsSL https://proofstorm.com/install | sh`. The extensionless `/install` endpoint serves the exact verified release installer; `/install.sh` remains a compatible alias. Set `SITE_URL` only to override the origin deliberately. The production domain is not connected by local development.

## Cloudflare Pages setup

Connect this repository through Cloudflare's Git integration:

| Setting | Value |
| --- | --- |
| Production branch | `master` |
| Build command | `npm run build:pages` |
| Build output directory | `dist` |
| Node version | Set `NODE_VERSION` to the value in `.node-version` |
| `SITE_URL` | `https://proofstorm.com` (also the default) |
| `RELEASE_CHANNEL` | `alpha` |

`build:pages` refreshes the release snapshot, verifies it, builds the page, and checks that the emitted installer is byte-for-byte correct. No generated-data commit is needed for deployment. Public assets only are emitted: the internal API evidence and complete snapshot stay out of `dist/`.

The site exposes `/`, `/install`, `/install.sh` (legacy alias), and `/release.json`, with a custom `404.html`. `public/_headers` sets content types, installer/metadata revalidation, and immutable caching for fingerprinted assets. The custom 404 also avoids Pages' default SPA fallback for missing download URLs.

No Cloudflare project, custom domain, deploy hook, or production secret has been configured by this local setup. See [release deployment integration](docs/release-deployment.md) for the remaining wiring and a ready-to-copy workflow for the Proofstorm repository.

## Project layout

```text
src/pages/                 Landing page, 404, static installer and metadata endpoints
src/components/            Icons and accessible copy-command control
src/layouts/               Shared document metadata and locally hosted fonts
src/styles/                Tailwind theme and global styles
src/data/release-snapshot.json  Verified, atomic release snapshot
scripts/                   Release sync, integrity checks, and regression tests
public/                    GUI brand assets, licensed Inter font, artwork, and Pages headers
docs/                      Deployment guide and upstream workflow example
.github/workflows/         Offline site checks for pushes and pull requests
```

## Current release contract

The current published releases do not yet include the proposed `release.json` manifest. This starter works with their GitHub release asset inventory and SHA-256 digests. The generated public `/release.json` declares `metadata_source: "github-release-assets"` and lists only the actual supported platform downloads.

A future upstream manifest can add the source commit and explicit required-platform/acceptance declarations. Its generation belongs in Proofstorm's existing verified release preparation flow. Until that exists, archive availability is not represented as clean-machine acceptance, and this site does not invent a source commit or platform certification.

## References

- [Astro styling with Tailwind](https://docs.astro.build/en/guides/styling/#tailwind)
- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Cloudflare Pages deploy hooks](https://developers.cloudflare.com/pages/configuration/deploy-hooks/)

MIT license. The exact Proofstorm logo, wordmark, and Inter font are reused from the GUI repository. The font license is retained in `public/fonts/Inter-LICENSE.txt`. The page uses the GUI brand palette: void, slate, snow, and storm red. The page contains a centered install panel with the GUI brand, a short product description, and install/start commands. The etched illustration is blended into the full-page background with a subtle SVG signal grid. A GitHub source icon sits at the top right. Release channel/version metadata remains available at `/release.json` without an alpha label on the landing page.

The GitHub source icon comes from [Primer Octicons](https://github.com/primer/octicons/blob/main/icons/mark-github-16.svg). Its MIT license is retained in `src/assets/brand/GITHUB-OCTICONS-LICENSE.txt`.
