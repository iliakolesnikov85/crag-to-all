# Crag-to-All

A web application for browsing climbing crags. Open it in a browser, or install it on a phone like a native app (it is a [progressive web app](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)).

The live site is **[roshkaclimb.ge](https://roshkaclimb.ge/)** — currently covering Roshka, Georgia.

You can look up sectors and routes, view topo photos with line overlays, check grades and descriptions, watch beta videos, use the map (including your location), and download PDF guides and GPX tracks. Before a trip with no signal, download a crag in the app so topos, routes, and the outdoor/topo map still work offline.

Live data (JSON, images, GPX, PDF guides, map tiles) is served from public Firebase Storage.

## Packages

| Path                                             | Role                                             |
| ------------------------------------------------ | ------------------------------------------------ |
| [`crag-explorer/`](crag-explorer/)               | Vite + React explorer (Netlify)                  |
| [`packages/shared-crag/`](packages/shared-crag/) | Shared TypeScript types, geo, and Bézier helpers |

## Quick start

Requires **Node 24**.

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
