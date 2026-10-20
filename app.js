/**
 * WEATHERXPLR — SE-PA Mission Display (NWSXPLR-style)
 * Boot screen · arc gauges · dense quad layout · modal details
 */
const LAT = 40.0759, LON = -75.2996, ZIP = "19428";
const OWM_KEY = "591facdee3ec07d8e79519288c97d2a1";
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

const WMO = {
  0:"Clear",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Rime fog",
  51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",
  71:"Light snow",73:"Snow",75:"Heavy snow",80:"Rain showers",81:"Rain showers",82:"Heavy showers",
  95:"Thunderstorm",96:"T-storm hail",99:"T-storm heavy hail"
};

let cd = CYCLE, audioOn = false, audioCtx = null;
let alertCache = {}, obsCache = {}, aqiCache = {}, kphlObs = null, afdFull = "";
let prevAlertIds = new Set(), hasBaseline = false;
let nwsPeriods = null, omData = null, tideChart = null;
const feed = { nws: true, om: true, aqi: true, hydro: true, tides: true };

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function sevClass(s) {
  s = (s || "").toLowerCase();
  if (["extreme","severe","moderate","minor"].includes(s)) return "sev-" + s;
  return "sev-unknown";
}
function sevKey(s) {
  s = (s || "").toLowerCase();
  return ["extreme","severe","moderate","minor"].includes(s) ? s : "unknown";
}
function setFeed(id, ok) {
  const el = $("d-" + id);
  if (el) el.classList.toggle("off", !ok);
  feed[id] = ok;
}

/* ── Gauges (NWSXPLR) ── */
function arcGaugeSvg(value, min, max, color, label, unit, displayVal) {
  const pct = value == null || isNaN(value) ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const start = -135, sweep = 270, r = 42, cx = 50, cy = 50;
  const toRad = d => (d * Math.PI) / 180;
  const angle = start + sweep * pct;
  const x1 = cx + r * Math.cos(toRad(start)), y1 = cy + r * Math.sin(toRad(start));
  const x2 = cx + r * Math.cos(toRad(start + sweep)), y2 = cy + r * Math.sin(toRad(start + sweep));
  const nx = cx + r * Math.cos(toRad(angle)), ny = cy + r * Math.sin(toRad(angle));
  const large = sweep * pct > 180 ? 1 : 0;
  const track = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`;
  const fill = value == null ? "" : `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${nx} ${ny}`;
  const shown = displayVal != null ? displayVal : (value == null ? "—" : Math.round(value));
  return `<div class="g-title">${esc(label)}</div>
    <svg class="gauge-svg" viewBox="0 0 100 78" aria-hidden="true">
      <path d="${track}" fill="none" stroke="rgba(148,163,184,0.2)" stroke-width="8" stroke-linecap="round"/>
      ${fill ? `<path d="${fill}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>` : ""}
      <text x="50" y="52" text-anchor="middle" fill="#f8fafc" font-size="15" font-family="IBM Plex Mono,monospace" font-weight="600">${esc(String(shown))}</text>
      <text x="50" y="66" text-anchor="middle" fill="#64748b" font-size="8" font-family="IBM Plex Mono,monospace">${esc(unit)}</text>
    </svg>`;
}
function compassSvg(deg, speedMph) {
  const d = deg == null || isNaN(deg) ? 0 : deg;
  const spd = speedMph == null ? "—" : Math.round(speedMph);
  return `<div class="g-title">Wind</div>
    <svg class="compass-rose" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(148,163,184,0.25)" stroke-width="2"/>
      <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(148,163,184,0.12)" stroke-width="1"/>
      <text x="50" y="14" text-anchor="middle" fill="#94a3b8" font-size="8" font-family="IBM Plex Mono,monospace">N</text>
      <text x="50" y="96" text-anchor="middle" fill="#94a3b8" font-size="8" font-family="IBM Plex Mono,monospace">S</text>
      <text x="8" y="53" text-anchor="middle" fill="#94a3b8" font-size="8" font-family="IBM Plex Mono,monospace">W</text>
      <text x="92" y="53" text-anchor="middle" fill="#94a3b8" font-size="8" font-family="IBM Plex Mono,monospace">E</text>
      <g class="needle" style="transform:rotate(${d}deg)">
        <polygon points="50,18 54,50 50,46 46,50" fill="#06b6d4"/>
        <polygon points="50,82 54,50 50,54 46,50" fill="#64748b"/>
      </g>
      <circle cx="50" cy="50" r="4" fill="#f8fafc"/>
      <text x="50" y="58" text-anchor="middle" fill="#06b6d4" font-size="9" font-family="IBM Plex Mono,monospace" font-weight="600">${spd}</text>
    </svg>`;
}

/* ── Modal ── */
function openModal(title, html, sev) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = html;
  $("modal").className = "modal" + (sev ? " " + sevClass(sev) : "");
  $("modal-bg").classList.add("open");
}
function closeModal() {
  $("modal-bg").classList.remove("open");
  $("modal-body").innerHTML = "";
}
window.closeModal = closeModal;

/* ── Audio ── */
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
  [880, 660, 880, 660, 880, 660].forEach((f, i) => tone(f, n + i * 0.14, 0.13, "sawtooth", 0.2));
}
function playSevere() {
  const n = ctx().currentTime;
  tone(523.25, n, 0.3, "sine", 0.18); tone(784, n + 0.28, 0.38, "sine", 0.18);
}
function playAdvisory() {
  const n = ctx().currentTime;
  tone(440, n, 0.1, "triangle", 0.16); tone(440, n + 0.16, 0.1, "triangle", 0.16);
}
const TONES = { extreme: playExtreme, severe: playSevere, moderate: playSevere, minor: playAdvisory, unknown: playAdvisory };
function playSevs(set) {
  let d = 0;
  ["extreme","severe","moderate","minor","unknown"].forEach(s => {
    if (!set.has(s)) return;
    setTimeout(() => TONES[s](), d); d += 900;
  });
}
function initAudio() {
  try { audioOn = localStorage.getItem("wx_tones") === "1"; } catch (e) {}
  syncAudioUI();
  $("btn-audio").addEventListener("click", () => {
    audioOn = !audioOn;
    try { localStorage.setItem("wx_tones", audioOn ? "1" : "0"); } catch (e) {}
    if (audioOn) { ctx(); playAdvisory(); }
    syncAudioUI();
  });
}
function syncAudioUI() {
  $("btn-audio").classList.toggle("audio-on", audioOn);
  $("audio-ico").className = audioOn ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark";
  $("audio-lbl").textContent = audioOn ? "ON" : "OFF";
}

/* ── Radar ── */
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
  $("clock").textContent = now.toLocaleTimeString("en-US", { hour12: false }) + " L · " + now.toISOString().substr(11, 8) + "Z";
}

/* ── Open-Meteo ── */
async function fetchOpenMeteo() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York&forecast_days=7`;
  try {
    omData = await fetch(url).then(r => r.json());
    setFeed("om", true);
    renderConditions();
    renderForecast();
  } catch (e) {
    setFeed("om", false);
  }
}

function renderConditions() {
  const c = omData && omData.current;
  if (!c) {
    $("panel-conditions").innerHTML = `<span class="err">Unavailable</span>`;
    return;
  }
  const desc = WMO[c.weather_code] || "—";
  const t = c.temperature_2m, rh = c.relative_humidity_2m, w = c.wind_speed_10m, p = c.pressure_msl;
  $("panel-conditions").innerHTML = `
    <div class="gauge-row">
      <div class="gauge-card" onclick="openConditionsDetail()">${arcGaugeSvg(t, -10, 110, "#f59e0b", "Temp", "°F", t == null ? "—" : Math.round(t))}</div>
      <div class="gauge-card" onclick="openConditionsDetail()">${arcGaugeSvg(rh, 0, 100, "#06b6d4", "Humidity", "%", rh == null ? "—" : Math.round(rh))}</div>
      <div class="gauge-card" onclick="openConditionsDetail()">${compassSvg(c.wind_direction_10m, w)}</div>
      <div class="gauge-card" onclick="openConditionsDetail()">${arcGaugeSvg(p, 980, 1040, "#22c55e", "Pressure", "hPa", p == null ? "—" : Math.round(p))}</div>
    </div>
    <div class="obs-mini-grid" style="margin-top:5px">
      <div class="obs-mini" onclick="openConditionsDetail()"><div class="om-label">Feels</div><div class="om-val">${Math.round(c.apparent_temperature)}°</div></div>
      <div class="obs-mini" onclick="openConditionsDetail()"><div class="om-label">Gusts</div><div class="om-val">${Math.round(c.wind_gusts_10m || 0)} mph</div></div>
      <div class="obs-mini" onclick="openConditionsDetail()"><div class="om-label">Clouds</div><div class="om-val">${c.cloud_cover}%</div></div>
      <div class="obs-mini" onclick="openConditionsDetail()"><div class="om-label">${esc(desc)}</div><div class="om-val" style="font-size:10px;color:var(--text-mid)">Precip ${(c.precipitation||0).toFixed(2)}"</div></div>
    </div>`;
}
window.openConditionsDetail = function () {
  const c = omData && omData.current;
  if (!c) return;
  openModal("Current Conditions", `
    <div class="gauge-row" style="margin-bottom:12px">
      <div class="gauge-card">${arcGaugeSvg(c.temperature_2m,-10,110,"#f59e0b","Temp","°F",Math.round(c.temperature_2m))}</div>
      <div class="gauge-card">${arcGaugeSvg(c.relative_humidity_2m,0,100,"#06b6d4","RH","%",Math.round(c.relative_humidity_2m))}</div>
      <div class="gauge-card">${compassSvg(c.wind_direction_10m,c.wind_speed_10m)}</div>
      <div class="gauge-card">${arcGaugeSvg(c.pressure_msl,980,1040,"#22c55e","MSLP","hPa",Math.round(c.pressure_msl))}</div>
    </div>
    <div class="obs-mini-grid">
      <div class="obs-mini"><div class="om-label">Feels like</div><div class="om-val">${Math.round(c.apparent_temperature)}°F</div></div>
      <div class="obs-mini"><div class="om-label">Gusts</div><div class="om-val">${Math.round(c.wind_gusts_10m||0)} mph</div></div>
      <div class="obs-mini"><div class="om-label">Cloud cover</div><div class="om-val">${c.cloud_cover}%</div></div>
      <div class="obs-mini"><div class="om-label">Precip</div><div class="om-val">${(c.precipitation||0).toFixed(2)} in</div></div>
      <div class="obs-mini"><div class="om-label">Conditions</div><div class="om-val">${esc(WMO[c.weather_code]||"—")}</div></div>
      <div class="obs-mini"><div class="om-label">Observed</div><div class="om-val" style="font-size:11px">${esc(c.time||"—")}</div></div>
    </div>
    <div style="margin-top:10px;font-size:11px;color:var(--text-dim);font-family:var(--font-mono)">Open-Meteo · ${LAT}, ${LON}</div>`);
};

async function fetchNWSForecast() {
  try {
    const pts = await fetch(`https://api.weather.gov/points/${LAT},${LON}`).then(r => r.json());
    const fc = await fetch(pts.properties.forecast).then(r => r.json());
    nwsPeriods = fc.properties.periods;
    setFeed("nws", true);
    renderForecast();
  } catch (e) { setFeed("nws", false); }
}

function renderForecast() {
  let html = "";
  if (omData && omData.daily) {
    const d = omData.daily;
    html += `<div class="fc-row" style="margin-bottom:5px">`;
    for (let i = 0; i < Math.min(7, (d.time || []).length); i++) {
      const day = new Date(d.time[i] + "T12:00:00");
      const label = i === 0 ? "Today" : day.toLocaleDateString("en-US", { weekday: "short" });
      html += `<div class="fc-day" onclick="openDayDetail(${i})">
        <div class="d">${label}</div>
        <div class="t"><span class="hi">${Math.round(d.temperature_2m_max[i])}°</span>/<span class="lo">${Math.round(d.temperature_2m_min[i])}°</span></div>
        <div style="font-size:8px;color:var(--blue)">${d.precipitation_probability_max[i] != null ? d.precipitation_probability_max[i] + "%" : ""}</div>
      </div>`;
    }
    html += `</div>`;
  }
  if (omData && omData.hourly) {
    const h = omData.hourly, now = Date.now();
    html += `<div class="hr-row">`;
    let shown = 0;
    for (let i = 0; i < h.time.length && shown < 12; i++) {
      const t = new Date(h.time[i]);
      if (t.getTime() < now - 3600000) continue;
      html += `<div class="hr-cell" onclick="openDayDetail(0)">
        <div class="h">${t.toLocaleTimeString("en-US",{hour:"numeric",hour12:true})}</div>
        <div class="t">${Math.round(h.temperature_2m[i])}°</div>
        <div class="p">${h.precipitation_probability[i] != null ? h.precipitation_probability[i]+"%" : ""}</div>
      </div>`;
      shown++;
    }
    html += `</div>`;
  }
  $("panel-forecast").innerHTML = html || `<span class="err">No forecast</span>`;
}
window.openDayDetail = function (i) {
  if (!omData || !omData.daily) return;
  const d = omData.daily;
  openModal(`Forecast · ${d.time[i]}`, `
    <div class="obs-mini-grid">
      <div class="obs-mini"><div class="om-label">High</div><div class="om-val">${Math.round(d.temperature_2m_max[i])}°F</div></div>
      <div class="obs-mini"><div class="om-label">Low</div><div class="om-val">${Math.round(d.temperature_2m_min[i])}°F</div></div>
      <div class="obs-mini"><div class="om-label">Precip</div><div class="om-val">${(d.precipitation_sum[i]||0).toFixed(2)} in</div></div>
      <div class="obs-mini"><div class="om-label">PoP max</div><div class="om-val">${d.precipitation_probability_max[i]??"—"}%</div></div>
      <div class="obs-mini"><div class="om-label">Wind max</div><div class="om-val">${Math.round(d.wind_speed_10m_max[i])} mph</div></div>
      <div class="obs-mini"><div class="om-label">Sky</div><div class="om-val">${esc(WMO[d.weather_code[i]]||"—")}</div></div>
    </div>`);
};

/* ── Alerts ── */
async function fetchAlerts() {
  try {
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

    let spcNote = null, spcDetail = null;
    try {
      const spc = await fetch("https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson").then(r => r.json());
      const labels = (spc.features || []).map(f => (f.properties && (f.properties.LABEL || f.properties.label)) || "").filter(Boolean);
      const uniq = [...new Set(labels)];
      const counts = {};
      labels.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
      spcNote = uniq.length ? "SPC Day-1: " + uniq.join(", ") : "SPC Day-1: no categorical risk";
      spcDetail = { labels: uniq, counts, featureCount: (spc.features || []).length };
      window.__spcDetail = spcDetail;
      window.__spcNote = spcNote;
    } catch (e) {}

    // OWM optional
    try {
      const cur = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&units=imperial&appid=${OWM_KEY}`).then(r => r.json());
      if (cur && cur.cod === 200) window.__owmCurrent = cur;
    } catch (e) {}

    feats.sort((a, b) => {
      const o = { extreme: 0, severe: 1, moderate: 2, minor: 3 };
      return (o[(a.properties.severity || "").toLowerCase()] ?? 4) - (o[(b.properties.severity || "").toLowerCase()] ?? 4);
    });

    alertCache = {};
    const ids = new Set();
    const newSevs = new Set();
    let html = "";
    let worst = null;

    if (spcNote) {
      html += `<div class="row-item" style="border-left:3px solid var(--amber);margin-bottom:4px" onclick="openSPC()">
        <div><div class="nm" style="color:var(--amber)">SPC Convective Outlook</div><div class="sub">${esc(spcNote)}</div></div>
        <div class="rv" style="font-size:10px;color:var(--amber)">VIEW</div>
      </div>`;
    }

    if (!feats.length) {
      html += `<div class="empty"><i class="fa-solid fa-check"></i> Clear — no active NWS alerts (PA/NJ/DE)</div>`;
    } else {
      feats.forEach(f => {
        const p = f.properties;
        alertCache[p.id] = p;
        ids.add(p.id);
        const sk = sevKey(p.severity);
        if (hasBaseline && !prevAlertIds.has(p.id)) newSevs.add(sk);
        if (!worst || ({ extreme: 0, severe: 1, moderate: 2, minor: 3 }[sk] ?? 4) < ({ extreme: 0, severe: 1, moderate: 2, minor: 3 }[worst] ?? 4)) worst = sk;
        const col = sk === "extreme" || sk === "severe" ? "var(--red)" : "var(--amber)";
        const sender = (p.senderName || "").replace("NWS ", "");
        html += `<div class="alert-card ${sevClass(p.severity)}" onclick="openAlert('${p.id}')">
          <div class="alert-ev" style="color:${col}">${esc(p.event)}</div>
          <div class="alert-meta">${esc(p.severity || "—")} · ${esc(sender)} · ${esc((p.areaDesc || "").substring(0, 55))}${(p.areaDesc || "").length > 55 ? "…" : ""}</div>
        </div>`;
      });
    }

    if (hasBaseline && newSevs.size && audioOn) playSevs(newSevs);
    if (!hasBaseline) hasBaseline = true;
    prevAlertIds = ids;

    $("panel-alerts").innerHTML = html;
    $("alert-tag").textContent = feats.length ? feats.length + " ACTIVE" : (spcNote ? "SPC" : "CLEAR");
    const chip = $("chip-alerts");
    chip.textContent = "ALERTS " + feats.length;
    chip.classList.toggle("alert", feats.length > 0);
    const wrap = $("panel-alerts-wrap");
    if (wrap) wrap.className = "panel grow" + (worst ? " " + sevClass(worst) : "");
    setFeed("nws", true);
  } catch (e) {
    setFeed("nws", false);
    $("panel-alerts").innerHTML = `<span class="err">Alert feed down</span>`;
  }
}

window.openSPC = function () {
  const d = window.__spcDetail || { labels: [], counts: {} };
  const note = window.__spcNote || "SPC Day-1";
  let rows = "";
  if (d.labels && d.labels.length) {
    d.labels.forEach(lab => {
      rows += `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line)">
        <span style="color:var(--text-dim)">${esc(lab)}</span>
        <span style="color:var(--cyan);font-family:var(--font-mono)">${d.counts[lab] || 0} region(s)</span>
      </div>`;
    });
  } else rows = `<div class="empty">No categorical risk polygons.</div>`;

  const cycles = ["0100","2000","1630","1300","1200"];
  const utcH = new Date().getUTCHours() * 100 + new Date().getUTCMinutes();
  const ranked = [{c:"0100",t:100},{c:"2000",t:2000},{c:"1630",t:1630},{c:"1300",t:1300},{c:"1200",t:1200}];
  const past = ranked.filter(x => x.t <= utcH).sort((a,b) => b.t - a.t);
  const future = ranked.filter(x => x.t > utcH).sort((a,b) => b.t - a.t);
  const order = [...past, ...future].map(x => x.c);
  const urls = order.map(c => `https://www.spc.noaa.gov/products/outlook/day1otlk_${c}.png`);
  window.__spcImgUrls = urls;

  openModal("SPC Day-1 Convective Outlook", `
    <div style="color:var(--amber);font-weight:700;margin-bottom:6px">${esc(note)}</div>
    ${rows}
    <div style="margin:12px 0 6px;font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.08em">Outlook graphic</div>
    <div style="background:var(--raise);border:1px solid var(--line);border-radius:4px;padding:6px;text-align:center">
      <img id="spc-outlook-img" alt="SPC" style="max-width:100%;height:auto;border-radius:2px;display:block;margin:0 auto"
        src="${urls[0]}" data-idx="0" onerror="window.__spcImgFallback&&window.__spcImgFallback(this)">
      <div id="spc-img-fail" style="display:none;color:var(--text-dim);font-size:12px;padding:10px">Graphic unavailable</div>
    </div>
    <div style="margin-top:6px;font-size:10px;color:var(--text-dim);font-family:var(--font-mono)" id="spc-cycle-lbl">Loading…</div>
    <button class="btn-link" style="margin-top:10px;width:100%;text-align:center;padding:7px"
      onclick="window.open('https://www.spc.noaa.gov/products/outlook/day1otlk.html','_blank')">Full SPC product page ↗</button>`, "moderate");
  setTimeout(() => {
    const img = $("spc-outlook-img"), lbl = $("spc-cycle-lbl");
    if (img && lbl && img.complete && img.naturalWidth) {
      const m = (img.src || "").match(/day1otlk_(\d+)\.png/);
      if (m) lbl.textContent = "Cycle " + m[1] + " UTC · SPC";
    }
  }, 500);
};
window.__spcImgFallback = function (img) {
  const urls = window.__spcImgUrls || [];
  let idx = parseInt(img.getAttribute("data-idx") || "0", 10) + 1;
  if (idx < urls.length) {
    img.setAttribute("data-idx", String(idx));
    img.src = urls[idx];
  } else {
    img.style.display = "none";
    const fail = $("spc-img-fail");
    if (fail) fail.style.display = "block";
  }
};

window.openAlert = function (id) {
  const a = alertCache[id];
  if (!a) return;
  let body = `<div style="color:var(--red);font-weight:700;margin-bottom:6px">${esc(a.headline || a.event)}</div>`;
  body += `<div style="color:var(--text-dim);font-size:11px;margin-bottom:8px">${esc(a.severity||"—")} · ${esc(a.urgency||"—")} · ${esc(a.certainty||"—")}</div>`;
  body += `<div style="margin-bottom:8px"><b>Area:</b> ${esc(a.areaDesc||"")}</div>`;
  body += `<div style="background:var(--raise);padding:10px;border:1px solid var(--line);white-space:pre-wrap;font-size:12px;font-family:var(--font-mono)">${esc(a.description||"")}</div>`;
  if (a.instruction) body += `<div style="margin-top:10px;color:var(--amber);font-weight:600;font-size:11px">ACTIONS</div><div style="background:var(--raise);padding:10px;border:1px solid var(--line);white-space:pre-wrap;font-size:12px;color:var(--cyan);font-family:var(--font-mono)">${esc(a.instruction)}</div>`;
  openModal("NWS Alert", body, a.severity);
};

/* ── Obs ── */
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
      html += `<div class="row-item" onclick="openObs('${item.id}','${esc(item.name||"").replace(/'/g,"")}')">
        <div><div class="nm">${esc(item.id)}</div><div class="sub">${esc((item.name||"").substring(0,24))}</div></div>
        <div style="text-align:right"><div class="rv">${tF}°F</div><div class="sub">${esc(p.textDescription||"—")} · ${wind} mph</div></div>
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
    <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px">${esc(name||"")}</div>
    <div class="obs-mini-grid">
      <div class="obs-mini"><div class="om-label">Temp</div><div class="om-val">${tF}°F</div></div>
      <div class="obs-mini"><div class="om-label">Dewpoint</div><div class="om-val">${dF}°F</div></div>
      <div class="obs-mini"><div class="om-label">Wind</div><div class="om-val">${wind} mph</div></div>
      <div class="obs-mini"><div class="om-label">Humidity</div><div class="om-val">${p.relativeHumidity && p.relativeHumidity.value != null ? Math.round(p.relativeHumidity.value)+"%" : "—"}</div></div>
    </div>
    ${p.rawMessage ? `<pre style="margin-top:10px;background:var(--raise);padding:8px;font-size:11px;overflow:auto;font-family:var(--font-mono)">${esc(p.rawMessage)}</pre>` : ""}`);
};

/* ── AQI ── */
function aqiCategory(usAqi) {
  if (usAqi == null || usAqi < 0) return { name: "—", color: "#64748b" };
  if (usAqi <= 50) return { name: "Good", color: "#22c55e" };
  if (usAqi <= 100) return { name: "Moderate", color: "#eab308" };
  if (usAqi <= 150) return { name: "USG", color: "#f97316" };
  if (usAqi <= 200) return { name: "Unhealthy", color: "#ef4444" };
  if (usAqi <= 300) return { name: "Very Unhealthy", color: "#a855f7" };
  return { name: "Hazardous", color: "#7e0023" };
}
async function fetchAQI() {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}` +
      `&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi&timezone=America%2FNew_York`;
    const data = await fetch(url).then(r => r.json());
    setFeed("aqi", true);
    const c = data.current || {};
    aqiCache = { current: c };
    const cat = aqiCategory(c.us_aqi);
    const rows = [
      { lab: "US AQI", val: c.us_aqi != null ? String(c.us_aqi) : "—", sub: cat.name, color: cat.color },
      { lab: "PM2.5", val: c.pm2_5 != null ? c.pm2_5.toFixed(1) : "—", sub: "μg/m³", color: cat.color },
      { lab: "PM10", val: c.pm10 != null ? c.pm10.toFixed(1) : "—", sub: "μg/m³", color: "var(--cyan)" },
      { lab: "O₃", val: c.ozone != null ? String(Math.round(c.ozone)) : "—", sub: "μg/m³", color: "var(--cyan)" },
      { lab: "NO₂", val: c.nitrogen_dioxide != null ? c.nitrogen_dioxide.toFixed(1) : "—", sub: "μg/m³", color: "var(--cyan)" },
      { lab: "SO₂", val: c.sulphur_dioxide != null ? c.sulphur_dioxide.toFixed(1) : "—", sub: "μg/m³", color: "var(--cyan)" }
    ];
    let html = `<div class="aqi-duo">`;
    rows.forEach(x => {
      html += `<div class="row-item" onclick="openAQI()"><div><div class="nm">${x.lab}</div><div class="sub">${x.sub}</div></div><div class="rv" style="color:${x.color}">${x.val}</div></div>`;
    });
    html += `</div>`;
    $("panel-aqi").innerHTML = html;
  } catch (e) {
    setFeed("aqi", false);
    $("panel-aqi").innerHTML = `<span class="err">AQ timeout</span>`;
  }
}
window.openAQI = function () {
  const c = aqiCache.current;
  if (!c) return;
  const cat = aqiCategory(c.us_aqi);
  openModal(`Air Quality · US AQI ${c.us_aqi ?? "—"}`, `
    <div style="font-size:15px;font-weight:700;color:${cat.color};margin-bottom:10px">${cat.name}</div>
    <div class="obs-mini-grid">
      <div class="obs-mini"><div class="om-label">US AQI</div><div class="om-val">${c.us_aqi??"—"}</div></div>
      <div class="obs-mini"><div class="om-label">PM2.5</div><div class="om-val">${c.pm2_5??"—"}</div></div>
      <div class="obs-mini"><div class="om-label">PM10</div><div class="om-val">${c.pm10??"—"}</div></div>
      <div class="obs-mini"><div class="om-label">Ozone</div><div class="om-val">${c.ozone??"—"}</div></div>
      <div class="obs-mini"><div class="om-label">NO₂</div><div class="om-val">${c.nitrogen_dioxide??"—"}</div></div>
      <div class="obs-mini"><div class="om-label">SO₂</div><div class="om-val">${c.sulphur_dioxide??"—"}</div></div>
    </div>
    <div style="margin-top:10px;font-size:11px;color:var(--text-dim)">${esc(c.time||"—")} · Open-Meteo AQ</div>`);
};

/* ── Hydro / Tides / KPHL ── */
function fetchHydro() {
  setFeed("hydro", true);
  let html = "";
  GAUGES.forEach(g => {
    html += `<div class="row-item" onclick="openHydro('${g.id}','${g.name.replace(/'/g,"\\'")}')">
      <div><div class="nm">${esc(g.name)}</div><div class="sub">USGS ${g.id}</div></div>
      <div class="rv" style="font-size:10px">GRAPH</div>
    </div>`;
  });
  $("panel-hydro").innerHTML = html;
}
window.openHydro = function (id, name) {
  const url = `https://dashboard.waterdata.usgs.gov/api/gwis/2.1/service/site?agencyCode=USGS&siteNumber=${id}&open=plots&banner=false&pad=false`;
  openModal(`USGS · ${name}`, `<div style="height:400px"><iframe src="${url}" style="width:100%;height:100%;border:none;background:#fff;border-radius:3px"></iframe></div>`);
};

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
    $("panel-tides").innerHTML = `
      <div class="obs-mini-grid" style="margin-bottom:4px">
        <div class="obs-mini" onclick="openTides()"><div class="om-label">MLLW</div><div class="om-val">${last ? last.v + " ft" : "—"}</div></div>
        <div class="obs-mini" onclick="openTides()"><div class="om-label">Air</div><div class="om-val">${la ? la.v + "°F" : "—"}</div></div>
      </div>
      <div style="height:72px;position:relative;cursor:pointer" onclick="openTides()"><canvas id="tide-chart"></canvas></div>`;
    const labels = (wl.data || []).map(d => d.t.split(" ")[1].slice(0, 5));
    const obs = (wl.data || []).map(d => parseFloat(d.v));
    const pr = (pred.predictions || []).map(d => parseFloat(d.v)).slice(0, labels.length);
    window.__tideData = { labels, obs, pr, last, la };
    const canvas = $("tide-chart");
    if (canvas) {
      if (tideChart) tideChart.destroy();
      Chart.defaults.color = "#64748b";
      Chart.defaults.font.family = "IBM Plex Mono";
      Chart.defaults.font.size = 9;
      tideChart = new Chart(canvas, {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Obs", data: obs, borderColor: "#06b6d4", borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.3 },
            { label: "Pred", data: pr, borderColor: "#ef4444", borderDash: [3, 3], borderWidth: 1.2, pointRadius: 0, fill: false, tension: 0.3 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { maxTicksLimit: 5, font: { size: 8 } }, grid: { color: "#1c2838" } },
            y: { ticks: { font: { size: 8 } }, grid: { color: "#1c2838" } }
          }
        }
      });
    }
  } catch (e) {
    setFeed("tides", false);
    $("panel-tides").innerHTML = `<span class="err">NOAA timeout</span>`;
  }
}
window.openTides = function () {
  const t = window.__tideData || {};
  openModal("Tides · Station 8545240", `
    <div class="obs-mini-grid" style="margin-bottom:12px">
      <div class="obs-mini"><div class="om-label">MLLW</div><div class="om-val">${t.last ? t.last.v + " ft" : "—"}</div></div>
      <div class="obs-mini"><div class="om-label">Air</div><div class="om-val">${t.la ? t.la.v + "°F" : "—"}</div></div>
    </div>
    <div style="height:220px;position:relative"><canvas id="tide-chart-modal"></canvas></div>
    <div style="margin-top:8px;font-size:11px;color:var(--text-dim)">NOAA CO-OPS · Philadelphia / Delaware River</div>`);
  setTimeout(() => {
    const canvas = $("tide-chart-modal");
    if (!canvas || !t.labels) return;
    new Chart(canvas, {
      type: "line",
      data: {
        labels: t.labels,
        datasets: [
          { label: "Observed", data: t.obs, borderColor: "#06b6d4", borderWidth: 2, pointRadius: 0, fill: false, tension: 0.3 },
          { label: "Predicted", data: t.pr, borderColor: "#ef4444", borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, labels: { boxWidth: 10, font: { size: 11 } } } },
        scales: {
          x: { ticks: { maxTicksLimit: 8 }, grid: { color: "#1c2838" } },
          y: { grid: { color: "#1c2838" } }
        }
      }
    });
  }, 50);
};

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
    const dir = p.windDirection && p.windDirection.value != null ? p.windDirection.value : "—";
    const rh = p.relativeHumidity && p.relativeHumidity.value != null ? Math.round(p.relativeHumidity.value) : "—";
    const vis = p.visibility && p.visibility.value != null ? (p.visibility.value / 1609.34).toFixed(1) : "—";
    const press = p.barometricPressure && p.barometricPressure.value != null ? (p.barometricPressure.value / 100).toFixed(0) : "—";
    $("panel-kphl").innerHTML = `
      <div class="kphl-top" onclick="openKPHL()">
        <div style="min-width:0">
          <div class="nm" style="font-size:12px">KPHL · Philadelphia Intl</div>
          <div class="sub">${esc(p.textDescription||"—")}</div>
        </div>
        <div class="kphl-temp">${tF}°</div>
      </div>
      <div class="kphl-grid">
        <div class="obs-mini" onclick="openKPHL()"><div class="om-label">Dew</div><div class="om-val">${dF}°</div></div>
        <div class="obs-mini" onclick="openKPHL()"><div class="om-label">RH</div><div class="om-val">${rh}%</div></div>
        <div class="obs-mini" onclick="openKPHL()"><div class="om-label">Wind</div><div class="om-val">${wind}</div></div>
        <div class="obs-mini" onclick="openKPHL()"><div class="om-label">Dir</div><div class="om-val">${dir}°</div></div>
        <div class="obs-mini" onclick="openKPHL()"><div class="om-label">Vis</div><div class="om-val">${vis} mi</div></div>
        <div class="obs-mini" onclick="openKPHL()"><div class="om-label">Pres</div><div class="om-val">${press}</div></div>
      </div>`;
    fetchAFDSilent();
  } catch (e) {
    $("panel-kphl").innerHTML = `<span class="err">KPHL unavailable</span>`;
  }
}
async function fetchAFDSilent() {
  try {
    const list = await fetch("https://api.weather.gov/products/types/AFD/locations/PHI").then(r => r.json());
    const g = list["@graph"] || [];
    if (!g.length) return;
    const prod = await fetch(g[0]["@id"] || `https://api.weather.gov/products/${g[0].id}`).then(r => r.json());
    afdFull = prod.productText || "";
  } catch (e) {}
}
window.openKPHL = function () {
  const p = kphlObs || {};
  const tF = p.temperature && p.temperature.value != null ? ((p.temperature.value * 9 / 5) + 32).toFixed(1) : "—";
  openModal("KPHL · Philadelphia International", `
    <div style="font-size:28px;font-weight:700;font-family:var(--font-mono);margin-bottom:4px">${tF}°F</div>
    <div style="color:var(--text-mid);margin-bottom:10px">${esc(p.textDescription||"—")}</div>
    <div class="obs-mini-grid">
      <div class="obs-mini"><div class="om-label">Dewpoint</div><div class="om-val">${p.dewpoint && p.dewpoint.value != null ? ((p.dewpoint.value*9/5)+32).toFixed(1)+"°F" : "—"}</div></div>
      <div class="obs-mini"><div class="om-label">Humidity</div><div class="om-val">${p.relativeHumidity && p.relativeHumidity.value != null ? Math.round(p.relativeHumidity.value)+"%" : "—"}</div></div>
      <div class="obs-mini"><div class="om-label">Wind</div><div class="om-val">${p.windSpeed && p.windSpeed.value != null ? (p.windSpeed.value*2.237).toFixed(1)+" mph" : "—"}</div></div>
      <div class="obs-mini"><div class="om-label">Visibility</div><div class="om-val">${p.visibility && p.visibility.value != null ? (p.visibility.value/1609.34).toFixed(1)+" mi" : "—"}</div></div>
    </div>
    ${p.rawMessage ? `<pre style="margin-top:10px;background:var(--raise);padding:8px;font-size:11px;font-family:var(--font-mono);overflow:auto">${esc(p.rawMessage)}</pre>` : ""}
    <button class="btn-link" style="margin-top:10px;width:100%;text-align:center;padding:7px" onclick="openAFD()">PHI Area Forecast Discussion</button>
    <div style="margin-top:8px;font-size:11px;color:var(--text-dim)">${p.timestamp ? new Date(p.timestamp).toLocaleString() : ""} · NWS KPHL</div>`);
};
window.openAFD = function () {
  if (!afdFull) { openModal("PHI AFD", `<span class="err">Not loaded yet — wait for next cycle.</span>`); return; }
  openModal("PHI Area Forecast Discussion", `<pre style="white-space:pre-wrap;font-size:12px;font-family:var(--font-mono)">${esc(afdFull)}</pre>`);
};

/* ── Boot + cycle ── */
async function refreshAll() {
  await Promise.all([
    fetchOpenMeteo(), fetchNWSForecast(), fetchAlerts(), fetchObs(),
    fetchAQI(), fetchTides(), fetchKPHL()
  ]);
  fetchHydro();
  $("chip-sync").textContent = "SYNC " + new Date().toLocaleTimeString("en-US", { hour12: false });
}

async function boot() {
  const bar = $("boot-progress");
  const status = $("boot-status");
  const steps = [
    [12, "CONNECTING TO NWS…"],
    [28, "LOADING OPEN-METEO…"],
    [45, "FETCHING ALERTS…"],
    [62, "SURFACE OBSERVATIONS…"],
    [78, "AIR QUALITY · TIDES…"],
    [90, "RADAR ARRAY…"],
    [100, "ONLINE"]
  ];
  let i = 0;
  const advance = () => {
    if (i < steps.length) {
      bar.style.width = steps[i][0] + "%";
      status.textContent = steps[i][1];
      i++;
    }
  };
  advance();
  initRadar();
  initAudio();
  tickClock();
  setInterval(tickClock, 1000);

  const t = setInterval(advance, 280);
  await refreshAll();
  clearInterval(t);
  bar.style.width = "100%";
  status.textContent = "ONLINE";

  setTimeout(() => {
    $("boot-screen").classList.add("fade-out");
    $("app").classList.add("ready");
    setTimeout(() => { const b = $("boot-screen"); if (b) b.remove(); }, 600);
  }, 400);

  setInterval(() => {
    cd--;
    if (cd <= 0) { cd = CYCLE; refreshAll(); }
    $("cd").textContent = cd;
  }, 1000);
}

document.addEventListener("DOMContentLoaded", boot);
