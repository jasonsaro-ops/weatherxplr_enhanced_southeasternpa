# WEATHERXPLR Enhanced — SE-PA Mission Array

Compact **Martian / Territory Studio–inspired** mission-control dashboard for Southeastern Pennsylvania situational awareness.

**Live:** https://jasonsaro-ops.github.io/weatherxplr_enhanced_southeasternpa/

## Design language
- The Martian (Territory Studio) Mission Control aesthetic: dark charcoal, amber/orange NASA accents, clean IBM Plex Mono typography, quiet authority
- Dense but readable — built to sit on a monitor alongside other apps
- Stacked radar arrays in the center column for primary visual focus

## Layout
| Zone | Content |
|------|---------|
| **Left** | NWS PA alerts · Surface obs · PHI AFD · Telemetry |
| **Center** | Radar array (full Windy layers) · Satellite/model array (full Windy layers) |
| **Right** | 7-day + hourly forecast · Air quality · Hydrology · NOAA tides |

## Windy layers
Both map panels expose the full catalog from the Windy layer picker (grouped):
- Radar / Satellite
- Wind (wind, gusts, accumulation, pressure)
- Temperature (temp, dewpoint, humidity, wet-bulb)
- Solar (solar power, UV)
- Rain / Snow (rain, accumulation, snow, depth, precip type, thunderstorms)
- Clouds / Aviation (clouds, high/med/low, fog, tops, base, visibility, CAPE, thermals, icing, freezing level, CAT)
- Waves / Sea (waves, swell, wind waves, SST, currents, tidal, wave power)
- Air Quality (AQI, NO₂, PM2.5, aerosol, ozone, SO₂, surface O₃, CO, dust)
- Warnings / Hazards (drought, fire, weather warnings, avalanche, extreme)

## Alerting
Multi-tone system (Web Audio, no files) adapted from montcoxplr:
- **Extreme** → urgent two-tone wail
- **Severe / Moderate** → EMS-style rising chime
- **Advisory / Minor** → neutral double-beep

Enable **TONES ON** in the header (user gesture required). Preference persists in `localStorage`.

## Data cycle
All primary feeds refresh every **120 seconds**. Focus: 40.0759°N, 75.2996°W · ZIP 19428 · PHI CWA.

## Deploy
Static site — push `index.html`, `app.js`, `README.md` to the repo root and enable GitHub Pages.
