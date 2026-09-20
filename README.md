# WEATHERXPLR Enhanced — Southeastern Pennsylvania Command Array

**Mission-critical weather operations center** styled after NOAA’s **CAVE** (Common AWIPS Visualization Environment).

Live site target:  
https://jasonsaro-ops.github.io/weatherxplr_enhanced_southeasternpa/

## Features

- **CAVE-style multi-pane docking** (Golden Layout) — dense, technical, dark command-center UI
- **2-minute real-time refresh cycle** for all primary feeds
- **Multi-tone alerting system** (ported from montcoxplr Web Audio API)
  - Extreme / critical → urgent two-tone wail
  - Severe / moderate → EMS-style rising chime
  - Advisory / minor → neutral double-beep
- **NWS API** integration
  - Active Pennsylvania alerts (severity-sorted)
  - 7-day forecast + hourly forecast
  - Nearest surface observation stations
  - Philadelphia (PHI) Area Forecast Discussion (AFD)
- **AirNow** live AQI + forecast + Action Day banners
- **USGS Schuylkill River** hydrology gauges with embedded hydrographs
- **NOAA Tides & Currents** (station 8545240) with live chart
- **Windy.com** multi-layer radar / satellite / model overlays
- System telemetry panel, mission clock (local + UTC), feed health strip
- Persistent audio preference via `localStorage`

## Focus area

- **Coordinates:** 40.0759°N, 75.2996°W  
- **ZIP:** 19428 (Conshohocken, PA)  
- **CWA:** Philadelphia (PHI)

## Deploy (GitHub Pages)

1. Create / push to repo: `weatherxplr_enhanced_southeasternpa`
2. Enable GitHub Pages (root or `/docs`)
3. Site will be available at:  
   `https://jasonsaro-ops.github.io/weatherxplr_enhanced_southeasternpa/`

No build step required — pure static HTML/JS.

## Files

| File        | Purpose                          |
|-------------|----------------------------------|
| `index.html`| CAVE-themed shell + styles       |
| `app.js`    | All data feeds, layout, audio    |
| `README.md` | This file                        |

## Alert tones

Enable **TONES ON** in the command bar. New alerts that appear after the page has established a baseline will play the corresponding severity tone. The first load never triggers audio (baseline capture).

## Credits / lineage

- Base: weatherxplr (Cross-Synoptic Array)
- Alert audio synthesis: montcoxplr Web Audio system
- Data: NWS api.weather.gov, AirNow, USGS, NOAA Tides & Currents, Windy embed
