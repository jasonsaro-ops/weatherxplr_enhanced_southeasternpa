# WEATHERXPLR Enhanced — SE-PA Mission Array

Compact situational-awareness dashboard inspired by **Oblivion** (GMUNK GFX): minimal, functional, cool white/cyan on deep black.

**Live:** https://jasonsaro-ops.github.io/weatherxplr_enhanced_southeasternpa/

## Design
- Oblivion / GMUNK language: functionality first, bright unified palette, thin geometry
- Single primary map (full Windy layer catalog)
- Dense side panels for alerts, obs, forecast, AQI, hydro, tides
- Built to sit on a monitor alongside other apps

## Layout
| Zone | Content |
|------|---------|
| **Left** | NWS PA alerts · Surface obs · PHI AFD · Telemetry |
| **Center** | Single Radar / Model array (all Windy layers) |
| **Right** | 7-day + hourly · Air quality · Hydrology · NOAA tides |

## Windy layers
Full catalog (grouped optgroups): radar, satellite, wind, gusts, pressure, temp, dewpoint, humidity, wet-bulb, solar, UV, rain, snow, clouds (all levels), fog, CAPE, thermals, icing, waves, swell, SST, currents, AQI pollutants, drought, fire danger, weather warnings, and more.

## Alerting
Multi-tone Web Audio (from montcoxplr): Extreme → wail · Severe → chime · Advisory → beep. Toggle in header; preference in `localStorage`.

## Cycle
120-second refresh. Focus: 40.0759°N, 75.2996°W · 19428 · PHI CWA.

## Deploy
Static — push `index.html`, `app.js`, `README.md` to repo root, enable GitHub Pages.
