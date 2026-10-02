/**
 * WEATHERXPLR — SE-PA Mission Display
 * Dense ops-console dashboard · NWS + Open-Meteo · single radar · tiered tones
 */
const LAT = 40.0759, LON = -75.2996, ZIP = "19428";
const OWM_KEY = "591facdee3ec07d8e79519288c97d2a1"; // OpenWeatherMap free (activates ~2h after signup)
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
    // Statewide PA + adjacent NJ/DE (SE-PA regional) — not limited to PHI/Mount Holly
    const urls = [
      "https://api.weather.gov/alerts/active?area=PA",
      "https://api.weather.gov/alerts/active?area=NJ",
      "https://api.weather.gov/alerts/active?area=DE"
    ];
    const results = await Promise.all(urls.map(u => fetch(u).then(r => r.json()).catch(() => ({ features: [] }))));
    const seen = new Set();
    const feats = [];
    results.forEach(data => {
      (data.features || []).forEach(f => {
        const id = f.properties && f.properties.id;
        if (id && !seen.has(id)) { seen.add(id); feats.push(f); }
      });
    });
    // OpenWeatherMap (api.openweathermap.org) — free current weather + optional One Call alerts
    // NOTE: Free plan does NOT include a government-alert feed like NWS CAP.
    // One Call 3.0 alerts require a separate paid subscription; we still try gracefully.
    let wapiAlerts = []; // reused name = "secondary source alerts"
    let wapiStatus = null;
    try {
      const cur = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&units=imperial&appid=${OWM_KEY}`
      ).then(r => r.json());
      if (cur.cod && Number(cur.cod) !== 200) {
        wapiStatus = cur.message || ("OWM " + cur.cod);
        console.warn("OpenWeatherMap:", cur);
      } else {
        wapiStatus = "ok";
        // Stash current for optional UI (conditions already from Open-Meteo)
        window.__owmCurrent = cur;
      }
      // Try One Call 3.0 for alerts (may fail on free plan — expected)
      try {
        const oc = await fetch(
          `https://api.openweathermap.org/data/3.0/onecall?lat=${LAT}&lon=${LON}&units=imperial&appid=${OWM_KEY}`
        ).then(r => r.json());
        if (oc.alerts && oc.alerts.length) {
          wapiAlerts = oc.alerts.map(a => ({
            event: a.event,
            headline: a.event,
            severity: "Unknown",
            urgency: "",
            certainty: "",
            areas: (a.tags || []).join(", ") || "Regional",
            desc: a.description || "",
            instruction: "",
            category: "OpenWeatherMap",
            sender_name: a.sender_name || "OWM"
          }));
        } else if (oc.cod || oc.message) {
          // no alerts or no access — fine
        }
      } catch (e2) { /* optional */ }
    } catch (e) {
      wapiStatus = "unreachable";
      console.warn("OpenWeatherMap fetch failed", e);
    }

    // Supplemental: SPC Day-1 categorical outlook (opens in-app modal)
    let spcNote = null;
    let spcDetail = null;
    try {
      const spc = await fetch("https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson").then(r => r.json());
      const labels = (spc.features || []).map(f => (f.properties && (f.properties.LABEL || f.properties.label)) || "").filter(Boolean);
      const uniq = [...new Set(labels)];
      const counts = {};
      labels.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
      if (uniq.length) {
        spcNote = "SPC Day-1: " + uniq.join(", ");
        spcDetail = { labels: uniq, counts, featureCount: (spc.features || []).length };
      } else {
        spcNote = "SPC Day-1: no categorical risk areas";
        spcDetail = { labels: [], counts: {}, featureCount: 0 };
      }
      window.__spcDetail = spcDetail;
      window.__spcNote = spcNote;
    } catch (e) { /* optional */ }

    alertCache = {};
    const ids = new Set();
    const newSevs = new Set();
    feats.sort((a, b) => {
      const o = { extreme: 0, severe: 1, moderate: 2, minor: 3 };
      return (o[(a.properties.severity || "").toLowerCase()] ?? 4) - (o[(b.properties.severity || "").toLowerCase()] ?? 4);
    });
    let html = "";
    let worst = null;
    if (spcNote) {
      html += `<div class="row-item" style="border-left:3px solid var(--warn);margin-bottom:6px;cursor:pointer" onclick="openSPC()">
        <div><div class="nm" style="color:var(--warn)">SPC Convective Outlook</div><div class="sub">${spcNote}</div></div>
        <div class="rv" style="font-size:11px;color:var(--amber)">VIEW</div>
      </div>`;
    }
    // WeatherAPI alerts (dedupe loosely against NWS by event+areas)
    const nwsEventKeys = new Set(feats.map(f => {
      const p = f.properties || {};
      return ((p.event || "") + "|" + (p.areaDesc || "").slice(0, 40)).toLowerCase();
    }));
    wapiAlerts.forEach((a, i) => {
      const key = ((a.event || a.headline || "") + "|" + (a.areas || "").slice(0, 40)).toLowerCase();
      if (nwsEventKeys.has(key)) return;
      const sev = (a.severity || "Unknown").toLowerCase();
      const sk = sev.includes("extreme") ? "extreme" : sev.includes("severe") ? "severe" : sev.includes("moderate") ? "moderate" : sev.includes("minor") ? "minor" : "unknown";
      const id = "wapi-" + i;
      alertCache[id] = {
        id, event: a.event || a.headline || "WeatherAPI Alert",
        severity: a.severity || "Unknown",
        urgency: a.urgency || "",
        certainty: a.certainty || "",
        areaDesc: a.areas || "",
        headline: a.headline || a.event || "",
        description: a.desc || a.note || "",
        instruction: a.instruction || "",
        senderName: "OpenWeather · " + (a.category || "Gov"),
        _source: "weatherapi"
      };
      // Count toward new-alert tones
      if (hasBaseline && !prevAlertIds.has(id)) {
        /* WeatherAPI ids change; skip tone spam on source-only dupes */
      }
      const col = sk === "extreme" || sk === "severe" ? "var(--err)" : "var(--warn)";
      html += `<div class="alert-card ${sevClass(sk)}" onclick="openAlert('${id}')">
        <div class="alert-ev" style="color:${col}">${a.event || a.headline || "Alert"}</div>
        <div class="alert-meta">${a.severity || "—"} · OpenWeather · ${(a.areas || "").substring(0, 55)}${(a.areas || "").length > 55 ? "…" : ""}</div>
      </div>`;
    });
    if (wapiStatus && wapiStatus !== "ok" && !wapiAlerts.length) {
      html += `<div style="font-size:10px;color:var(--text-dim);font-family:var(--font-mono);margin:4px 0">OpenWeather: ${wapiStatus}</div>`;
    }
    if (!feats.length) {
      html += `<div class="empty"><i class="fa-solid fa-check"></i> Clear — no active NWS alerts (PA / NJ / DE)</div>`;
    } else {
      feats.forEach(f => {
        const p = f.properties;
        alertCache[p.id] = p;
        ids.add(p.id);
        const sk = sevKey(p.severity);
        if (hasBaseline && !prevAlertIds.has(p.id)) newSevs.add(sk);
        if (!worst || ({ extreme: 0, severe: 1, moderate: 2, minor: 3 }[sk] ?? 4) < ({ extreme: 0, severe: 1, moderate: 2, minor: 3 }[worst] ?? 4)) worst = sk;
        const col = sk === "extreme" || sk === "severe" ? "var(--err)" : "var(--warn)";
        const sender = (p.senderName || p.sender || "").replace("NWS ", "");
        html += `<div class="alert-card ${sevClass(p.severity)}" onclick="openAlert('${p.id}')">
          <div class="alert-ev" style="color:${col}">${p.event}</div>
          <div class="alert-meta">${p.severity || "—"} · ${sender ? sender + " · " : ""}${(p.areaDesc || "").substring(0, 60)}${(p.areaDesc || "").length > 60 ? "…" : ""}</div>
        </div>`;
      });
    }
    if (hasBaseline && newSevs.size && audioOn) playSevs(newSevs);
    if (!hasBaseline) hasBaseline = true;
    prevAlertIds = ids;

    $("panel-alerts").innerHTML = html;
    const totalAlerts = feats.length + (typeof wapiAlerts !== "undefined" ? wapiAlerts.length : 0);
    $("alert-tag").textContent = totalAlerts ? totalAlerts + " ACTIVE · MULTI" : (spcNote ? "SPC" : "CLEAR");
    const chip = $("chip-alerts");
    chip.textContent = "ALERTS " + totalAlerts;
    chip.classList.toggle("alert", totalAlerts > 0);

    const wrap = $("panel-alerts-wrap");
    if (wrap) {
      wrap.className = "panel grow" + (worst ? " " + sevClass(worst) : "");
    }
    setFeed("nws", true);
  } catch (e) {
    setFeed("nws", false);
    $("panel-alerts").innerHTML = `<span class="err">Alert feed down</span>`;
  }
}

window.openSPC = function () {
  const d = window.__spcDetail || { labels: [], counts: {}, featureCount: 0 };
  const note = window.__spcNote || "SPC Day-1 Convective Outlook";
  let rows = "";
  if (d.labels && d.labels.length) {
    d.labels.forEach(lab => {
      rows += `<div class="meta-row" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)">
        <span style="color:var(--text-dim)">${lab}</span>
        <span style="color:var(--cyan);font-family:var(--font-mono)">${d.counts[lab] || 0} region(s)</span>
      </div>`;
    });
  } else {
    rows = `<div class="empty" style="margin:8px 0">No categorical risk polygons in the current Day-1 outlook geometry.</div>`;
  }
  const body = `
    <div style="color:var(--warn);font-weight:700;margin-bottom:8px">${note}</div>
    <div style="font-size:12px;color:var(--text-dim);margin-bottom:12px">Storm Prediction Center · Day-1 categorical convective outlook</div>
    ${rows}
    <div style="margin:14px 0 8px;font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px">Outlook graphic</div>
    <div style="background:var(--raise);border:1px solid var(--line);border-radius:2px;padding:8px;text-align:center">
      <img src="https://www.spc.noaa.gov/products/outlook/day1otlk_sm.gif" alt="SPC Day-1 Outlook"
        style="max-width:100%;height:auto;border-radius:2px"
        onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
      <div style="display:none;color:var(--text-dim);font-size:12px">Graphic unavailable</div>
    </div>
    <div style="margin-top:14px;font-size:12px;color:var(--text-dim)">Full discussion and probabilistic maps remain on the SPC site if you need deeper product text.</div>
    <button class="btn-link" style="margin-top:10px;text-align:center;padding:8px"
      onclick="window.open('https://www.spc.noaa.gov/products/outlook/day1otlk.html','_blank')">Open full SPC product page ↗</button>`;
  openModal("SPC Day-1 Convective Outlook", body, "moderate");
};

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

/* ── AQI (Open-Meteo Air Quality — AirNow API retired 2026-10-01) ── */
function aqiCategory(usAqi) {
  if (usAqi == null || usAqi < 0) return { n: 0, name: "—", color: "#8ea1b3" };
  if (usAqi <= 50) return { n: 1, name: "Good", color: "#00e400" };
  if (usAqi <= 100) return { n: 2, name: "Moderate", color: "#ffff00" };
  if (usAqi <= 150) return { n: 3, name: "Unhealthy SG", color: "#ff7e00" };
  if (usAqi <= 200) return { n: 4, name: "Unhealthy", color: "#ff0000" };
  if (usAqi <= 300) return { n: 5, name: "Very Unhealthy", color: "#8f3f97" };
  return { n: 6, name: "Hazardous", color: "#7e0023" };
}

async function fetchAQI() {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}` +
      `&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi` +
      `&hourly=pm10,pm2_5,us_aqi&timezone=America%2FNew_York&forecast_days=2`;
    const data = await fetch(url).then(r => r.json());
    setFeed("aqi", true);
    const c = data.current || {};
    aqiCache = { current: c, hourly: data.hourly || null };
    const cat = aqiCategory(c.us_aqi);
    const rows = [
      { lab: "US AQI", val: c.us_aqi != null ? String(c.us_aqi) : "—", sub: cat.name, color: cat.color },
      { lab: "PM2.5", val: c.pm2_5 != null ? c.pm2_5.toFixed(1) : "—", sub: "μg/m³", color: cat.color },
      { lab: "PM10", val: c.pm10 != null ? c.pm10.toFixed(1) : "—", sub: "μg/m³", color: "var(--cyan)" },
      { lab: "Ozone", val: c.ozone != null ? String(Math.round(c.ozone)) : "—", sub: "μg/m³", color: "var(--cyan)" },
      { lab: "NO₂", val: c.nitrogen_dioxide != null ? c.nitrogen_dioxide.toFixed(1) : "—", sub: "μg/m³", color: "var(--cyan)" },
      { lab: "SO₂", val: c.sulphur_dioxide != null ? c.sulphur_dioxide.toFixed(1) : "—", sub: "μg/m³", color: "var(--cyan)" }
    ];
    let html = `<div class="aqi-duo">`;
    rows.forEach((x) => {
      html += `<div class="row-item" onclick="openAQI()">
        <div><div class="nm">${x.lab}</div><div class="sub">${x.sub}</div></div>
        <div class="rv" style="color:${x.color}">${x.val}</div>
      </div>`;
    });
    html += `</div>`;
    $("panel-aqi").innerHTML = html;
  } catch (e) {
    setFeed("aqi", false);
    $("panel-aqi").innerHTML = `<span class="err">Air quality timeout</span>`;
    console.error(e);
  }
}
window.openAQI = function () {
  const c = aqiCache.current;
  if (!c) return;
  const cat = aqiCategory(c.us_aqi);
  openModal(`Air Quality · US AQI ${c.us_aqi ?? "—"}`, `
    <div style="margin-bottom:12px;font-size:15px;font-weight:700;color:${cat.color}">${cat.name}</div>
    <div class="g2">
      <div class="metric"><div class="lab">US AQI</div><div class="val">${c.us_aqi ?? "—"}</div></div>
      <div class="metric"><div class="lab">European AQI</div><div class="val">${c.european_aqi ?? "—"}</div></div>
      <div class="metric"><div class="lab">PM2.5</div><div class="val">${c.pm2_5 != null ? c.pm2_5 + " μg/m³" : "—"}</div></div>
      <div class="metric"><div class="lab">PM10</div><div class="val">${c.pm10 != null ? c.pm10 + " μg/m³" : "—"}</div></div>
      <div class="metric"><div class="lab">Ozone</div><div class="val">${c.ozone != null ? c.ozone + " μg/m³" : "—"}</div></div>
      <div class="metric"><div class="lab">NO₂</div><div class="val">${c.nitrogen_dioxide != null ? c.nitrogen_dioxide + " μg/m³" : "—"}</div></div>
      <div class="metric"><div class="lab">SO₂</div><div class="val">${c.sulphur_dioxide != null ? c.sulphur_dioxide + " μg/m³" : "—"}</div></div>
      <div class="metric"><div class="lab">CO</div><div class="val">${c.carbon_monoxide != null ? c.carbon_monoxide + " μg/m³" : "—"}</div></div>
    </div>
    <div style="margin-top:12px;color:var(--text-dim);font-size:12px">Observed ${c.time || "—"} · Source: Open-Meteo Air Quality API<br>
    EPA AirNow observation web services were retired 1 Oct 2026.</div>`);
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
    let html = `<div class="g2" style="margin-bottom:6px">
      <div class="metric"><div class="lab">MLLW</div><div class="val">${last ? last.v + " ft" : "—"}</div></div>
      <div class="metric"><div class="lab">Air</div><div class="val">${la ? la.v + "°F" : "—"}</div></div>
    </div>
    <div style="height:110px;position:relative;flex-shrink:0"><canvas id="tide-chart"></canvas></div>
    <div style="font-size:10px;color:var(--text-dim);font-family:var(--font-mono);margin-top:4px">Station 8545240 · click chart legend · NOAA</div>`;
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

/* ── KPHL Airport conditions (graphical) + AFD on demand ── */
let kphlObs = null;

async function fetchKPHL() {
  try {
    const obs = await fetch("https://api.weather.gov/stations/KPHL/observations/latest").then(r => r.json());
    kphlObs = obs.properties || {};
    const p = kphlObs;
    const tC = p.temperature && p.temperature.value;
    const tF = tC != null ? Math.round(tC * 9 / 5 + 32) : "—";
    const dC = p.dewpoint && p.dewpoint.value;
    const dF = dC != null ? Math.round(dC * 9 / 5 + 32) : "—";
    const wind = p.windSpeed && p.windSpeed.value != null ? Math.round(p.windSpeed.value * 2.237) : "—";
    const gust = p.windGust && p.windGust.value != null ? Math.round(p.windGust.value * 2.237) : null;
    const dir = p.windDirection && p.windDirection.value != null ? p.windDirection.value : "—";
    const rh = p.relativeHumidity && p.relativeHumidity.value != null ? Math.round(p.relativeHumidity.value) : "—";
    const vis = p.visibility && p.visibility.value != null ? (p.visibility.value / 1609.34).toFixed(1) : "—";
    const press = p.barometricPressure && p.barometricPressure.value != null ? (p.barometricPressure.value / 100).toFixed(0) : "—";
    const desc = p.textDescription || "—";
    const icon = p.icon || "";

    $("panel-kphl").innerHTML = `
      <div class="kphl-card" onclick="openKPHL()" title="Open full KPHL detail + AFD">
        <div class="kphl-top">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            ${icon ? `<img src="${icon}" alt="" style="width:36px;height:36px;flex-shrink:0">` : ""}
            <div style="min-width:0">
              <div class="nm" style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">KPHL · Philadelphia Intl</div>
              <div class="sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${desc}</div>
            </div>
          </div>
          <div class="kphl-temp">${tF}°</div>
        </div>
        <div class="kphl-grid">
          <div class="metric"><div class="lab">Dew</div><div class="val">${dF}°</div></div>
          <div class="metric"><div class="lab">RH</div><div class="val">${rh}%</div></div>
          <div class="metric"><div class="lab">Wind</div><div class="val">${wind}${gust != null ? "G" + gust : ""}</div></div>
          <div class="metric"><div class="lab">Dir</div><div class="val">${dir}°</div></div>
          <div class="metric"><div class="lab">Vis</div><div class="val">${vis} mi</div></div>
          <div class="metric"><div class="lab">Pres</div><div class="val">${press}</div></div>
        </div>
      </div>`;
  } catch (e) {
    $("panel-kphl").innerHTML = `<span class="err">KPHL unavailable</span>`;
    console.error(e);
  }
  // Prefetch AFD text for modal
  fetchAFDSilent();
}

async function fetchAFDSilent() {
  try {
    const list = await fetch("https://api.weather.gov/products/types/AFD/locations/PHI").then(r => r.json());
    const g = list["@graph"] || [];
    if (!g.length) return;
    const prod = await fetch(g[0]["@id"] || `https://api.weather.gov/products/${g[0].id}`).then(r => r.json());
    afdFull = prod.productText || "";
  } catch (e) { /* silent */ }
}

window.openKPHL = function () {
  const p = kphlObs || {};
  const tF = p.temperature && p.temperature.value != null ? ((p.temperature.value * 9 / 5) + 32).toFixed(1) : "—";
  const dF = p.dewpoint && p.dewpoint.value != null ? ((p.dewpoint.value * 9 / 5) + 32).toFixed(1) : "—";
  const wind = p.windSpeed && p.windSpeed.value != null ? (p.windSpeed.value * 2.237).toFixed(1) : "—";
  const gust = p.windGust && p.windGust.value != null ? (p.windGust.value * 2.237).toFixed(1) : "—";
  const vis = p.visibility && p.visibility.value != null ? (p.visibility.value / 1609.34).toFixed(1) : "—";
  const press = p.barometricPressure && p.barometricPressure.value != null ? (p.barometricPressure.value / 100).toFixed(1) : "—";
  const heat = p.heatIndex && p.heatIndex.value != null ? ((p.heatIndex.value * 9 / 5) + 32).toFixed(1) + "°F" : "—";
  const chill = p.windChill && p.windChill.value != null ? ((p.windChill.value * 9 / 5) + 32).toFixed(1) + "°F" : "—";

  let body = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      ${p.icon ? `<img src="${p.icon}" style="width:56px">` : ""}
      <div>
        <div style="font-size:28px;font-weight:700;font-family:var(--font-display)">${tF}°F</div>
        <div style="color:var(--text-mid)">${p.textDescription || "—"}</div>
      </div>
    </div>
    <div class="g2" style="margin-bottom:14px">
      <div class="metric"><div class="lab">Dewpoint</div><div class="val">${dF}°F</div></div>
      <div class="metric"><div class="lab">Humidity</div><div class="val">${p.relativeHumidity && p.relativeHumidity.value != null ? Math.round(p.relativeHumidity.value) + "%" : "—"}</div></div>
      <div class="metric"><div class="lab">Wind</div><div class="val">${wind} mph @ ${p.windDirection && p.windDirection.value != null ? p.windDirection.value + "°" : "—"}</div></div>
      <div class="metric"><div class="lab">Gust</div><div class="val">${gust} mph</div></div>
      <div class="metric"><div class="lab">Visibility</div><div class="val">${vis} mi</div></div>
      <div class="metric"><div class="lab">Pressure</div><div class="val">${press} hPa</div></div>
      <div class="metric"><div class="lab">Heat Index</div><div class="val">${heat}</div></div>
      <div class="metric"><div class="lab">Wind Chill</div><div class="val">${chill}</div></div>
    </div>
    ${p.rawMessage ? `<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">METAR</div><pre style="background:var(--raise);padding:10px;border:1px solid var(--line);font-size:11px;overflow:auto;font-family:var(--font-mono)">${String(p.rawMessage).replace(/</g,"&lt;")}</pre>` : ""}
    <div style="margin-top:14px">
      <button class="btn-link" onclick="openAFD()" style="width:100%;text-align:center;padding:8px">Open PHI Area Forecast Discussion</button>
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--text-dim)">${p.timestamp ? new Date(p.timestamp).toLocaleString() : ""} · NWS station KPHL</div>`;
  openModal("KPHL · Philadelphia International", body);
};

window.openAFD = function () {
  if (!afdFull) {
    openModal("PHI AFD", `<span class="err">Discussion not loaded yet — wait for next cycle or retry.</span>`);
    return;
  }
  openModal("PHI Area Forecast Discussion", `<pre style="white-space:pre-wrap;font-size:12px;font-family:var(--font-mono)">${afdFull.replace(/</g, "&lt;")}</pre>`);
};

/* ── Cycle ── */
async function refreshAll() {
  await Promise.all([
    fetchOpenMeteo(),
    fetchNWSForecast(),
    fetchAlerts(),
    fetchObs(),
    fetchAQI(),
    fetchTides(),
    fetchKPHL()
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
