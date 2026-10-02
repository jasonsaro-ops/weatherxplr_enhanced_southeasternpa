# WEATHERXPLR · SE-PA Mission Display

Dense, always-on weather operations display for Southeastern Pennsylvania.

**Stack:** NWS API · Open-Meteo · Open-Meteo AQ · USGS · NOAA Tides · Windy embed  
**Cycle:** 120 seconds full refresh  
**Focus:** 40.0759°N, 75.2996°W · ZIP 19428 · PHI CWA

## Design
- Montcoxplr-style ops console (Rajdhani / JetBrains Mono / Inter)
- Single radar array (no dual maps, no Golden Layout)
- CSS grid mission board — left conditions/alerts/obs · center radar+forecast · right AQI/hydro/tides/AFD
- Floating detail modals with severity-colored borders
- Tiered alert tones (extreme wail · severe chime · advisory beep)

## Deploy
Static site for GitHub Pages — push `index.html`, `app.js`, `README.md`.
