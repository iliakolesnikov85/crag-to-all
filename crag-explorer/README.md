# crag-explorer

React + Vite PWA for browsing climbing sectors, topos, routes, maps, and downloadable guides.

Crag documents are loaded from crag-api. Images, GPX, PDFs, and offline map-tile packs come from Firebase Storage.

## Development

From the repo root:

```bash
npm run dev
```

Or inside this folder after `shared-crag` is built:

```bash
npm ci
npm run dev          # local API via the /api proxy, production Storage files
npm run dev-local    # local API, Storage emulator at localhost:9199
npm run build
npm run seo-check
```

Start `crag-api` on port 3010 before `npm run dev`. Production builds set `VITE_API_BASE_URL` once the API is public. Reads stay anonymous. `getAccessToken()` is the seam for a future bearer token on crag-management writes.

## SEO

Hybrid SEO: build-time tags patched into `index.html`, plus runtime updates in `SeoDynamic.tsx`. The patch loads each crag from `VITE_API_BASE_URL` (default `http://localhost:3010`). See `scripts/README.md`.
