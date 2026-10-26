# Crag-to-All

A web application for browsing climbing crags. Open it in a browser, or install it on a phone like a native app (it is a [progressive web app](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)).

The live site is **[roshkaclimb.ge](https://roshkaclimb.ge/)** — currently covering Roshka, Georgia.

You can look up sectors and routes, view topo photos with line overlays, check grades and descriptions, watch beta videos, use the map (including your location), and download PDF guides and GPX tracks. Before a trip with no signal, download a crag in the app so topos, routes, and the outdoor/topo map still work offline.

Crag documents come from crag-api. Images, GPX, PDF guides, and map tiles are served from public Firebase Storage.

## Packages

| Path                                             | Role                                             |
| ------------------------------------------------ | ------------------------------------------------ |
| [`crag-explorer/`](crag-explorer/)                           | Vite + React explorer (Netlify) |
| [`crag-api/`](crag-api/)                                     | Local Express API (port 3010) + MongoDB documents |
| [`packages/shared-crag/`](packages/shared-crag/)             | Shared TypeScript types, geo, Bézier, and GPX helpers |
| [`packages/shared-firebase/`](packages/shared-firebase/)     | Firebase Admin SDK + Storage emulator |

## Quick start

Requires **Node 24**.

```bash
npm run build-shared-crag
cd crag-explorer
npm ci
npm run dev
```

`npm run dev` loads crag documents from the local API (Vite proxies `/api` to port 3010) and files from production Firebase Storage. Install MongoDB locally (default `mongodb://127.0.0.1:27017`), then start the API:

```bash
npm run dev:api
```

In another terminal, from `crag-explorer`:

```bash
npm run dev
```

To point file URLs at a local Storage emulator on port 9199:

```bash
npm run emulator:start
```

In another terminal:

```bash
cd crag-explorer
npm run dev-local
```

See [`crag-api/README.md`](crag-api/README.md). Do not deploy `crag-api` until auth exists. Crag-management writes will send a bearer token through the explorer API client; reads stay anonymous until then. Set `VITE_API_BASE_URL` (no trailing slash) on production builds once the API is public. Image upload uses the Storage emulator via Admin SDK.

## Build

```bash
npm run build
```

CI (`.github/workflows/deploy.yml`) tests `crag-api`, builds `shared-crag`, then deploys `crag-explorer` to Netlify.

## License

MIT
