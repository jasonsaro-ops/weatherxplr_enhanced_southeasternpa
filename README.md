# WEATHERXPLR · SE-PA Dispatch

Dense mission-dispatch weather board for Southeastern Pennsylvania, redesigned in the spirit of **The Weather Company Maverick Dispatch**: map-first layout, layer panel, severity alerts, circular gauges, forecast tables, and sparkline charts.

**Stack:** NWS · Open-Meteo (blend + HRRR/GFS when available) · SPC · USGS · NOAA Tides · Windy  
**Models:** HRRR guidance labels · REFS/RRFS info links to NOMADS & AWS NODD  
**Cycle:** 120 s · **Focus:** 40.0759°N, 75.2996°W · PHI CWA  

## UI
- Top nav: Map / Alerts / Models  
- Left rail: Conditions (gauges) · Alerts · Surface obs  
- Center: Windy radar/model map, layer popover, time strip  
- Right: Model guidance cards, 7-day table, temp/PoP/wind sparks, AQI, tides, hydro  

All tiles open floating modals. Alert tones optional (localStorage).

## Deploy
Static GitHub Pages — push `index.html`, `app.js`, `README.md`.
