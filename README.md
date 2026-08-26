# Crag-to-All

A React PWA for browsing climbing crags: topos with route overlays, maps, grades, PDF guides, and offline downloads.

Live data (JSON, images, GPX, PDF guides, map tiles) is served from public Firebase Storage. The app is a client — it does not write to Storage.

## Packages

| Path | Role |
| ---- | ---- |
| [`crag-explorer/`](crag-explorer/) | Vite + React explorer (Netlify) |
| [`packages/shared-crag/`](packages/shared-crag/) | Shared TypeScript types, geo, and Bézier helpers |

## Quick start

```bash
npm run build-shared-crag
cd crag-explorer
npm ci
npm run dev
```

The default `npm run dev` talks to production Firebase Storage. To point at a local Storage emulator on port 9199:

```bash
cd crag-explorer
npm run dev:use-emulator
```

## Build

```bash
npm run build
```

CI (`.github/workflows/deploy.yml`) builds `shared-crag`, then deploys `crag-explorer` to Netlify.

## License

MIT
