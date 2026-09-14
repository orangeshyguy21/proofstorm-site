# Social sharing and search presence

Reviewed September 14, 2026.

## Approved sharing image

- Public image: `/og/proofstorm-og-v3.jpg` (1200 × 630, about 142 KiB).
- Lossless master: `docs/assets/proofstorm-og-v3.png`. It is retained in the repository and is not shipped in `dist/`.
- Earlier v1/v2 exports were removed. The approved v3 artwork has not been recompressed or altered.

`src/layouts/Layout.astro` includes the image in the initial HTML through Open Graph and X/Twitter large-image card tags. Open Graph also includes the actual dimensions, JPEG type, and descriptive image alt text. The page title, description, canonical URL, and social metadata share the same page values and use the configured `SITE_URL`, which defaults to `https://proofstorm.com`.

The [Open Graph specification](https://ogp.me/) defines the core title, type, image, and URL fields and recommends descriptive image alt text. [Apple's Messages guidance](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages) requires metadata to be available without JavaScript and recommends large images and square high-resolution icons. Its guidance favors graphical images because small embedded text can become unreadable; the approved v3 composition is retained, and its main message is also present in accessible metadata.

The image has a versioned filename with immutable caching in Cloudflare Pages `_headers`. Treat that URL as immutable: publish later artwork under a new filename and update the metadata in the same change. Pages and platforms can cache their own previews independently; a new filename prevents reuse of old image bytes but does not force an existing card to refresh.

## Deployment verification

After the normal website deployment:

1. Check the raw HTML at `https://proofstorm.com/` for `og:image` and `twitter:image`, both pointing to `https://proofstorm.com/og/proofstorm-og-v3.jpg`.
2. Request that image directly. It must return HTTP 200, `Content-Type: image/jpeg`, and the actual JPEG, without authentication or an interstitial.
3. Use the [Meta Sharing Debugger](https://developers.facebook.com/tools/debug/) to inspect the deployed URL and request a fresh scrape when needed. Check a link preview in the messaging platforms that matter to the project. Platform cropping and cached cards can differ.

Before this change was deployed, requests to the production homepage using Twitterbot and Facebook crawler user-agent strings returned HTTP 200 and the normal page. This is a reachability smoke check from our connection, not proof that every platform crawler can access the site from its own network. Local checks cannot establish a live social preview before deployment.

## Icons and avatar

The designer's delivered exports are used unchanged:

| Public path | Size | Use |
| --- | --- | --- |
| `/favicon.svg` | Square 256 × 256 viewBox | Scalable browser favicon with a transparent background. Declared with `sizes="any"`. |
| `/favicon-96x96.png` | 96 × 96 | Transparent raster favicon for search results and browser fallback. |
| `/favicon.ico` | 16, 32, and 48 px frames | Browser compatibility and automatic `/favicon.ico` requests. |
| `/apple-touch-icon.png` | 180 × 180 | Opaque dark-background icon for Apple saved sites and link-preview fallback. |
| `/proofstorm-avatar-512.png` | 512 × 512 | Opaque profile artwork available for repository and social account uploads. It is not used in place of the wide OG image. |

All four favicon/touch-icon links appear in the shared page head, including on the 404 page. The files have explicit image content types and revalidating cache headers in Cloudflare Pages `_headers`, so these stable URLs can receive updated bytes in future deployments. The prior `/proofstorm-logo.svg` remains available for pages or bookmarks that still reference it.

[Google's favicon guidance](https://developers.google.com/search/docs/appearance/favicon-in-search) requires a square, crawlable icon at a stable URL and recommends a size greater than 48 px. [Apple's icon guidance](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) describes the `apple-touch-icon` link.

After deployment, request each public path directly and confirm HTTP 200 with the documented format. Existing browser icons and search-result icons can take time to refresh. Updating a profile image on an external account is separate from publishing the downloadable avatar file.

The current site does not need additional icon artwork. If an installable website becomes a product requirement, add a web app manifest and purpose-made 192/512 px icons then.

## Homepage structured data

The homepage now includes one `WebSite` JSON-LD block in its initial HTML. It names the site Proofstorm and includes the configured canonical homepage URL, the same description used in the page metadata, and English as its language. It is omitted from the 404 page. [Google uses this markup to understand the preferred site name](https://developers.google.com/search/docs/appearance/site-names).

After deployment, inspect the homepage with the [Schema Markup Validator](https://validator.schema.org/), then use Search Console's URL Inspection to check Google's view of the page and request indexing. Google's Rich Results Test does not validate site-name markup. Search appearance changes depend on Google's next crawl and processing.

## Remaining search setup

- Verify ownership in Google Search Console and inspect/request indexing of the canonical homepage. A small sitemap and a robots.txt sitemap reference can make future page discovery explicit. [Google notes that a small, well-linked site may not need a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview); it is a discovery aid, not a ranking guarantee.
- Confirm HTTP and www variants redirect to one HTTPS hostname and that Cloudflare preview deployments are not indexed. These are deployment settings to verify, not image assets.
- Add `twitter:site` or social-profile identity links only after the project's official handles are confirmed. Do not infer them from a personal GitHub username.
- As documentation and examples become public pages, give each a useful title, description, canonical URL, and relevant content. Do not invent reviews, ratings, or business details for structured data.

The existing canonical link and updated page description are already present. No account setup, deployment, search submission, or social post is performed by this repository change.
