# WEATHERXPLR · SE-PA Mission Display

Dense, always-on weather operations display for Southeastern Pennsylvania.
Styled after **NWSXPLR** (boot screen, arc gauges, IBM Plex, severity borders).

**Stack:** NWS · Open-Meteo (weather + AQ) · SPC · USGS · NOAA Tides · Windy  
**Cycle:** 120 s full refresh  
**Focus:** 40.0759°N, 75.2996°W · ZIP 19428 · PHI CWA  

## Features
- NWSXPLR-style animated boot / startup screen
- Arc gauges (temp, humidity, pressure) + wind compass
- Minimal scrolling — dense layout for quad-box / multi-monitor
- All tiles clickable → floating modals for full data / alerts / AFD / hydrographs
- Alerts: NWS PA + NJ + DE, SPC Day-1 (in-app graphic), tiered tones
- Single Windy radar/model array with layer selector

## Deploy
Static GitHub Pages — push `index.html`, `app.js`, `README.md`.
