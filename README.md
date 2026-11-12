# WEATHERXPLR · SE-PA Dispatch

Maverick-style mission board for Southeastern Pennsylvania with **Storm 3D** panel.

## Features
- Map-first dispatch UI (Windy layers, alerts, obs, gauges, sparklines)
- NWS PA/NJ/DE alerts · SPC · Open-Meteo · USGS · NOAA tides
- **Storm 3D** — Three.js height-box volume + echo top / max dBZ / core metrics
- Optional **Cloudflare Worker** for the same metrics at the edge (CORS-free, cacheable)

## Storm 3D — honest scope
Structure is **estimated** from public Open-Meteo CAPE/precip + NWS point alerts.  
It is **not** NEXRAD Level-II measured volume (that needs heavier processing than a free Worker).

UI matches the “sensible next step”: side metrics panel, dBZ scale, rotating 3D cloud in a 0–60k ft box.

## Deploy frontend (GitHub Pages)
Push `index.html`, `app.js`, `README.md` to your Pages repo.

## Deploy Storm 3D Worker (optional)
```bash
cd worker
npx wrangler login
npx wrangler deploy
```
Copy the `*.workers.dev` URL, open the board → **Storm 3D** → **Set Worker URL**, paste, reload.

Or set in DevTools:
```js
localStorage.setItem("wx_storm3d_worker", "https://weatherxplr-storm3d.YOUR_SUBDOMAIN.workers.dev")
```

Without a Worker, Storm 3D still runs entirely in the browser (same heuristics).

## Files
| Path | Role |
|------|------|
| `index.html` | Dispatch shell + Storm 3D styles |
| `app.js` | Feeds, modals, Three.js Storm 3D |
| `worker/storm3d.js` | Cloudflare Worker module |
| `worker/wrangler.toml` | Wrangler config |

## Cycle
120 s data refresh · focus 40.0759°N, 75.2996°W · PHI CWA
