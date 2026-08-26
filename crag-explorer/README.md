# crag-explorer

React + Vite PWA for browsing climbing sectors, topos, routes, maps, and downloadable guides.

Crag JSON, images, GPX, PDFs, and offline map-tile packs are loaded from public Firebase Storage.

## Development

From the repo root:

```bash
npm run dev
```

Or inside this folder after `shared-crag` is built:

```bash
npm ci
npm run dev          # production Storage
npm run dev:use-emulator   # Storage emulator at localhost:9199
npm run build
npm run seo-check
```

## SEO

Hybrid SEO: build-time tags patched into `index.html`, plus runtime updates in `SeoDynamic.tsx`. See `scripts/README.md`.
