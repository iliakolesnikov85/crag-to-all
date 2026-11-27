# Homepage SEO

The built `index.html` is a plain shell. It stays `noindex`.

Published crags supply the title, description, heading, and JSON-LD. The text is built in `@crag-to-all/shared-crag` (`buildHomepageSeo`), and the tags are rendered there too (`renderHomepageHeadTags`). The app rewrites the same tags through the selectors that module exports, so the two cannot drift apart.

A script writes those tags into the live `index.html`. It runs at the end of the app deploy, and again after the nightly route-stats job. The script downloads the live file, replaces the tags in `<head>`, and leaves the script and stylesheet links as they are. Patching its own output changes nothing, so when the patched file equals the live file the script skips the upload. A file patched by an older version of the script comes out clean: the old hash comment, canonical, URL, and geo tags are removed.

The patched file carries no canonical or URL tag. `/` serves it, and every other app route falls back to it, so a fixed URL would name the homepage on all of them. The app adds a canonical link for the current path when a page loads. Other tags on non-homepage paths still show the homepage text. This is a known limitation while the site is `noindex`.

The social preview image is `/header-bg.png` (1280 x 393). A 1200 x 630 image would crop better in link previews.

The sitemap lists only `/`. `scripts/build.js` writes it to `dist/sitemap.xml`, not to `public/`, because it carries the build date. Set `VITE_SITE_URL` at build time (pre-prod uses `https://crags-for-all.web.app`). Without it, the sitemap uses that same pre-prod host. The app reads the same variable for its canonical links.

The patch script reads `API_BASE_URL`, `SITE_ORIGIN`, and `GOOGLE_APPLICATION_CREDENTIALS`.
