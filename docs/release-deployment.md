# Release deployment integration

The website and release publishing remain separate repos. Site source changes deploy from `proofstorm-site/master`; a published Proofstorm release requests a new build through a Cloudflare Pages deploy hook.

## Connect the release trigger

1. Connect the website repo in Cloudflare Pages using the settings in the root README.
2. Attach `proofstorm.com` and set `SITE_URL` to `https://proofstorm.com`. The canonical installer URL is `https://proofstorm.com/install`.
3. Create a Pages deploy hook for the website's `master` branch.
4. In the **Proofstorm application repo**, store the hook URL as the secret `PROOFSTORM_SITE_DEPLOY_HOOK` and the public site origin as the variable `PROOFSTORM_SITE_URL`.
5. Copy `docs/proofstorm-release-site.yml` from this repo to `.github/workflows/update-site.yml` in the application repo. Set `RELEASE_CHANNEL` in that workflow to match Pages.
6. Run the workflow manually with an already-published tag to verify the full integration. Only then rely on its release event.

The hook URL is a secret. It can request a build but does not grant repository access. Git integration supplies normal site previews; no cross-repository write token is needed.

`release: types: [published]` includes alpha prereleases published from drafts. Preparing a draft does not trigger a site update. The application's current flow publishes drafts manually, which emits this event. If publishing later uses a workflow's `GITHUB_TOKEN`, call the hook explicitly in that publishing workflow: GitHub suppresses new workflow runs for release events caused by that token.

## Completion and recovery

The example checks that its tag is the highest published semantic version in the configured channel before requesting a build. An older published tag does not move the site backward. It then polls the public `/release.json` until that tag or a newer release in the same channel appears. A successful hook response alone is not considered deployment success.

On failure, GitHub Actions reports a failed run and Cloudflare retains the previous successful deployment if the build failed. Check Pages build logs, fix the failed asset/metadata contract, and rerun the workflow. Existing tags/assets should not be overwritten to repair byte identity: publish a corrected release instead.

For a deliberate rollback, set `RELEASE_TAG` in Pages to the previously verified tag and rebuild, or use a previous Pages deployment. Keep the explicit tag pin until the bad release is superseded, so a later hook does not immediately reselect it. This rolls back the website and recommended installer only; it does not uninstall users' existing installations. A pin must match `RELEASE_CHANNEL`.

The workflow's public endpoint check is a deployment check, not an installed-runtime acceptance test. Fresh-machine installation, Docker setup, and agent/cell acceptance remain part of the application release process.

## Future upstream manifest

The agreed next step in the application repo is a generated `release.json` asset containing a schema version, version/tag, source commit, channel, required platforms, and asset filenames/sizes/SHA-256 hashes. Generate it only after artifact verification and include it in the existing uploaded-byte verification.

When that contract ships, teach `scripts/sync-release.mjs` to require and validate it for the new release format. Retain explicitly pinned legacy support for releases like alpha.2. A manifest must distinguish downloadable platform assets from separately observed clean-machine acceptance; the website should preserve that distinction.

The application repo is not modified by this local website setup.
