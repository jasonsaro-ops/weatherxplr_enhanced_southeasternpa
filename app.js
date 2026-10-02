/**
 * WEATHERXPLR — SE-PA Mission Display
 * Dense ops-console dashboard · NWS + Open-Meteo · single radar · tiered tones
 */
const LAT = 40.0759, LON = -75.2996, ZIP = "19428";
const AIRNOW_KEY = "E5AFEF36-80F6-4A42-AE38-F3C56E3AEAC4";
const CYCLE = 120;

const GAUGES = [
  { id: "01472000", name: "Schuylkill @ Reading" },
  { id: "01473500", name: "Schuylkill @ Pottstown" },
  { id: "01474500", name: "Schuylkill @ Norriton" },
  { id: "01474703", name: "Schuylkill @ Conshohocken" },
  { id: "01474000", name: "Schuylkill @ Fairmount Dam" }
];

const LAYERS = [
  ["Radar / Sat", [["radar","Weather Radar"],["satellite","Satellite"]]],
  ["Wind", [["wind","Wind"],["gust","Gusts"],["pressure","Pressure"]]],
  ["Temp", [["temp","Temperature"],["dewpoint","Dew Point"],["rh","Humidity"]]],
  ["Precip", [["rain","Rain"],["thunder","Thunderstorms"],["snow","Snow"]]],
  ["Clouds", [["clouds","Clouds"],["cape","CAPE"],["fog","Fog"]]],
  ["Other", [["waves","Waves"],["airquality","AQI"],["fire","Fire Danger"]]]
];

let cd = CYCLE, audioOn = false, audioCtx = null;
let alertCache = {}, obsCache = {}, aqiCache = {};
let prevAlertIds = new Set(), hasBaseline = false;
let nwsPeriods = null, omData = null, afdFull = "";
let tideChart = null;
const feed = { nws: true, om: true, aqi: true, hydro: true, tides: true };

/* ── Audio (tiered) ── */
function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function tone(freq, t0, dur, type, peak) {
  const c = ctx(), o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.02);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function playExtreme() {
  const n = ctx().currentTime;
  [880, 660, 880, 660, 880, 660].forEach((f, i) => tone(f, n + i * 0.14, 0.13, "sawtooth", 0.22));
}
function playSevere() {
  const n = ctx().currentTime;
  tone(523.25, n, 0.32, "sine", 0.2);
  tone(784, n + 0.28, 0.4, "sine", 0.2);
}
function playAdvisory() {
  const n = ctx().currentTime;
  tone(440, n, 0.1, "triangle", 0.18);
  tone(440, n + 0.17, 0.1, "triangle", 0.18);
}
const TONES = { extreme: playExtreme, severe: playSevere, moderate: playSevere, minor: playAdvisory, unknown: playAdvisory };
function playSevs(set) {
  let d = 0;
  ["extreme", "severe", "moderate", "minor", "unknown"].forEach(s => {
    if (!set.has(s)) return;
    setTimeout(() => TONES[s](), d);
    d += 900;
  });
}

function initAudio() {
  const btn = document.getElementById("btn-audio");
  try { audioOn = localStorage.getItem("wx_tones") === "1"; } catch (e) {}
  syncAudioUI();
  btn.addEventListener("click", () => {
    audioOn = !audioOn;
    try { localStorage.setItem("wx_tones", audioOn ? "1" : "0"); } catch (e) {}
    if (audioOn) { ctx(); playAdvisory(); }
    syncAudioUI();
  });
}
function syncAudioUI() {
  const btn = document.getElementById("btn-audio");
  const ico = document.getElementById("audio-ico");
  const lbl = document.getElementById("audio-lbl");
  btn.classList.toggle("audio-on", audioOn);
  ico.className = audioOn ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark";
  lbl.textContent = audioOn ? "TONES ON" : "TONES OFF";
}

/* ── UI helpers ── */
function $(id) { return document.getElementById(id); }
function sevClass(s) {
  s = (s || "").toLowerCase();
  if (["extreme", "severe", "moderate", "minor"].includes(s)) return "sev-" + s;
  return "sev-unknown";
}
function sevKey(s) {
  s = (s || "").toLowerCase();
  return ["extreme", "severe", "moderate", "minor"].includes(s) ? s : "unknown";
}
function setFeed(id, ok) {
  const el = $("d-" + id);
  if (el) el.classList.toggle("off", !ok);
  feed[id] = ok;
}
function openModal(title, html, sev) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = html;
  const m = $("modal");
  m.className = "modal" + (sev ? " " + sevClass(sev) : "");
  $("modal-bg").classList.add("open");
}
function closeModal() {
  $("modal-bg").classList.remove("open");
  $("modal-body").innerHTML = "";
}
window.closeModal = closeModal;

function windyUrl(layer) {
  const prod = layer === "radar" || layer === "satellite" ? layer : "gfs";
  return `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=f&metricWind=mph&zoom=8&overlay=${layer}&product=${prod}&level=surface&lat=${LAT}&lon=${LON}`;
}

function initRadar() {
  const sel = $("layer-sel");
  let h = "";
  LAYERS.forEach(([g, items]) => {
    h += `<optgroup label="${g}">`;
    items.forEach(([v, l]) => { h += `<option value="${v}"${v === "radar" ? " selected" : ""}>${l}</option>`; });
    h += `</optgroup>`;
  });
  sel.innerHTML = h;
  $("radar-frame").src = windyUrl("radar");
  sel.addEventListener("change", () => { $("radar-frame").src = windyUrl(sel.value); });
}

function tickClock() {
  const now = new Date();
  const loc = now.toLocaleTimeString("en-US", { hour12: false });
  const utc = now.toISOString().substr(11, 8) + "Z";
  $("clock").textContent = `${loc} L · ${utc}`;
}

/* ── Open-Meteo current + daily/hourly ── */
async function fetchOpenMeteo() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York&forecast_days=7`;
  try {
    const r = await fetch(url);
    omData = await r.json();
    setFeed("om", true);
    renderConditions();
    renderForecast();
  } catch (e) {
    setFeed("om", false);
    console.error(e);
  }
}

const WMO = {
  0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
  80: "Rain showers", 81: "Rain showers", 82: "Heavy showers", 95: "Thunderstorm", 96: "T-storm hail", 99: "T-storm heavy hail"
};

function renderConditions() {
  const c = omData && omData.current;
  if (!c) {
    $("panel-conditions").innerHTML = `<span class="err">Open-Meteo unavailable</span>`;
    return;
  }
  const desc = WMO[c.weather_code] || "—";
  $("panel-conditions").innerHTML = `
    <div class="cond-hero">
      <div>
        <div class="cond-temp">${Math.round(c.temperature_2m)}<span class="cond-unit">°F</span></div>
        <div class="cond-desc">${desc}</div>
      </div>
      <div class="cond-meta">
        <div class="metric"><div class="lab">Feels</div><div class="val">${Math.round(c.apparent_temperature)}°</div></div>
        <div class="metric"><div class="lab">Humidity</div><div class="val">${c.relative_humidity_2m}%</div></div>
        <div class="metric"><div class="lab">Wind</div><div class="val">${Math.round(c.wind_speed_10m)} mph</div></div>
        <div class="metric"><div class="lab">Gusts</div><div class="val">${Math.round(c.wind_gusts_10m || 0)} mph</div></div>
        <div class="metric"><div class="lab">Pressure</div><div class="val">${Math.round(c.pressure_msl)} hPa</div></div>
        <div class="metric"><div class="lab">Clouds</div><div class="val">${c.cloud_cover}%</div></div>
        <div class="metric"><div class="lab">Precip</div><div class="val">${(c.precipitation || 0).toFixed(2)} in</div></div>
        <div class="metric"><div class="lab">Dir</div><div class="val">${c.wind_direction_10m}°</div></div>
      </div>
    </div>
    <div style="font-size:10px;color:var(--text-dim);font-family:var(--font-mono)">Updated ${c.time || "—"} · Open-Meteo</div>`;
}

/* ── NWS forecast (icons) + merge display ── */
async function fetchNWSForecast() {
  try {
    const pts = await fetch(`https://api.weather.gov/points/${LAT},${LON}`).then(r => r.json());
    const fc = await fetch(pts.properties.forecast).then(r => r.json());
    nwsPeriods = fc.properties.periods;
    setFeed("nws", true);
    renderForecast();
  } catch (e) {
    setFeed("nws", false);
    console.error(e);
  }
}

function renderForecast() {
  let html = "";
  // Daily from Open-Meteo preferred for consistency; NWS icons when available
  if (omData && omData.daily) {
    const d = omData.daily;
    html += `<div style="margin-bottom:8px;font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px;font-family:var(--font-mono)">7-Day</div>`;
    html += `<div class="fc-row">`;
    for (let i = 0; i < (d.time || []).length; i++) {
      const day = new Date(d.time[i] + "T12:00:00");
      const label = i === 0 ? "Today" : day.toLocaleDateString("en-US", { weekday: "short" });
      const code = d.weather_code[i];
      html += `<div class="fc-day" onclick="openDayDetail(${i})">
        <div class="d">${label}</div>
        <div style="font-size:10px;color:var(--text-mid);margin:2px 0">${WMO[code] || ""}</div>
        <div class="t"><span class="hi">${Math.round(d.temperature_2m_max[i])}°</span>
        <span style="color:var(--text-dim)">/</span>
        <span class="lo">${Math.round(d.temperature_2m_min[i])}°</span></div>
        <div style="font-size:10px;color:var(--blue)">${d.precipitation_probability_max[i] != null ? d.precipitation_probability_max[i] + "%" : "—"}</div>
      </div>`;
    }
    html += `</div>`;
  } else if (nwsPeriods) {
    html += `<div class="fc-row">`;
    nwsPeriods.slice(0, 14).forEach((p, i) => {
      html += `<div class="fc-day" onclick="openNwsPeriod(${i})">
        <div class="d">${p.name}</div>
        <img src="${p.icon}" alt="">
        <div class="t ${p.isDaytime ? "hi" : "lo"}">${p.temperature}°</div>
      </div>`;
    });
    html += `</div>`;
  }

  // Hourly next 24 from Open-Meteo
  if (omData && omData.hourly) {
    const h = omData.hourly;
    const now = Date.now();
    html += `<div style="margin:10px 0 6px;font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px;font-family:var(--font-mono)">Next 24 Hours</div>`;
    html += `<div class="hr-row">`;
    let shown = 0;
    for (let i = 0; i < h.time.length && shown < 24; i++) {
      const t = new Date(h.time[i]);
      if (t.getTime() < now - 3600000) continue;
      const lab = t.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
      html += `<div class="hr-cell">
        <div class="h">${lab}</div>
        <div class="t">${Math.round(h.temperature_2m[i])}°</div>
        <div class="p">${h.precipitation_probability[i] != null ? h.precipitation_probability[i] + "%" : "—"}</div>
      </div>`;
      shown++;
    }
    html += `</div>`;
  }

  $("panel-forecast").innerHTML = html || `<span class="err">Forecast unavailable</span>`;
}

window.openDayDetail = function (i) {
  if (!omData || !omData.daily) return;
  const d = omData.daily;
  const day = d.time[i];
  openModal(`Forecast · ${day}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="metric"><div class="lab">High</div><div class="val">${Math.round(d.temperature_2m_max[i])}°F</div></div>
      <div class="metric"><div class="lab">Low</div><div class="val">${Math.round(d.temperature_2m_min[i])}°F</div></div>
      <div class="metric"><div class="lab">Precip</div><div class="val">${(d.precipitation_sum[i] || 0).toFixed(2)} in</div></div>
      <div class="metric"><div class="lab">PoP max</div><div class="val">${d.precipitation_probability_max[i] ?? "—"}%</div></div>
      <div class="metric"><div class="lab">Wind max</div><div class="val">${Math.round(d.wind_speed_10m_max[i])} mph</div></div>
      <div class="metric"><div class="lab">Conditions</div><div class="val">${WMO[d.weather_code[i]] || "—"}</div></div>
    </div>`);
};
window.openNwsPeriod = function (i) {
  const p = nwsPeriods && nwsPeriods[i];
  if (!p) return;
  openModal(p.name, `<div style="text-align:center;margin-bottom:12px"><img src="${p.icon}" style="width:56px"><div style="font-size:28px;font-weight:700;margin:6px 0">${p.temperature}°${p.temperatureUnit}</div><div style="color:var(--amber)">${p.shortForecast}</div></div><p>${p.detailedForecast}</p>`);
};

/* ── Alerts ── */
async function fetchAlerts() {
  try {
    const data = await fetch("https://api.weather.gov/alerts/active?area=PA").then(r => r.json());
    const feats = data.features || [];
    alertCache = {};
    const ids = new Set();
    const newSevs = new Set();
    feats.sort((a, b) => {
      const o = { extreme: 0, severe: 1, moderate: 2, minor: 3 };
      return (o[(a.properties.severity || "").toLowerCase()] ?? 4) - (o[(b.properties.severity || "").toLowerCase()] ?? 4);
    });
    let html = "";
    let worst = null;
    if (!feats.length) {
      html = `<div class="empty"><i class="fa-solid fa-check"></i> Clear — no active PA alerts</div>`;
    } else {
      feats.forEach(f => {
        const p = f.properties;
        alertCache[p.id] = p;
        ids.add(p.id);
        const sk = sevKey(p.severity);
        if (hasBaseline && !prevAlertIds.has(p.id)) newSevs.add(sk);
        if (!worst || ({ extreme: 0, severe: 1, moderate: 2, minor: 3 }[sk] ?? 4) < ({ extreme: 0, severe: 1, moderate: 2, minor: 3 }[worst] ?? 4)) worst = sk;
        const col = sk === "extreme" || sk === "severe" ? "var(--err)" : "var(--warn)";
        html += `<div class="alert-card ${sevClass(p.severity)}" onclick="openAlert('${p.id}')">
          <div class="alert-ev" style="color:${col}">${p.event}</div>
          <div class="alert-meta">${p.severity || "—"} · ${(p.areaDesc || "").substring(0, 70)}${(p.areaDesc || "").length > 70 ? "…" : ""}</div>
        </div>`;
      });
    }
    if (hasBaseline && newSevs.size && audioOn) playSevs(newSevs);
    if (!hasBaseline) hasBaseline = true;
    prevAlertIds = ids;

    $("panel-alerts").innerHTML = html;
    $("alert-tag").textContent = feats.length ? feats.length + " ACTIVE" : "CLEAR";
    const chip = $("chip-alerts");
    chip.textContent = "ALERTS " + feats.length;
    chip.classList.toggle("alert", feats.length > 0);

    const wrap = $("panel-alerts-wrap");
    wrap.className = "panel" + (worst ? " " + sevClass(worst) : "");
    setFeed("nws", true);
  } catch (e) {
    setFeed("nws", false);
    $("panel-alerts").innerHTML = `<span class="err">Alert feed down</span>`;
  }
}
window.openAlert = function (id) {
  const a = alertCache[id];
  if (!a) return;
  let body = `<div style="color:var(--err);font-weight:700;margin-bottom:8px">${a.headline || a.event}</div>`;
  body += `<div style="color:var(--text-dim);font-size:12px;margin-bottom:8px">${a.severity || "—"} · ${a.urgency || "—"} · ${a.certainty || "—"}</div>`;
  body += `<div style="margin-bottom:8px"><b>Area:</b> ${a.areaDesc || ""}</div>`;
  body += `<div style="background:var(--raise);padding:12px;border:1px solid var(--line);white-space:pre-wrap;font-size:12px">${a.description || ""}</div>`;
  if (a.instruction) body += `<div style="margin-top:12px;color:var(--amber);font-weight:600">ACTIONS</div><div style="background:var(--raise);padding:12px;border:1px solid var(--line);white-space:pre-wrap;font-size:12px;color:var(--cyan)">${a.instruction}</div>`;
  openModal("NWS Alert", body, a.severity);
};

/* ── Observations ── */
async function fetchObs() {
  try {
    const pts = await fetch(`https://api.weather.gov/points/${LAT},${LON}`).then(r => r.json());
    const st = await fetch(pts.properties.observationStations).then(r => r.json());
    const stations = (st.features || []).slice(0, 5);
    const results = await Promise.all(stations.map(s =>
      fetch(`https://api.weather.gov/stations/${s.properties.stationIdentifier}/observations/latest`)
        .then(r => r.json())
        .then(obs => ({ id: s.properties.stationIdentifier, name: s.properties.name, obs }))
        .catch(() => null)
    ));
    obsCache = {};
    let html = "";
    results.filter(Boolean).forEach(item => {
      const p = item.obs.properties || {};
      const tC = p.temperature && p.temperature.value;
      const tF = tC != null ? Math.round(tC * 9 / 5 + 32) : "—";
      const wind = p.windSpeed && p.windSpeed.value != null ? Math.round(p.windSpeed.value * 2.237) : "—";
      obsCache[item.id] = p;
      html += `<div class="row-item" onclick="openObs('${item.id}','${(item.name || "").replace(/'/g, "")}')">
        <div><div class="nm">${item.id}</div><div class="sub">${(item.name || "").substring(0, 28)}</div></div>
        <div style="text-align:right"><div class="rv">${tF}°F</div><div class="sub">${p.textDescription || "—"} · ${wind} mph</div></div>
      </div>`;
    });
    $("panel-obs").innerHTML = html || `<span class="err">No obs</span>`;
  } catch (e) {
    $("panel-obs").innerHTML = `<span class="err">Obs timeout</span>`;
  }
}
window.openObs = function (id, name) {
  const p = obsCache[id];
  if (!p) return;
  const tF = p.temperature && p.temperature.value != null ? ((p.temperature.value * 9 / 5) + 32).toFixed(1) : "—";
  const dF = p.dewpoint && p.dewpoint.value != null ? ((p.dewpoint.value * 9 / 5) + 32).toFixed(1) : "—";
  const wind = p.windSpeed && p.windSpeed.value != null ? (p.windSpeed.value * 2.237).toFixed(1) : "—";
  openModal(`Station ${id}`, `
    <div style="font-size:12px;color:var(--text-dim);margin-bottom:10px">${name || ""}</div>
    <div class="g2">
      <div class="metric"><div class="lab">Temp</div><div class="val">${tF}°F</div></div>
      <div class="metric"><div class="lab">Dewpoint</div><div class="val">${dF}°F</div></div>
      <div class="metric"><div class="lab">Wind</div><div class="val">${wind} mph</div></div>
      <div class="metric"><div class="lab">Humidity</div><div class="val">${p.relativeHumidity && p.relativeHumidity.value != null ? Math.round(p.relativeHumidity.value) + "%" : "—"}</div></div>
    </div>
    <div style="margin-top:12px;color:var(--text-dim);font-size:12px">${p.textDescription || ""} · ${p.timestamp ? new Date(p.timestamp).toLocaleString() : ""}</div>
    ${p.rawMessage ? `<pre style="margin-top:10px;background:var(--raise);padding:10px;font-size:11px;overflow:auto">${p.rawMessage}</pre>` : ""}`);
};

/* ── AQI ── */
async function fetchAQI() {
  try {
    const url = `https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${ZIP}&distance=25&API_KEY=${AIRNOW_KEY}`;
    const data = await fetch(url).then(r => r.json());
    setFeed("aqi", true);
    aqiCache = {};
    if (!data || !data.length) {
      $("panel-aqi").innerHTML = `<span class="err">No AQI data</span>`;
      return;
    }
    const colors = { 1: "#00e400", 2: "#ffff00", 3: "#ff7e00", 4: "#ff0000", 5: "#8f3f97", 6: "#7e0023" };
    let html = `<div class="g2">`;
    data.forEach((p, i) => {
      const n = p.Category && p.Category.Number;
      const col = colors[n] || "#8ea1b3";
      aqiCache[i] = p;
      html += `<div class="aqi-cell" onclick="openAQI(${i})">
        <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase">${p.ParameterName}</div>
        <div class="aqi-n" style="color:${col}">${p.AQI}</div>
        <div class="aqi-l" style="color:${col}">${p.Category && p.Category.Name || ""}</div>
      </div>`;
    });
    html += `</div>`;
    $("panel-aqi").innerHTML = html;
  } catch (e) {
    setFeed("aqi", false);
    $("panel-aqi").innerHTML = `<span class="err">AirNow timeout</span>`;
  }
}
window.openAQI = function (i) {
  const p = aqiCache[i];
  if (!p) return;
  openModal(`${p.ParameterName} · AQI ${p.AQI}`, `
    <div class="metric"><div class="lab">Category</div><div class="val">${p.Category && p.Category.Name || "—"}</div></div>
    <div style="margin-top:10px;color:var(--text-dim)">${p.ReportingArea || ""}, ${p.StateCode || ""} · ${p.DateObserved || ""} ${p.HourObserved != null ? p.HourObserved + ":00" : ""}</div>`);
};

/* ── Hydro ── */
function fetchHydro() {
  setFeed("hydro", true);
  let html = "";
  GAUGES.forEach(g => {
    html += `<div class="row-item" style="cursor:default">
      <div><div class="nm">${g.name}</div><div class="sub">USGS ${g.id}</div></div>
      <button class="btn-link" style="width:auto" onclick="openHydro('${g.id}','${g.name.replace(/'/g, "\\'")}')">Hydrograph</button>
    </div>`;
  });
  $("panel-hydro").innerHTML = html;
}
window.openHydro = function (id, name) {
  const url = `https://dashboard.waterdata.usgs.gov/api/gwis/2.1/service/site?agencyCode=USGS&siteNumber=${id}&open=plots&banner=false&pad=false`;
  openModal(`USGS · ${name}`, `<div style="height:420px"><iframe src="${url}" style="width:100%;height:100%;border:none;background:#fff;border-radius:2px"></iframe></div>`);
};

/* ── Tides ── */
async function fetchTides() {
  const st = "8545240";
  const base = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${st}&time_zone=lst_ldt&units=english&format=json&date=today`;
  try {
    const [wl, pred, air] = await Promise.all([
      fetch(`${base}&product=water_level&datum=MLLW`).then(r => r.json()),
      fetch(`${base}&product=predictions&datum=MLLW`).then(r => r.json()),
      fetch(`${base}&product=air_temperature`).then(r => r.json())
    ]);
    setFeed("tides", true);
    const last = wl.data && wl.data[wl.data.length - 1];
    const la = air.data && air.data[air.data.length - 1];
    let html = `<div class="g2" style="margin-bottom:8px">
      <div class="metric"><div class="lab">MLLW</div><div class="val">${last ? last.v + " ft" : "—"}</div></div>
      <div class="metric"><div class="lab">Air</div><div class="val">${la ? la.v + "°F" : "—"}</div></div>
    </div>
    <div style="height:120px;position:relative"><canvas id="tide-chart"></canvas></div>`;
    $("panel-tides").innerHTML = html;

    const labels = (wl.data || []).map(d => d.t.split(" ")[1].slice(0, 5));
    const obs = (wl.data || []).map(d => parseFloat(d.v));
    const pr = (pred.predictions || []).map(d => parseFloat(d.v)).slice(0, labels.length);
    const canvas = $("tide-chart");
    if (canvas) {
      if (tideChart) tideChart.destroy();
      Chart.defaults.color = "#4f6478";
      Chart.defaults.font.family = "JetBrains Mono";
      tideChart = new Chart(canvas, {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Obs", data: obs, borderColor: "#2ec4b6", borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.3 },
            { label: "Pred", data: pr, borderColor: "#ff5252", borderDash: [3, 3], borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.3 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: true, labels: { boxWidth: 8, font: { size: 10 } } } },
          scales: {
            x: { ticks: { maxTicksLimit: 6, font: { size: 9 } }, grid: { color: "#141e2a" } },
            y: { ticks: { font: { size: 9 } }, grid: { color: "#141e2a" } }
          }
        }
      });
    }
  } catch (e) {
    setFeed("tides", false);
    $("panel-tides").innerHTML = `<span class="err">NOAA timeout</span>`;
  }
}

/* ── AFD ── */
async function fetchAFD() {
  try {
    const list = await fetch("https://api.weather.gov/products/types/AFD/locations/PHI").then(r => r.json());
    const g = list["@graph"] || [];
    if (!g.length) throw new Error("none");
    const prod = await fetch(g[0]["@id"] || `https://api.weather.gov/products/${g[0].id}`).then(r => r.json());
    afdFull = prod.productText || "";
    const preview = afdFull.length > 400 ? afdFull.slice(0, 400) + "…" : afdFull;
    const el = $("panel-afd");
    el.textContent = preview;
    el.onclick = () => openModal("PHI Area Forecast Discussion", `<pre style="white-space:pre-wrap;font-size:12px;font-family:var(--font-mono)">${afdFull.replace(/</g, "&lt;")}</pre>`);
  } catch (e) {
    $("panel-afd").textContent = "AFD temporarily unavailable";
  }
}

/* ── Cycle ── */
async function refreshAll() {
  await Promise.all([
    fetchOpenMeteo(),
    fetchNWSForecast(),
    fetchAlerts(),
    fetchObs(),
    fetchAQI(),
    fetchTides(),
    fetchAFD()
  ]);
  fetchHydro();
  $("chip-sync").textContent = "SYNC " + new Date().toLocaleTimeString("en-US", { hour12: false });
}

function boot() {
  initRadar();
  initAudio();
  tickClock();
  setInterval(tickClock, 1000);
  refreshAll();
  setInterval(() => {
    cd--;
    if (cd <= 0) { cd = CYCLE; refreshAll(); }
    $("cd").textContent = cd;
  }, 1000);
}

document.addEventListener("DOMContentLoaded", boot);
