/**
 * WEATHERXPLR ENHANCED — SE-PA Mission Array
 * Martian / Territory Studio–inspired compact command dashboard
 * Stacked radar center · Full Windy layer set · Multi-tone alerts · 120s cycle
 */

const localLat = 40.0759;
const localLon = -75.2996;
const localZip = "19428";
const AIRNOW_API_KEY = "E5AFEF36-80F6-4A42-AE38-F3C56E3AEAC4";

const schuylkillGauges = [
  { id: "01472000", name: "Schuylkill @ Reading", lat: 40.3323, lon: -75.9324 },
  { id: "01473500", name: "Schuylkill @ Pottstown", lat: 40.2429, lon: -75.6605 },
  { id: "01474500", name: "Schuylkill @ Norriton", lat: 40.1118, lon: -75.3532 },
  { id: "01474703", name: "Schuylkill @ Conshohocken", lat: 40.0712, lon: -75.3093 },
  { id: "01474000", name: "Schuylkill @ Fairmount Dam", lat: 39.9676, lon: -75.1832 }
];

/* ── Full Windy layer catalog (from user screenshots) ── */
const WINDY_LAYERS = [
  { group: "Radar / Satellite", items: [
    { v: "radar", l: "Weather Radar" },
    { v: "satellite", l: "Satellite" }
  ]},
  { group: "Wind", items: [
    { v: "wind", l: "Wind" },
    { v: "gust", l: "Wind Gusts" },
    { v: "windAccum", l: "Wind Accumulation" },
    { v: "pressure", l: "Pressure" }
  ]},
  { group: "Temperature", items: [
    { v: "temp", l: "Temperature" },
    { v: "dewpoint", l: "Dew Point" },
    { v: "rh", l: "Humidity" },
    { v: "wetbulbtemp", l: "Wet-bulb Temp" }
  ]},
  { group: "Solar", items: [
    { v: "solarpower", l: "Solar Power" },
    { v: "uvindex", l: "UV Index" }
  ]},
  { group: "Rain / Snow", items: [
    { v: "rain", l: "Rain / Thunder" },
    { v: "rainAccum", l: "Rain Accumulation" },
    { v: "snow", l: "New Snow" },
    { v: "snowcover", l: "Snow Depth" },
    { v: "ptype", l: "Precip Type" },
    { v: "thunder", l: "Thunderstorms" }
  ]},
  { group: "Clouds / Aviation", items: [
    { v: "clouds", l: "Clouds" },
    { v: "hclouds", l: "High Clouds" },
    { v: "mclouds", l: "Medium Clouds" },
    { v: "lclouds", l: "Low Clouds" },
    { v: "fog", l: "Fog" },
    { v: "cloudtop", l: "Cloud Tops" },
    { v: "cloudbase", l: "Cloud Base" },
    { v: "visibility", l: "Visibility" },
    { v: "cape", l: "CAPE Index" },
    { v: "thermals", l: "Thermals" },
    { v: "icing", l: "Icing" },
    { v: "deg0", l: "Freezing Altitude" },
    { v: "turbulence", l: "Clear Air Turbulence" }
  ]},
  { group: "Waves / Sea", items: [
    { v: "waves", l: "Waves" },
    { v: "swell", l: "Swell" },
    { v: "swellPeriod", l: "Swell Period" },
    { v: "wwaves", l: "Wind Waves" },
    { v: "sst", l: "Sea Temperature" },
    { v: "currents", l: "Currents" },
    { v: "currentsTide", l: "Tidal Currents" },
    { v: "wavepower", l: "Wave Power" }
  ]},
  { group: "Air Quality", items: [
    { v: "airquality", l: "Air Quality Index" },
    { v: "no2", l: "NO₂" },
    { v: "pm2p5", l: "PM2.5" },
    { v: "aod550", l: "Aerosol" },
    { v: "ozone", l: "Ozone Layer" },
    { v: "so2", l: "SO₂" },
    { v: "surfaceOzone", l: "Surface Ozone" },
    { v: "co", l: "CO Concentration" },
    { v: "dust", l: "Dust Mass" }
  ]},
  { group: "Warnings / Hazards", items: [
    { v: "drought", l: "Drought Monitoring" },
    { v: "fire", l: "Fire Danger" },
    { v: "warnings", l: "Weather Warnings" },
    { v: "avalanche", l: "Avalanche Danger" },
    { v: "extreme", l: "Extreme Forecast" }
  ]}
];

function buildLayerSelect(id, selected) {
  let html = `<select id="${id}" class="layer-select">`;
  WINDY_LAYERS.forEach(g => {
    html += `<optgroup label="${g.group}">`;
    g.items.forEach(it => {
      html += `<option value="${it.v}"${it.v === selected ? " selected" : ""}>${it.l}</option>`;
    });
    html += `</optgroup>`;
  });
  html += `</select>`;
  return html;
}

function windyUrl(overlay) {
  const product = (overlay === "radar" || overlay === "satellite") ? overlay : "gfs";
  return `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=f&metricWind=mph&zoom=8&overlay=${overlay}&product=${product}&level=surface&lat=${localLat}&lon=${localLon}`;
}

/* ── State ── */
let countdownVal = 120;
let globalForecastDataCache = null;
let globalHourlyCache = null;
let globalActiveAlertsCache = {};
let globalAQIDetailsCache = {};
let globalObsCache = {};
let noaaChartInstance = null;
let previousAlertIds = new Set();
let hasAlertBaseline = false;
let audioEnabled = false;
let feedStatus = { nws: true, aqi: true, hydro: true, tides: true, obs: true };

/* ── Audio (montcoxplr multi-tone) ── */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function scheduleTone(freq, start, dur, type, peak) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.02);
  gain.gain.linearRampToValueAtTime(0, start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}
function playExtremeTone() {
  const now = getAudioCtx().currentTime;
  [880, 660, 880, 660, 880, 660].forEach((f, i) => scheduleTone(f, now + i * 0.14, 0.13, "sawtooth", 0.22));
}
function playSevereTone() {
  const now = getAudioCtx().currentTime;
  scheduleTone(523.25, now, 0.32, "sine", 0.2);
  scheduleTone(784.0, now + 0.28, 0.4, "sine", 0.2);
}
function playAdvisoryTone() {
  const now = getAudioCtx().currentTime;
  scheduleTone(440, now, 0.1, "triangle", 0.2);
  scheduleTone(440, now + 0.17, 0.1, "triangle", 0.2);
}
const SEV_TONES = { extreme: playExtremeTone, severe: playSevereTone, moderate: playSevereTone, minor: playAdvisoryTone, unknown: playAdvisoryTone };
function playAlertsForSeverities(set) {
  let d = 0;
  ["extreme", "severe", "moderate", "minor", "unknown"].forEach(s => {
    if (!set.has(s)) return;
    setTimeout(() => SEV_TONES[s](), d);
    d += 900;
  });
}
function initAudioToggle() {
  const btn = document.getElementById("audio-toggle-btn");
  if (!btn) return;
  try { audioEnabled = localStorage.getItem("weatherxplr_audio_enabled") === "true"; } catch (e) {}
  updateAudioUI();
  btn.addEventListener("click", () => {
    audioEnabled = !audioEnabled;
    try { localStorage.setItem("weatherxplr_audio_enabled", String(audioEnabled)); } catch (e) {}
    if (audioEnabled) { getAudioCtx(); playAdvisoryTone(); }
    updateAudioUI();
  });
}
function updateAudioUI() {
  const btn = document.getElementById("audio-toggle-btn");
  const lbl = document.getElementById("lbl-audio");
  const icon = document.getElementById("audio-icon");
  if (!btn || !lbl) return;
  if (audioEnabled) {
    btn.classList.replace("audio-off", "audio-on");
    lbl.textContent = "TONES ON";
    if (icon) icon.className = "fa-solid fa-volume-high";
  } else {
    btn.classList.replace("audio-on", "audio-off");
    lbl.textContent = "TONES OFF";
    if (icon) icon.className = "fa-solid fa-volume-xmark";
  }
}

/* ── Layout: compact · radars stacked center ── */
const config = {
  settings: { hasHeaders: true, reorderEnabled: true, showPopoutIcon: false, showMaximiseIcon: true, showCloseIcon: false },
  content: [{
    type: "row",
    content: [
      /* LEFT column — alerts + obs + discussion */
      {
        type: "column", width: 26,
        content: [
          { type: "component", componentName: "nwsAlerts", title: "NWS HAZARDS · PA", height: 42 },
          {
            type: "stack", height: 58,
            content: [
              { type: "component", componentName: "currentObs", title: "SURFACE OBS" },
              { type: "component", componentName: "nwsDiscussion", title: "PHI AFD" },
              { type: "component", componentName: "systemTelemetry", title: "TELEMETRY" }
            ]
          }
        ]
      },
      /* CENTER — stacked radar displays */
      {
        type: "column", width: 48,
        content: [
          { type: "component", componentName: "radarMap", title: "RADAR ARRAY", height: 50 },
          { type: "component", componentName: "cloudMap", title: "SATELLITE / MODEL ARRAY", height: 50 }
        ]
      },
      /* RIGHT — forecast + environmental */
      {
        type: "column", width: 26,
        content: [
          {
            type: "stack", height: 40,
            content: [
              { type: "component", componentName: "localForecast", title: "7-DAY OUTLOOK" },
              { type: "component", componentName: "hourlyForecast", title: "HOURLY" }
            ]
          },
          {
            type: "stack", height: 60,
            content: [
              { type: "component", componentName: "airQualityPanel", title: "AIR QUALITY" },
              { type: "component", componentName: "hydrologyFeed", title: "HYDROLOGY" },
              { type: "component", componentName: "noaaTides", title: "TIDES 8545240" }
            ]
          }
        ]
      }
    ]
  }]
};

const layout = new GoldenLayout(config, "#layout-root");

/* ── Components ── */
layout.registerComponent("radarMap", function (container) {
  container.getElement().html(`
    <div style="position:relative;width:100%;height:100%;background:#0b0d10;">
      <div class="layer-bar">${buildLayerSelect("radarLayerSelect", "radar")}</div>
      <iframe id="radarIframe" src="${windyUrl("radar")}" style="width:100%;height:100%;border:none;"></iframe>
    </div>`);
  setTimeout(() => {
    container.getElement().find("#radarLayerSelect").on("change", function () {
      container.getElement().find("#radarIframe")[0].src = windyUrl(this.value);
    });
  }, 150);
});

layout.registerComponent("cloudMap", function (container) {
  container.getElement().html(`
    <div style="position:relative;width:100%;height:100%;background:#0b0d10;">
      <div class="layer-bar">${buildLayerSelect("cloudLayerSelect", "clouds")}</div>
      <iframe id="cloudIframe" src="${windyUrl("clouds")}" style="width:100%;height:100%;border:none;"></iframe>
    </div>`);
  setTimeout(() => {
    container.getElement().find("#cloudLayerSelect").on("change", function () {
      container.getElement().find("#cloudIframe")[0].src = windyUrl(this.value);
    });
  }, 150);
});

layout.registerComponent("localForecast", function (container) {
  container.getElement().html(`<div class="wcomp" id="forecast-container">Loading synoptic grid…</div>`);
  container.on("open", fetchNWSForecast);
});
layout.registerComponent("hourlyForecast", function (container) {
  container.getElement().html(`<div class="wcomp" id="hourly-container">Loading hourly…</div>`);
  container.on("open", fetchHourlyForecast);
});
layout.registerComponent("nwsAlerts", function (container) {
  container.getElement().html(`
    <div class="wcomp">
      <div class="phdr"><span><i class="fa-solid fa-triangle-exclamation"></i> ACTIVE ALERTS</span><span id="alert-panel-count" style="color:var(--text-dim);font-weight:400;"></span></div>
      <div id="alerts-container">Scanning…</div>
    </div>`);
  container.on("open", fetchPennsylvaniaAlerts);
});
layout.registerComponent("currentObs", function (container) {
  container.getElement().html(`<div class="wcomp" id="obs-container">Interrogating stations…</div>`);
  container.on("open", fetchCurrentObservations);
});
layout.registerComponent("nwsDiscussion", function (container) {
  container.getElement().html(`<div class="wcomp" id="discussion-container">Retrieving PHI AFD…</div>`);
  container.on("open", fetchNWSDiscussion);
});
layout.registerComponent("airQualityPanel", function (container) {
  container.getElement().html(`<div class="wcomp" id="aqi-container-target">AirNow link…</div>`);
  container.on("open", fetchAirQualityData);
});
layout.registerComponent("noaaTides", function (container) {
  container.getElement().html(`
    <div class="wcomp" style="display:flex;flex-direction:column;gap:6px;">
      <div id="noaa-gauges"><span style="color:var(--text-dim);font-size:10px;">Contacting NOAA…</span></div>
      <div style="flex:1;min-height:140px;position:relative;background:var(--bg-elev);border:1px solid var(--line);border-radius:2px;padding:6px;">
        <canvas id="noaaChart"></canvas>
      </div>
    </div>`);
  container.on("open", fetchNOAATides);
});
layout.registerComponent("hydrologyFeed", function (container) {
  container.getElement().html(`<div class="wcomp" id="hydro-river-list">USGS link…</div>`);
  container.on("open", fetchSchuylkillHydrology);
});
layout.registerComponent("systemTelemetry", function (container) {
  container.getElement().html(`
    <div class="wcomp" id="telemetry-container">
      <div class="phdr"><i class="fa-solid fa-microchip"></i> TELEMETRY</div>
      <div class="tel-grid">
        <div class="tel-cell"><div class="tel-val" id="t-cycle">120</div><div class="tel-lbl">Cycle (s)</div></div>
        <div class="tel-cell"><div class="tel-val" id="t-alerts">0</div><div class="tel-lbl">Alerts</div></div>
        <div class="tel-cell"><div class="tel-val" id="t-feeds">5/5</div><div class="tel-lbl">Feeds</div></div>
        <div class="tel-cell"><div class="tel-val" id="t-audio">OFF</div><div class="tel-lbl">Tones</div></div>
      </div>
      <div style="margin-top:10px;font-size:10px;color:var(--text-dim);line-height:1.55;">
        <div><span style="color:var(--amber);">FOCUS</span> 40.0759°N / 75.2996°W</div>
        <div><span style="color:var(--amber);">CWA</span> Philadelphia (PHI)</div>
        <div style="margin-top:6px;color:var(--amber);">120 s real-time cycle</div>
        <div style="margin-top:4px;">Tones: Extreme → wail · Severe → chime · Advisory → beep</div>
      </div>
    </div>`);
  container.on("open", updateTelemetry);
});

layout.init();

/* ── Clock / status helpers ── */
function updateClock() {
  const now = new Date();
  const utc = now.toISOString().substr(11, 8) + "Z";
  const local = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const el = document.getElementById("mission-clock");
  if (el) el.textContent = `${local} L  ·  ${utc}`;
}
function setDot(id, ok) {
  const el = document.getElementById(id);
  if (el) el.className = "dot " + (ok ? "ok" : "err");
}
function markSync() {
  const el = document.getElementById("last-sync");
  if (el) el.textContent = "SYNC " + new Date().toLocaleTimeString("en-US", { hour12: false });
}
function updateTelemetry() {
  const a = document.getElementById("t-cycle");
  const b = document.getElementById("t-alerts");
  const c = document.getElementById("t-feeds");
  const d = document.getElementById("t-audio");
  if (a) a.textContent = countdownVal;
  if (b) b.textContent = Object.keys(globalActiveAlertsCache).length;
  if (c) c.textContent = Object.values(feedStatus).filter(Boolean).length + "/5";
  if (d) d.textContent = audioEnabled ? "ON" : "OFF";
}

/* ── NWS Forecast ── */
function fetchNWSForecast() {
  fetch(`https://api.weather.gov/points/${localLat},${localLon}`)
    .then(r => r.json()).then(d => fetch(d.properties.forecast))
    .then(r => r.json())
    .then(data => {
      feedStatus.nws = true; setDot("dot-nws", true);
      globalForecastDataCache = data.properties.periods;
      let html = `<div class="phdr"><i class="fa-solid fa-calendar-days"></i> 7-DAY · 19428</div><div class="fc-grid">`;
      globalForecastDataCache.forEach((p, i) => {
        html += `<div class="fc-card" onclick="openForecastDetails(${i})">
          <div style="color:var(--text-dim);font-size:9px;font-weight:600;height:16px;overflow:hidden;">${p.name.toUpperCase()}</div>
          <img src="${p.icon}" alt="">
          <div class="${p.isDaytime ? "t-hi" : "t-lo"}">${p.temperature}°</div>
          <div style="font-size:8.5px;color:var(--text-dim);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${p.shortForecast}</div>
        </div>`;
      });
      html += `</div>`;
      $("#forecast-container").html(html);
    })
    .catch(() => { feedStatus.nws = false; setDot("dot-nws", false); $("#forecast-container").html(`<span style="color:var(--red);">FORECAST TIMEOUT</span>`); });
}
function openForecastDetails(i) {
  const p = globalForecastDataCache && globalForecastDataCache[i];
  if (!p) return;
  openModal(`${p.name}`, `
    <div style="text-align:center;margin-bottom:12px;">
      <img src="${p.icon}" style="width:56px;">
      <div style="font-size:22px;color:#fff;margin:4px 0;">${p.temperature}°${p.temperatureUnit}</div>
      <div style="color:var(--amber);font-weight:600;">${p.shortForecast}</div>
    </div>
    <div style="border-top:1px solid var(--line);padding-top:12px;line-height:1.55;color:var(--text);">${p.detailedForecast}</div>`);
}

/* ── Hourly ── */
function fetchHourlyForecast() {
  fetch(`https://api.weather.gov/points/${localLat},${localLon}`)
    .then(r => r.json()).then(d => fetch(d.properties.forecastHourly))
    .then(r => r.json())
    .then(data => {
      globalHourlyCache = (data.properties.periods || []).slice(0, 24);
      let html = `<div class="phdr"><i class="fa-solid fa-clock"></i> NEXT 24 H</div><div class="hr-strip">`;
      globalHourlyCache.forEach(p => {
        const t = new Date(p.startTime);
        const label = t.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
        const pop = p.probabilityOfPrecipitation && p.probabilityOfPrecipitation.value != null ? p.probabilityOfPrecipitation.value + "%" : "—";
        html += `<div class="hr-card">
          <div style="color:var(--text-dim);font-size:8.5px;">${label}</div>
          <img src="${p.icon}" alt="">
          <div class="${p.isDaytime ? "t-hi" : "t-lo"}" style="font-size:12px;">${p.temperature}°</div>
          <div style="font-size:8px;color:var(--blue);">${pop}</div>
        </div>`;
      });
      html += `</div>`;
      $("#hourly-container").html(html);
    })
    .catch(() => $("#hourly-container").html(`<span style="color:var(--red);">HOURLY TIMEOUT</span>`));
}

/* ── Alerts ── */
function sevClass(s) {
  s = (s || "").toLowerCase();
  if (s === "extreme") return "sev-extreme";
  if (s === "severe") return "sev-severe";
  if (s === "moderate") return "sev-moderate";
  if (s === "minor") return "sev-minor";
  return "sev-unknown";
}
function sevKey(s) {
  s = (s || "").toLowerCase();
  return ["extreme", "severe", "moderate", "minor"].includes(s) ? s : "unknown";
}
function fetchPennsylvaniaAlerts() {
  fetch("https://api.weather.gov/alerts/active?area=PA")
    .then(r => r.json())
    .then(data => {
      feedStatus.nws = true; setDot("dot-nws", true);
      const alerts = data.features || [];
      globalActiveAlertsCache = {};
      const currentIds = new Set();
      const newSevs = new Set();
      let html = "";
      if (alerts.length) {
        alerts.sort((a, b) => {
          const o = { extreme: 0, severe: 1, moderate: 2, minor: 3 };
          return (o[(a.properties.severity || "").toLowerCase()] ?? 4) - (o[(b.properties.severity || "").toLowerCase()] ?? 4);
        });
        alerts.forEach(f => {
          const p = f.properties;
          globalActiveAlertsCache[p.id] = p;
          currentIds.add(p.id);
          if (hasAlertBaseline && !previousAlertIds.has(p.id)) newSevs.add(sevKey(p.severity));
          const crit = ["extreme", "severe"].includes((p.severity || "").toLowerCase());
          html += `<div class="alert-item ${sevClass(p.severity)}" onclick="openAlertDetails('${p.id}')">
            <div class="alert-title" style="color:${crit ? "var(--red)" : "var(--orange)"};">${p.event}</div>
            <div class="alert-meta">${p.severity || "—"} · ${(p.areaDesc || "").substring(0, 55)}${(p.areaDesc || "").length > 55 ? "…" : ""}</div>
          </div>`;
        });
      } else {
        html = `<div style="color:var(--green);font-size:11px;padding:6px 0;"><i class="fa-solid fa-check"></i> CLEAR — NO ACTIVE PA ALERTS</div>`;
      }
      if (hasAlertBaseline && newSevs.size && audioEnabled) playAlertsForSeverities(newSevs);
      if (!hasAlertBaseline) hasAlertBaseline = true;
      previousAlertIds = currentIds;
      const n = alerts.length;
      const ce = document.getElementById("alert-count");
      const chip = document.getElementById("alert-chip");
      const pc = document.getElementById("alert-panel-count");
      if (ce) ce.textContent = n;
      if (pc) pc.textContent = n ? n + " ACTIVE" : "CLEAR";
      if (chip) { if (n) chip.classList.add("alert-on"); else chip.classList.remove("alert-on"); }
      $("#alerts-container").html(html);
      updateTelemetry();
    })
    .catch(() => {
      feedStatus.nws = false; setDot("dot-nws", false);
      $("#alerts-container").html(`<span style="color:var(--red);">ALERT FEED DOWN</span>`);
    });
}
function openAlertDetails(id) {
  const a = globalActiveAlertsCache[id];
  if (!a) return;
  let body = `<div style="color:var(--red);font-weight:600;margin-bottom:8px;border-bottom:1px solid var(--line);padding-bottom:6px;">${a.headline || a.event}</div>`;
  body += `<div style="color:var(--text-dim);margin-bottom:6px;font-size:11px;">${a.severity || "—"} · ${a.urgency || "—"} · ${a.certainty || "—"}</div>`;
  body += `<div style="color:var(--text-dim);margin-bottom:8px;font-size:11px;"><b>Area:</b> ${a.areaDesc}</div>`;
  body += `<div style="background:var(--bg);padding:10px;border:1px solid var(--line);border-radius:2px;margin-bottom:10px;font-size:11px;white-space:pre-wrap;">${a.description || ""}</div>`;
  if (a.instruction) {
    body += `<div style="color:var(--amber);font-weight:600;margin-bottom:4px;"><i class="fa-solid fa-shield-halved"></i> ACTIONS</div>`;
    body += `<div style="color:var(--cyan);background:#1a1e24;padding:10px;border:1px solid var(--line);border-radius:2px;font-size:11px;white-space:pre-wrap;">${a.instruction}</div>`;
  }
  openModal("NWS ALERT", body);
}

/* ── Observations ── */
function fetchCurrentObservations() {
  fetch(`https://api.weather.gov/points/${localLat},${localLon}`)
    .then(r => r.json()).then(d => fetch(d.properties.observationStations))
    .then(r => r.json())
    .then(st => {
      const stations = (st.features || []).slice(0, 4);
      return Promise.all(stations.map(s =>
        fetch(`https://api.weather.gov/stations/${s.properties.stationIdentifier}/observations/latest`)
          .then(r => r.json())
          .then(obs => ({ id: s.properties.stationIdentifier, name: s.properties.name, obs }))
          .catch(() => null)
      ));
    })
    .then(results => {
      feedStatus.obs = true; setDot("dot-obs", true);
      const valid = (results || []).filter(Boolean);
      globalObsCache = {};
      let html = `<div class="phdr"><i class="fa-solid fa-temperature-half"></i> SURFACE STATIONS</div>`;
      if (!valid.length) html += `<span style="color:var(--orange);">NO DATA</span>`;
      else valid.forEach(item => {
        const p = item.obs.properties || {};
        const tempC = p.temperature && p.temperature.value != null ? p.temperature.value : null;
        const tempF = tempC != null ? Math.round(tempC * 9 / 5 + 32) : "—";
        const wind = p.windSpeed && p.windSpeed.value != null ? Math.round(p.windSpeed.value * 2.237) : "—";
        const rh = p.relativeHumidity && p.relativeHumidity.value != null ? Math.round(p.relativeHumidity.value) : "—";
        globalObsCache[item.id] = p;
        html += `<div class="obs-row" onclick="openObsDetails('${item.id}')">
          <div><div style="color:#fff;font-size:11px;font-weight:600;">${item.id}</div>
          <div class="obs-lbl">${(item.name || "").substring(0, 26)}</div></div>
          <div style="text-align:right;"><div class="obs-val">${tempF}°F</div>
          <div class="obs-lbl">${p.textDescription || "—"} · ${wind} mph · ${rh}%</div></div>
        </div>`;
      });
      $("#obs-container").html(html);
    })
    .catch(() => { feedStatus.obs = false; setDot("dot-obs", false); $("#obs-container").html(`<span style="color:var(--red);">OBS TIMEOUT</span>`); });
}
function openObsDetails(id) {
  const p = globalObsCache[id];
  if (!p) return;
  const tF = p.temperature && p.temperature.value != null ? ((p.temperature.value * 9 / 5) + 32).toFixed(1) : "—";
  const dF = p.dewpoint && p.dewpoint.value != null ? ((p.dewpoint.value * 9 / 5) + 32).toFixed(1) : "—";
  const wind = p.windSpeed && p.windSpeed.value != null ? (p.windSpeed.value * 2.237).toFixed(1) : "—";
  const dir = p.windDirection && p.windDirection.value != null ? p.windDirection.value + "°" : "—";
  const press = p.barometricPressure && p.barometricPressure.value != null ? (p.barometricPressure.value / 100).toFixed(1) + " hPa" : "—";
  const vis = p.visibility && p.visibility.value != null ? (p.visibility.value / 1609.34).toFixed(1) + " mi" : "—";
  openModal(`STATION ${id}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;">
      <div><span style="color:var(--text-dim);">Temp</span><br><b style="color:var(--cyan);font-size:16px;">${tF} °F</b></div>
      <div><span style="color:var(--text-dim);">Dewpoint</span><br><b style="color:var(--cyan);font-size:16px;">${dF} °F</b></div>
      <div><span style="color:var(--text-dim);">Wind</span><br><b style="color:var(--cyan);">${wind} mph @ ${dir}</b></div>
      <div><span style="color:var(--text-dim);">Humidity</span><br><b style="color:var(--cyan);">${p.relativeHumidity && p.relativeHumidity.value != null ? Math.round(p.relativeHumidity.value) + "%" : "—"}</b></div>
      <div><span style="color:var(--text-dim);">Pressure</span><br><b style="color:var(--cyan);">${press}</b></div>
      <div><span style="color:var(--text-dim);">Visibility</span><br><b style="color:var(--cyan);">${vis}</b></div>
    </div>
    <div style="margin-top:12px;color:var(--text-dim);font-size:11px;">${p.textDescription || ""} · ${p.timestamp ? new Date(p.timestamp).toLocaleString() : ""}</div>`);
}

/* ── AFD ── */
function fetchNWSDiscussion() {
  fetch("https://api.weather.gov/products/types/AFD/locations/PHI")
    .then(r => r.json())
    .then(data => {
      const products = data["@graph"] || [];
      if (!products.length) throw new Error("none");
      const latest = products[0];
      return fetch(latest["@id"] || `https://api.weather.gov/products/${latest.id}`);
    })
    .then(r => r.json())
    .then(prod => {
      const text = prod.productText || "No discussion.";
      const preview = text.length > 900 ? text.substring(0, 900) + "\n\n… [click FULL]" : text;
      window._afdFull = text;
      window._afdWhen = prod.issuanceTime || prod.creationDate || "";
      $("#discussion-container").html(`
        <div class="phdr">
          <span><i class="fa-solid fa-file-lines"></i> PHI AFD</span>
          <button onclick="openFullAFD()" style="background:transparent;border:1px solid var(--line-bright);color:var(--amber);font-family:inherit;font-size:9px;padding:1px 5px;border-radius:2px;cursor:pointer;">FULL</button>
        </div>
        <div class="txt-prod" style="cursor:pointer;" onclick="openFullAFD()">${esc(preview)}</div>`);
    })
    .catch(() => {
      $("#discussion-container").html(`
        <div class="phdr"><i class="fa-solid fa-file-lines"></i> PHI AFD</div>
        <div style="color:var(--text-dim);font-size:10px;padding:6px 0;">Discussion temporarily unavailable.</div>`);
    });
}
function openFullAFD() {
  openModal(`PHI AFD · ${window._afdWhen ? new Date(window._afdWhen).toLocaleString() : ""}`,
    `<pre class="txt-prod" style="max-height:none;border:none;background:transparent;padding:0;">${esc(window._afdFull || "")}</pre>`);
}
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/* ── Air Quality ── */
const AQI_INFO = {
  1: { label: "Good", color: "#00e400", msg: "Air quality is satisfactory." },
  2: { label: "Moderate", color: "#ffff00", msg: "Acceptable; sensitive individuals take care." },
  3: { label: "Unhealthy SG", color: "#ff7e00", msg: "Sensitive groups may experience effects." },
  4: { label: "Unhealthy", color: "#ff0000", msg: "Everyone may begin to experience effects." },
  5: { label: "Very Unhealthy", color: "#8f3f97", msg: "Health alert for everyone." },
  6: { label: "Hazardous", color: "#7e0023", msg: "Emergency conditions." }
};
function aqiSpec(val, cat) {
  if (cat && AQI_INFO[cat]) return AQI_INFO[cat];
  if (val <= 50) return AQI_INFO[1];
  if (val <= 100) return AQI_INFO[2];
  if (val <= 150) return AQI_INFO[3];
  if (val <= 200) return AQI_INFO[4];
  if (val <= 300) return AQI_INFO[5];
  return AQI_INFO[6];
}
function fetchAirQualityData() {
  const cur = `https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${localZip}&distance=25&API_KEY=${AIRNOW_API_KEY}`;
  const fc = `https://www.airnowapi.org/aq/forecast/zipCode/?format=application/json&zipCode=${localZip}&distance=25&API_KEY=${AIRNOW_API_KEY}`;
  Promise.all([fetch(cur).then(r => r.json()), fetch(fc).then(r => r.json()).catch(() => [])])
    .then(([data, forecastData]) => {
      feedStatus.aqi = true; setDot("dot-aqi", true);
      globalAQIDetailsCache = {};
      let html = `<div class="phdr"><i class="fa-solid fa-wind"></i> 19428 · LIVE</div>`;
      if (!data || !data.length) {
        html += `<div style="color:var(--orange);font-size:10px;">NO SENSOR DATA</div>`;
      } else {
        let worst = 0, worstP = null;
        data.forEach(p => {
          const c = p.Category && p.Category.Number;
          if (c && c > worst) { worst = c; worstP = p; }
        });
        if (worst >= 3 && worstP) {
          const pr = aqiSpec(worstP.AQI, worst);
          globalAQIDetailsCache.health = {
            title: `${pr.label.toUpperCase()} — ${worstP.ParameterName}`,
            body: `<div style="color:${pr.color};font-weight:600;margin-bottom:8px;">${worstP.ParameterName} — AQI ${worstP.AQI}</div>
              <div style="color:var(--text-dim);margin-bottom:6px;font-size:11px;">${worstP.ReportingArea || ""}, ${worstP.StateCode || ""}</div>
              <div style="background:var(--bg);padding:10px;border:1px solid var(--line);border-radius:2px;font-size:11px;">${pr.msg}</div>`
          };
          html += `<div style="border-left:3px solid ${pr.color};background:var(--critical);padding:5px 7px;margin-bottom:5px;border-radius:1px;cursor:pointer;" onclick="openAQIDetails('health')">
            <div style="color:${pr.color};font-weight:600;font-size:10px;"><i class="fa-solid fa-triangle-exclamation"></i> ${pr.label.toUpperCase()} — ${worstP.ParameterName}</div>
          </div>`;
        }
        const action = Array.isArray(forecastData) ? forecastData.find(f => f.ActionDay) : null;
        if (action) {
          globalAQIDetailsCache.actionday = {
            title: `AQ ACTION DAY — ${action.ReportingArea || ""}`,
            body: `<div style="color:var(--amber);font-weight:600;margin-bottom:8px;">${action.ParameterName || ""} · ${action.DateForecast || ""}</div>
              <div style="background:var(--bg);padding:10px;border:1px solid var(--line);border-radius:2px;font-size:11px;white-space:pre-wrap;">${action.Discussion || "Action Day declared."}</div>`
          };
          html += `<div style="border-left:3px solid var(--amber);background:var(--warn-bg);padding:5px 7px;margin-bottom:5px;border-radius:1px;cursor:pointer;" onclick="openAQIDetails('actionday')">
            <div style="color:var(--amber);font-weight:600;font-size:10px;"><i class="fa-solid fa-bell"></i> AIR QUALITY ACTION DAY</div>
          </div>`;
        }
        html += `<div class="aqi-grid">`;
        data.forEach((p, idx) => {
          const cat = p.Category && p.Category.Number;
          const pr = aqiSpec(p.AQI, cat);
          const key = `p-${idx}`;
          globalAQIDetailsCache[key] = {
            title: `${p.ParameterName} — ${pr.label}`,
            body: `<div style="color:${pr.color};font-weight:600;margin-bottom:8px;">${p.ParameterName} — AQI ${p.AQI}</div>
              <div style="background:var(--bg);padding:10px;border:1px solid var(--line);border-radius:2px;font-size:11px;">${pr.msg}</div>`
          };
          html += `<div class="aqi-cell" onclick="openAQIDetails('${key}')">
            <div style="font-size:8.5px;color:var(--text-dim);font-weight:600;text-transform:uppercase;">${p.ParameterName}</div>
            <div style="font-size:18px;color:${pr.color};font-weight:600;">${p.AQI}</div>
            <div style="font-size:8.5px;color:${pr.color};">${pr.label}</div>
          </div>`;
        });
        html += `</div>`;
      }
      $("#aqi-container-target").html(html);
    })
    .catch(() => { feedStatus.aqi = false; setDot("dot-aqi", false); $("#aqi-container-target").html(`<span style="color:var(--red);">AIRNOW TIMEOUT</span>`); });
}
function openAQIDetails(key) {
  const d = globalAQIDetailsCache[key];
  if (d) openModal(d.title, d.body);
}

/* ── Tides ── */
function fetchNOAATides() {
  const st = "8545240";
  const base = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${st}&time_zone=lst_ldt&units=english&format=json&date=today`;
  Promise.all([
    fetch(`${base}&product=water_level&datum=MLLW`).then(r => r.json()),
    fetch(`${base}&product=water_level&datum=NAVD`).then(r => r.json()),
    fetch(`${base}&product=predictions&datum=MLLW`).then(r => r.json()),
    fetch(`${base}&product=air_temperature`).then(r => r.json())
  ]).then(([wlM, wlN, pred, air]) => {
    feedStatus.tides = true; setDot("dot-tides", true);
    const lm = wlM.data ? wlM.data[wlM.data.length - 1] : null;
    const ln = wlN.data ? wlN.data[wlN.data.length - 1] : null;
    const la = air.data ? air.data[air.data.length - 1] : null;
    let g = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;width:100%;">`;
    if (lm) g += `<div style="background:var(--bg-elev);border:1px solid var(--line);border-radius:2px;padding:5px;text-align:center;"><div style="font-size:8.5px;color:var(--text-dim);">MLLW</div><div style="font-size:15px;color:var(--cyan);font-weight:600;">${lm.v}</div><div style="font-size:8px;color:var(--text-dim);">ft</div></div>`;
    if (ln) g += `<div style="background:var(--bg-elev);border:1px solid var(--line);border-radius:2px;padding:5px;text-align:center;"><div style="font-size:8.5px;color:var(--text-dim);">NAVD</div><div style="font-size:15px;color:var(--cyan);font-weight:600;">${ln.v}</div><div style="font-size:8px;color:var(--text-dim);">ft</div></div>`;
    if (la) g += `<div style="background:var(--bg-elev);border:1px solid var(--line);border-radius:2px;padding:5px;text-align:center;"><div style="font-size:8.5px;color:var(--text-dim);">AIR</div><div style="font-size:15px;color:var(--cyan);font-weight:600;">${la.v}</div><div style="font-size:8px;color:var(--text-dim);">°F</div></div>`;
    g += `</div>`;
    $("#noaa-gauges").html(g);
    const labels = wlM.data ? wlM.data.map(d => { const t = d.t.split(" ")[1].split(":"); return t[0] + ":" + t[1]; }) : [];
    const dm = wlM.data ? wlM.data.map(d => parseFloat(d.v)) : [];
    const dp = pred.predictions ? pred.predictions.map(d => parseFloat(d.v)) : [];
    const canvas = document.getElementById("noaaChart");
    if (!canvas) return;
    if (noaaChartInstance) noaaChartInstance.destroy();
    Chart.defaults.color = "#7a8494";
    Chart.defaults.font.family = "'IBM Plex Mono', monospace";
    noaaChartInstance = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Obs MLLW", data: dm, borderColor: "#4ecdc4", backgroundColor: "rgba(78,205,196,0.08)", borderWidth: 1.5, pointRadius: 0, fill: true, tension: 0.35 },
          { label: "Pred MLLW", data: dp.slice(0, labels.length), borderColor: "#e74c3c", borderDash: [3, 3], borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.35 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: { legend: { display: true, position: "top", labels: { boxWidth: 8, usePointStyle: true, font: { size: 9 } } } },
        scales: {
          x: { ticks: { maxTicksLimit: 5, font: { size: 8 } }, grid: { color: "#1e242c" } },
          y: { ticks: { font: { size: 8 } }, grid: { color: "#1e242c" } }
        }
      }
    });
  }).catch(() => {
    feedStatus.tides = false; setDot("dot-tides", false);
    $("#noaa-gauges").html(`<span style="color:var(--red);font-size:10px;">NOAA TIMEOUT</span>`);
  });
}

/* ── Hydro ── */
function fetchSchuylkillHydrology() {
  feedStatus.hydro = true; setDot("dot-hydro", true);
  let html = `<div class="phdr"><i class="fa-solid fa-water"></i> SCHUYLKILL BASIN</div>`;
  schuylkillGauges.forEach(g => {
    html += `<div class="g-card">
      <div style="font-weight:600;color:#fff;font-size:11px;">${g.name}</div>
      <div style="color:var(--cyan);margin:2px 0;font-size:9.5px;">USGS-${g.id}</div>
      <button class="g-btn" onclick="openHydro('${g.id}','${g.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-chart-line"></i> Hydrograph</button>
    </div>`;
  });
  $("#hydro-river-list").html(html);
}
function openHydro(id, name) {
  const url = `https://dashboard.waterdata.usgs.gov/api/gwis/2.1/service/site?agencyCode=USGS&siteNumber=${id}&open=plots&banner=false&pad=false`;
  openModal(`USGS · ${name}`, `<div style="height:480px;"><iframe src="${url}" style="width:100%;height:100%;border:none;border-radius:2px;background:#fff;"></iframe></div>`);
}

/* ── Modal ── */
function openModal(title, html) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = html;
  document.getElementById("hubModal").style.display = "flex";
}
function closeModal() {
  document.getElementById("hubModal").style.display = "none";
  document.getElementById("modalBody").innerHTML = "";
}

/* ── Cycle ── */
function fullRefresh() {
  fetchNWSForecast();
  fetchHourlyForecast();
  fetchPennsylvaniaAlerts();
  fetchAirQualityData();
  fetchNOAATides();
  fetchSchuylkillHydrology();
  fetchCurrentObservations();
  fetchNWSDiscussion();
  markSync();
  updateTelemetry();
}
setInterval(() => {
  countdownVal--;
  if (countdownVal <= 0) { countdownVal = 120; fullRefresh(); }
  const t = document.getElementById("countdown");
  if (t) t.textContent = countdownVal;
  const tc = document.getElementById("t-cycle");
  if (tc) tc.textContent = countdownVal;
}, 1000);
setInterval(updateClock, 1000);
updateClock();
window.addEventListener("resize", () => layout.updateSize());
document.addEventListener("DOMContentLoaded", () => { initAudioToggle(); markSync(); });
