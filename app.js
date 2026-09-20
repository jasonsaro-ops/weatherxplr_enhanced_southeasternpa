/**
 * WEATHERXPLR ENHANCED — SE-PA Mission Array
 * Oblivion / GMUNK theme · Single map · NWS office selector · 120s cycle
 */
const localLat = 40.0759;
const localLon = -75.2996;
const localZip = "19428";
const AIRNOW_API_KEY = "E5AFEF36-80F6-4A42-AE38-F3C56E3AEAC4";
const NWS_OFFICES = [{"id": "AFC", "name": "Anchorage", "state": "AK", "lat": 61.16, "lon": -150.0}, {"id": "AFG", "name": "Fairbanks", "state": "AK", "lat": 64.85, "lon": -147.85}, {"id": "AJK", "name": "Juneau", "state": "AK", "lat": 58.36, "lon": -134.58}, {"id": "BMX", "name": "Birmingham", "state": "AL", "lat": 33.17, "lon": -86.78}, {"id": "HUN", "name": "Huntsville", "state": "AL", "lat": 34.64, "lon": -86.78}, {"id": "MOB", "name": "Mobile", "state": "AL", "lat": 30.69, "lon": -88.25}, {"id": "LZK", "name": "Little Rock", "state": "AR", "lat": 34.84, "lon": -92.26}, {"id": "FGZ", "name": "Flagstaff", "state": "AZ", "lat": 35.23, "lon": -111.82}, {"id": "PSR", "name": "Phoenix", "state": "AZ", "lat": 33.43, "lon": -112.02}, {"id": "TWC", "name": "Tucson", "state": "AZ", "lat": 32.12, "lon": -110.93}, {"id": "EKA", "name": "Eureka", "state": "CA", "lat": 40.8, "lon": -124.16}, {"id": "HNX", "name": "Hanford", "state": "CA", "lat": 36.31, "lon": -119.63}, {"id": "LOX", "name": "Los Angeles", "state": "CA", "lat": 34.2, "lon": -118.5}, {"id": "STO", "name": "Sacramento", "state": "CA", "lat": 38.55, "lon": -121.42}, {"id": "SGX", "name": "San Diego", "state": "CA", "lat": 32.83, "lon": -117.13}, {"id": "MTR", "name": "San Francisco", "state": "CA", "lat": 37.73, "lon": -122.5}, {"id": "BOU", "name": "Boulder", "state": "CO", "lat": 40.0, "lon": -105.25}, {"id": "GJT", "name": "Grand Junction", "state": "CO", "lat": 39.12, "lon": -108.53}, {"id": "PUB", "name": "Pueblo", "state": "CO", "lat": 38.28, "lon": -104.52}, {"id": "JAX", "name": "Jacksonville", "state": "FL", "lat": 30.48, "lon": -81.7}, {"id": "KEY", "name": "Key West", "state": "FL", "lat": 24.55, "lon": -81.78}, {"id": "MLB", "name": "Melbourne", "state": "FL", "lat": 28.11, "lon": -80.65}, {"id": "MFL", "name": "Miami", "state": "FL", "lat": 25.75, "lon": -80.38}, {"id": "TAE", "name": "Tallahassee", "state": "FL", "lat": 30.39, "lon": -84.33}, {"id": "TBW", "name": "Tampa Bay", "state": "FL", "lat": 27.7, "lon": -82.4}, {"id": "FFC", "name": "Atlanta", "state": "GA", "lat": 33.36, "lon": -84.56}, {"id": "HFO", "name": "Honolulu", "state": "HI", "lat": 21.3, "lon": -157.9}, {"id": "DMX", "name": "Des Moines", "state": "IA", "lat": 41.73, "lon": -93.72}, {"id": "DVN", "name": "Quad Cities", "state": "IA", "lat": 41.61, "lon": -90.58}, {"id": "BOI", "name": "Boise", "state": "ID", "lat": 43.57, "lon": -116.21}, {"id": "PIH", "name": "Pocatello", "state": "ID", "lat": 42.91, "lon": -112.6}, {"id": "ILX", "name": "Central Illinois", "state": "IL", "lat": 40.15, "lon": -89.34}, {"id": "LOT", "name": "Chicago", "state": "IL", "lat": 41.6, "lon": -88.1}, {"id": "IND", "name": "Indianapolis", "state": "IN", "lat": 39.71, "lon": -86.28}, {"id": "IWX", "name": "Northern Indiana", "state": "IN", "lat": 41.36, "lon": -85.68}, {"id": "DDC", "name": "Dodge City", "state": "KS", "lat": 37.76, "lon": -99.97}, {"id": "GLD", "name": "Goodland", "state": "KS", "lat": 39.37, "lon": -101.7}, {"id": "TOP", "name": "Topeka", "state": "KS", "lat": 39.07, "lon": -95.63}, {"id": "ICT", "name": "Wichita", "state": "KS", "lat": 37.65, "lon": -97.44}, {"id": "JKL", "name": "Jackson", "state": "KY", "lat": 37.59, "lon": -83.31}, {"id": "LMK", "name": "Louisville", "state": "KY", "lat": 38.12, "lon": -85.74}, {"id": "PAH", "name": "Paducah", "state": "KY", "lat": 37.07, "lon": -88.77}, {"id": "LCH", "name": "Lake Charles", "state": "LA", "lat": 30.12, "lon": -93.22}, {"id": "LIX", "name": "New Orleans", "state": "LA", "lat": 30.34, "lon": -89.82}, {"id": "SHV", "name": "Shreveport", "state": "LA", "lat": 32.45, "lon": -93.84}, {"id": "BOX", "name": "Boston", "state": "MA", "lat": 41.96, "lon": -71.13}, {"id": "CAR", "name": "Caribou", "state": "ME", "lat": 46.87, "lon": -68.02}, {"id": "GYX", "name": "Gray/Portland", "state": "ME", "lat": 43.89, "lon": -70.25}, {"id": "APX", "name": "Gaylord", "state": "MI", "lat": 44.91, "lon": -84.72}, {"id": "DTX", "name": "Detroit", "state": "MI", "lat": 42.7, "lon": -83.47}, {"id": "GRR", "name": "Grand Rapids", "state": "MI", "lat": 42.89, "lon": -85.54}, {"id": "MQT", "name": "Marquette", "state": "MI", "lat": 46.53, "lon": -87.55}, {"id": "DLH", "name": "Duluth", "state": "MN", "lat": 46.84, "lon": -92.21}, {"id": "MPX", "name": "Minneapolis", "state": "MN", "lat": 44.85, "lon": -93.57}, {"id": "EAX", "name": "Kansas City", "state": "MO", "lat": 38.81, "lon": -94.26}, {"id": "SGF", "name": "Springfield", "state": "MO", "lat": 37.24, "lon": -93.4}, {"id": "LSX", "name": "St. Louis", "state": "MO", "lat": 38.7, "lon": -90.68}, {"id": "JAN", "name": "Jackson", "state": "MS", "lat": 32.32, "lon": -90.08}, {"id": "BYZ", "name": "Billings", "state": "MT", "lat": 45.78, "lon": -108.54}, {"id": "GGW", "name": "Glasgow", "state": "MT", "lat": 48.21, "lon": -106.62}, {"id": "TFX", "name": "Great Falls", "state": "MT", "lat": 47.46, "lon": -111.38}, {"id": "MSO", "name": "Missoula", "state": "MT", "lat": 46.92, "lon": -114.09}, {"id": "GSP", "name": "Greenville-Spartanburg", "state": "NC", "lat": 34.9, "lon": -82.22}, {"id": "MHX", "name": "Newport/Morehead", "state": "NC", "lat": 34.78, "lon": -76.88}, {"id": "RAH", "name": "Raleigh", "state": "NC", "lat": 35.87, "lon": -78.79}, {"id": "BIS", "name": "Bismarck", "state": "ND", "lat": 46.77, "lon": -100.76}, {"id": "FGF", "name": "Grand Forks", "state": "ND", "lat": 47.95, "lon": -97.33}, {"id": "GID", "name": "Hastings", "state": "NE", "lat": 40.56, "lon": -98.31}, {"id": "LBF", "name": "North Platte", "state": "NE", "lat": 41.12, "lon": -100.77}, {"id": "OAX", "name": "Omaha", "state": "NE", "lat": 41.32, "lon": -96.37}, {"id": "ABQ", "name": "Albuquerque", "state": "NM", "lat": 35.05, "lon": -106.62}, {"id": "LKN", "name": "Elko", "state": "NV", "lat": 40.85, "lon": -115.75}, {"id": "VEF", "name": "Las Vegas", "state": "NV", "lat": 36.05, "lon": -115.16}, {"id": "REV", "name": "Reno", "state": "NV", "lat": 39.57, "lon": -119.8}, {"id": "ALY", "name": "Albany", "state": "NY", "lat": 42.69, "lon": -73.83}, {"id": "BGM", "name": "Binghamton", "state": "NY", "lat": 42.2, "lon": -75.98}, {"id": "BUF", "name": "Buffalo", "state": "NY", "lat": 42.94, "lon": -78.73}, {"id": "OKX", "name": "New York", "state": "NY", "lat": 40.87, "lon": -72.86}, {"id": "CLE", "name": "Cleveland", "state": "OH", "lat": 41.41, "lon": -81.86}, {"id": "ILN", "name": "Wilmington", "state": "OH", "lat": 39.42, "lon": -83.82}, {"id": "OUN", "name": "Norman", "state": "OK", "lat": 35.24, "lon": -97.46}, {"id": "TSA", "name": "Tulsa", "state": "OK", "lat": 36.16, "lon": -95.84}, {"id": "MFR", "name": "Medford", "state": "OR", "lat": 42.38, "lon": -122.87}, {"id": "PDT", "name": "Pendleton", "state": "OR", "lat": 45.69, "lon": -118.85}, {"id": "PQR", "name": "Portland", "state": "OR", "lat": 45.56, "lon": -122.54}, {"id": "PHI", "name": "Philadelphia", "state": "PA", "lat": 39.87, "lon": -75.25}, {"id": "PBZ", "name": "Pittsburgh", "state": "PA", "lat": 40.53, "lon": -80.22}, {"id": "CTP", "name": "State College", "state": "PA", "lat": 40.85, "lon": -77.85}, {"id": "CAE", "name": "Columbia", "state": "SC", "lat": 33.95, "lon": -81.12}, {"id": "CHS", "name": "Charleston", "state": "SC", "lat": 32.9, "lon": -80.03}, {"id": "ABR", "name": "Aberdeen", "state": "SD", "lat": 45.45, "lon": -98.42}, {"id": "UNR", "name": "Rapid City", "state": "SD", "lat": 44.07, "lon": -103.21}, {"id": "FSD", "name": "Sioux Falls", "state": "SD", "lat": 43.59, "lon": -96.75}, {"id": "MEG", "name": "Memphis", "state": "TN", "lat": 35.05, "lon": -89.98}, {"id": "MRX", "name": "Morristown", "state": "TN", "lat": 36.17, "lon": -83.4}, {"id": "OHX", "name": "Nashville", "state": "TN", "lat": 36.25, "lon": -86.56}, {"id": "AMA", "name": "Amarillo", "state": "TX", "lat": 35.23, "lon": -101.7}, {"id": "EWX", "name": "Austin/San Antonio", "state": "TX", "lat": 29.7, "lon": -98.03}, {"id": "BRO", "name": "Brownsville", "state": "TX", "lat": 25.91, "lon": -97.42}, {"id": "CRP", "name": "Corpus Christi", "state": "TX", "lat": 27.77, "lon": -97.5}, {"id": "FWD", "name": "Dallas/Fort Worth", "state": "TX", "lat": 32.9, "lon": -97.0}, {"id": "EPZ", "name": "El Paso", "state": "TX", "lat": 31.87, "lon": -106.7}, {"id": "HGX", "name": "Houston", "state": "TX", "lat": 29.47, "lon": -95.08}, {"id": "LUB", "name": "Lubbock", "state": "TX", "lat": 33.65, "lon": -101.82}, {"id": "MAF", "name": "Midland/Odessa", "state": "TX", "lat": 31.94, "lon": -102.2}, {"id": "SJT", "name": "San Angelo", "state": "TX", "lat": 31.37, "lon": -100.5}, {"id": "SLC", "name": "Salt Lake City", "state": "UT", "lat": 40.77, "lon": -111.95}, {"id": "RNK", "name": "Blacksburg", "state": "VA", "lat": 37.2, "lon": -80.41}, {"id": "AKQ", "name": "Wakefield", "state": "VA", "lat": 36.98, "lon": -76.95}, {"id": "LWX", "name": "Baltimore/Washington", "state": "VA", "lat": 38.98, "lon": -77.48}, {"id": "BTV", "name": "Burlington", "state": "VT", "lat": 44.47, "lon": -73.15}, {"id": "SEW", "name": "Seattle", "state": "WA", "lat": 47.68, "lon": -122.25}, {"id": "OTX", "name": "Spokane", "state": "WA", "lat": 47.68, "lon": -117.63}, {"id": "GRB", "name": "Green Bay", "state": "WI", "lat": 44.5, "lon": -88.11}, {"id": "ARX", "name": "La Crosse", "state": "WI", "lat": 43.82, "lon": -91.19}, {"id": "MKX", "name": "Milwaukee", "state": "WI", "lat": 42.97, "lon": -88.55}, {"id": "RLX", "name": "Charleston", "state": "WV", "lat": 38.31, "lon": -81.72}, {"id": "CYS", "name": "Cheyenne", "state": "WY", "lat": 41.15, "lon": -104.81}, {"id": "RIW", "name": "Riverton", "state": "WY", "lat": 43.06, "lon": -108.48}];

const schuylkillGauges = [
  { id: "01472000", name: "Schuylkill @ Reading" },
  { id: "01473500", name: "Schuylkill @ Pottstown" },
  { id: "01474500", name: "Schuylkill @ Norriton" },
  { id: "01474703", name: "Schuylkill @ Conshohocken" },
  { id: "01474000", name: "Schuylkill @ Fairmount Dam" }
];

const WINDY_LAYERS = [
  { group: "Radar / Satellite", items: [
    { v: "radar", l: "Weather Radar" }, { v: "satellite", l: "Satellite" }
  ]},
  { group: "Wind", items: [
    { v: "wind", l: "Wind" }, { v: "gust", l: "Wind Gusts" }, { v: "pressure", l: "Pressure" }
  ]},
  { group: "Temperature", items: [
    { v: "temp", l: "Temperature" }, { v: "dewpoint", l: "Dew Point" }, { v: "rh", l: "Humidity" }, { v: "wetbulbtemp", l: "Wet-bulb" }
  ]},
  { group: "Rain / Snow", items: [
    { v: "rain", l: "Rain / Thunder" }, { v: "rainAccum", l: "Rain Accum" }, { v: "snow", l: "New Snow" },
    { v: "snowcover", l: "Snow Depth" }, { v: "thunder", l: "Thunderstorms" }
  ]},
  { group: "Clouds / Aviation", items: [
    { v: "clouds", l: "Clouds" }, { v: "hclouds", l: "High Clouds" }, { v: "mclouds", l: "Medium Clouds" },
    { v: "lclouds", l: "Low Clouds" }, { v: "fog", l: "Fog" }, { v: "cape", l: "CAPE" },
    { v: "thermals", l: "Thermals" }, { v: "visibility", l: "Visibility" }, { v: "icing", l: "Icing" }
  ]},
  { group: "Waves / Sea", items: [
    { v: "waves", l: "Waves" }, { v: "swell", l: "Swell" }, { v: "sst", l: "Sea Temp" }, { v: "currents", l: "Currents" }
  ]},
  { group: "Air Quality", items: [
    { v: "airquality", l: "AQI" }, { v: "pm2p5", l: "PM2.5" }, { v: "no2", l: "NO₂" }, { v: "dust", l: "Dust" }
  ]},
  { group: "Hazards", items: [
    { v: "fire", l: "Fire Danger" }, { v: "drought", l: "Drought" }, { v: "warnings", l: "Weather Warnings" }
  ]}
];

function buildLayerSelect(id, selected) {
  let h = `<select id="${id}">`;
  WINDY_LAYERS.forEach(g => {
    h += `<optgroup label="${g.group}">`;
    g.items.forEach(it => { h += `<option value="${it.v}"${it.v===selected?" selected":""}>${it.l}</option>`; });
    h += `</optgroup>`;
  });
  return h + `</select>`;
}
function windyUrl(overlay, lat, lon, zoom) {
  lat = lat != null ? lat : localLat;
  lon = lon != null ? lon : localLon;
  zoom = zoom || 8;
  const product = (overlay === "radar" || overlay === "satellite") ? overlay : "gfs";
  return `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=f&metricWind=mph&zoom=${zoom}&overlay=${overlay}&product=${product}&level=surface&lat=${lat}&lon=${lon}`;
}

/* State */
let countdownVal = 120;
let globalForecastDataCache = null;
let globalHourlyCache = null;
let globalActiveAlertsCache = {};
let globalAQIDetailsCache = {};
let globalObsCache = {};
let globalPointsMeta = null;
let noaaChartInstance = null;
let previousAlertIds = new Set();
let hasAlertBaseline = false;
let audioEnabled = false;
let feedStatus = { nws: true, aqi: true, hydro: true, tides: true, obs: true };
let selectedOffice = NWS_OFFICES.find(o => o.id === "PHI") || NWS_OFFICES[0];
let officeAlertsCache = {};

/* Audio */
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
  osc.type = type; osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.02);
  gain.gain.linearRampToValueAtTime(0, start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start); osc.stop(start + dur + 0.02);
}
function playExtremeTone() {
  const now = getAudioCtx().currentTime;
  [880,660,880,660,880,660].forEach((f,i) => scheduleTone(f, now+i*0.14, 0.13, "sawtooth", 0.22));
}
function playSevereTone() {
  const now = getAudioCtx().currentTime;
  scheduleTone(523.25, now, 0.32, "sine", 0.2);
  scheduleTone(784.0, now+0.28, 0.4, "sine", 0.2);
}
function playAdvisoryTone() {
  const now = getAudioCtx().currentTime;
  scheduleTone(440, now, 0.1, "triangle", 0.2);
  scheduleTone(440, now+0.17, 0.1, "triangle", 0.2);
}
const SEV_TONES = { extreme: playExtremeTone, severe: playSevereTone, moderate: playSevereTone, minor: playAdvisoryTone, unknown: playAdvisoryTone };
function playAlertsForSeverities(set) {
  let d = 0;
  ["extreme","severe","moderate","minor","unknown"].forEach(s => {
    if (!set.has(s)) return;
    setTimeout(() => SEV_TONES[s](), d); d += 900;
  });
}
function initAudioToggle() {
  const btn = document.getElementById("audio-toggle-btn");
  if (!btn) return;
  try { audioEnabled = localStorage.getItem("weatherxplr_audio_enabled") === "true"; } catch(e){}
  updateAudioUI();
  btn.addEventListener("click", () => {
    audioEnabled = !audioEnabled;
    try { localStorage.setItem("weatherxplr_audio_enabled", String(audioEnabled)); } catch(e){}
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
    btn.classList.remove("audio-off"); btn.classList.add("audio-on");
    lbl.textContent = "TONES ON";
    if (icon) icon.className = "fa-solid fa-volume-high";
  } else {
    btn.classList.remove("audio-on"); btn.classList.add("audio-off");
    lbl.textContent = "TONES OFF";
    if (icon) icon.className = "fa-solid fa-volume-xmark";
  }
}

/* Clear any saved GoldenLayout state so dual-map layouts don't persist */
try {
  Object.keys(localStorage).forEach(k => {
    if (k.indexOf("goldenLayout") >= 0 || k.indexOf("gl-") >= 0) localStorage.removeItem(k);
  });
} catch(e){}

/* Layout — SINGLE map only */
const config = {
  settings: { hasHeaders: true, reorderEnabled: true, showPopoutIcon: false, showMaximiseIcon: true, showCloseIcon: false },
  content: [{
    type: "row",
    content: [
      {
        type: "column", width: 24,
        content: [
          { type: "component", componentName: "nwsAlerts", title: "NWS HAZARDS", height: 36 },
          {
            type: "stack", height: 64,
            content: [
              { type: "component", componentName: "officeExplorer", title: "NWS OFFICE" },
              { type: "component", componentName: "currentObs", title: "SURFACE OBS" },
              { type: "component", componentName: "nwsMeta", title: "NWS METADATA" },
              { type: "component", componentName: "nwsDiscussion", title: "PHI AFD" },
              { type: "component", componentName: "systemTelemetry", title: "TELEMETRY" }
            ]
          }
        ]
      },
      {
        type: "column", width: 52,
        content: [
          { type: "component", componentName: "radarMap", title: "RADAR / MODEL ARRAY" }
        ]
      },
      {
        type: "column", width: 24,
        content: [
          {
            type: "stack", height: 38,
            content: [
              { type: "component", componentName: "localForecast", title: "7-DAY" },
              { type: "component", componentName: "hourlyForecast", title: "HOURLY" }
            ]
          },
          {
            type: "stack", height: 62,
            content: [
              { type: "component", componentName: "airQualityPanel", title: "AIR QUALITY" },
              { type: "component", componentName: "hydrologyFeed", title: "HYDROLOGY" },
              { type: "component", componentName: "noaaTides", title: "TIDES" }
            ]
          }
        ]
      }
    ]
  }]
};

const layout = new GoldenLayout(config, "#layout-root");

layout.registerComponent("radarMap", function(container) {
  container.getElement().html(`
    <div style="position:relative;width:100%;height:100%;background:#08090b;">
      <div class="layer-bar">${buildLayerSelect("radarLayerSelect","radar")}</div>
      <iframe id="radarIframe" src="${windyUrl("radar")}" style="width:100%;height:100%;border:none;"></iframe>
    </div>`);
  setTimeout(() => {
    container.getElement().find("#radarLayerSelect").on("change", function() {
      container.getElement().find("#radarIframe")[0].src = windyUrl(this.value);
    });
  }, 150);
});

layout.registerComponent("officeExplorer", function(container) {
  let opts = "";
  let curState = "";
  NWS_OFFICES.forEach(o => {
    if (o.state !== curState) {
      if (curState) opts += `</optgroup>`;
      curState = o.state;
      opts += `<optgroup label="${curState}">`;
    }
    const sel = o.id === "PHI" ? " selected" : "";
    opts += `<option value="${o.id}"${sel}>${o.id} — ${o.name}</option>`;
  });
  if (curState) opts += `</optgroup>`;

  container.getElement().html(`
    <div class="wcomp">
      <div class="phdr"><i class="fa-solid fa-building"></i> NWS FORECAST OFFICE</div>
      <select id="officeSelect" style="width:100%;background:var(--bg-elev);color:var(--cyan);border:1px solid var(--line-bright);padding:4px 6px;font-family:inherit;font-size:11px;margin-bottom:6px;">
        ${opts}
      </select>
      <div id="office-info" style="font-size:10px;color:var(--text-dim);margin-bottom:6px;"></div>
      <div style="height:140px;margin-bottom:6px;border:1px solid var(--line);position:relative;background:#08090b;">
        <iframe id="officeRadar" style="width:100%;height:100%;border:none;"></iframe>
      </div>
      <div class="phdr" style="margin-top:4px;"><span>OFFICE ALERTS</span><span id="office-alert-count" style="font-weight:400;color:var(--text-dim);"></span></div>
      <div id="office-alerts">Select an office…</div>
    </div>`);

  setTimeout(() => {
    const sel = document.getElementById("officeSelect");
    if (sel) {
      sel.addEventListener("change", () => {
        const o = NWS_OFFICES.find(x => x.id === sel.value);
        if (o) { selectedOffice = o; loadOfficeData(); }
      });
    }
    loadOfficeData();
  }, 200);
});

layout.registerComponent("nwsMeta", function(container) {
  container.getElement().html(`<div class="wcomp" id="nws-meta-container">Loading NWS point metadata…</div>`);
  container.on("open", fetchNWSMetadata);
});

layout.registerComponent("localForecast", function(container) {
  container.getElement().html(`<div class="wcomp" id="forecast-container">Loading…</div>`);
  container.on("open", fetchNWSForecast);
});
layout.registerComponent("hourlyForecast", function(container) {
  container.getElement().html(`<div class="wcomp" id="hourly-container">Loading…</div>`);
  container.on("open", fetchHourlyForecast);
});
layout.registerComponent("nwsAlerts", function(container) {
  container.getElement().html(`
    <div class="wcomp">
      <div class="phdr"><span><i class="fa-solid fa-triangle-exclamation"></i> ACTIVE ALERTS · PA</span><span id="alert-panel-count" style="font-weight:400;color:var(--text-dim);"></span></div>
      <div id="alerts-container">Scanning…</div>
    </div>`);
  container.on("open", fetchPennsylvaniaAlerts);
});
layout.registerComponent("currentObs", function(container) {
  container.getElement().html(`<div class="wcomp" id="obs-container">Stations…</div>`);
  container.on("open", fetchCurrentObservations);
});
layout.registerComponent("nwsDiscussion", function(container) {
  container.getElement().html(`<div class="wcomp" id="discussion-container">AFD…</div>`);
  container.on("open", fetchNWSDiscussion);
});
layout.registerComponent("airQualityPanel", function(container) {
  container.getElement().html(`<div class="wcomp" id="aqi-container-target">AirNow…</div>`);
  container.on("open", fetchAirQualityData);
});
layout.registerComponent("noaaTides", function(container) {
  container.getElement().html(`
    <div class="wcomp" style="display:flex;flex-direction:column;gap:6px;">
      <div id="noaa-gauges"><span style="color:var(--text-dim);font-size:10px;">NOAA…</span></div>
      <div style="flex:1;min-height:130px;position:relative;background:var(--bg-elev);border:1px solid var(--line);padding:6px;">
        <canvas id="noaaChart"></canvas>
      </div>
    </div>`);
  container.on("open", fetchNOAATides);
});
layout.registerComponent("hydrologyFeed", function(container) {
  container.getElement().html(`<div class="wcomp" id="hydro-river-list">USGS…</div>`);
  container.on("open", fetchSchuylkillHydrology);
});
layout.registerComponent("systemTelemetry", function(container) {
  container.getElement().html(`
    <div class="wcomp">
      <div class="phdr"><i class="fa-solid fa-microchip"></i> TELEMETRY</div>
      <div class="tel-grid">
        <div class="tel-cell"><div class="tel-val" id="t-cycle">120</div><div class="tel-lbl">Cycle</div></div>
        <div class="tel-cell"><div class="tel-val" id="t-alerts">0</div><div class="tel-lbl">Alerts</div></div>
        <div class="tel-cell"><div class="tel-val" id="t-feeds">5/5</div><div class="tel-lbl">Feeds</div></div>
        <div class="tel-cell"><div class="tel-val" id="t-audio">OFF</div><div class="tel-lbl">Tones</div></div>
      </div>
      <div style="margin-top:8px;font-size:10px;color:var(--text-dim);line-height:1.5;">
        <div><span style="color:var(--cyan);">FOCUS</span> 40.0759°N / 75.2996°W</div>
        <div><span style="color:var(--cyan);">CWA</span> PHI · 120s cycle</div>
      </div>
    </div>`);
  container.on("open", updateTelemetry);
});

layout.init();

/* Office explorer */
function loadOfficeData() {
  const o = selectedOffice;
  if (!o) return;
  const info = document.getElementById("office-info");
  if (info) info.innerHTML = `<b style="color:var(--white);">${o.id}</b> · ${o.name} · ${o.state}<br>${o.lat.toFixed(2)}°N ${Math.abs(o.lon).toFixed(2)}°W`;
  const iframe = document.getElementById("officeRadar");
  if (iframe) iframe.src = windyUrl("radar", o.lat, o.lon, 7);
  fetchOfficeAlerts(o);
}

function fetchOfficeAlerts(o) {
  const container = $("#office-alerts");
  if (!container.length) return;
  container.html(`<span style="color:var(--text-dim);font-size:10px;">Loading alerts for ${o.id}…</span>`);
  // Alerts by point near office
  fetch(`https://api.weather.gov/alerts/active?point=${o.lat},${o.lon}`)
    .then(r => r.json())
    .then(data => {
      const alerts = data.features || [];
      officeAlertsCache = {};
      let html = "";
      if (!alerts.length) {
        html = `<div style="color:var(--green);font-size:10px;padding:4px 0;">CLEAR — no active alerts near ${o.id}</div>`;
      } else {
        alerts.forEach(f => {
          const p = f.properties;
          officeAlertsCache[p.id] = p;
          const sev = (p.severity || "").toLowerCase();
          const cls = sev === "extreme" ? "sev-extreme" : sev === "severe" ? "sev-severe" : sev === "moderate" ? "sev-moderate" : sev === "minor" ? "sev-minor" : "sev-unknown";
          html += `<div class="alert-item ${cls}" onclick="openOfficeAlert('${p.id}')">
            <div class="alert-title" style="color:${sev==="extreme"||sev==="severe"?"var(--red)":"var(--orange)"};">${p.event}</div>
            <div class="alert-meta">${p.severity || "—"} · ${(p.areaDesc||"").substring(0,50)}</div>
          </div>`;
        });
      }
      const cnt = document.getElementById("office-alert-count");
      if (cnt) cnt.textContent = alerts.length ? alerts.length + " ACTIVE" : "CLEAR";
      container.html(html);
    })
    .catch(() => container.html(`<span style="color:var(--red);font-size:10px;">Alert fetch failed</span>`));
}

function openOfficeAlert(id) {
  const a = officeAlertsCache[id];
  if (!a) return;
  let body = `<div style="color:var(--red);font-weight:600;margin-bottom:8px;border-bottom:1px solid var(--line);padding-bottom:6px;">${a.headline || a.event}</div>`;
  body += `<div style="color:var(--text-dim);margin-bottom:6px;font-size:11px;">${a.severity||"—"} · ${a.urgency||"—"} · ${a.certainty||"—"}</div>`;
  body += `<div style="color:var(--text-dim);margin-bottom:8px;font-size:11px;"><b>Area:</b> ${a.areaDesc||""}</div>`;
  body += `<div style="background:var(--bg);padding:10px;border:1px solid var(--line);font-size:11px;white-space:pre-wrap;">${a.description||""}</div>`;
  if (a.instruction) body += `<div style="color:var(--cyan);margin-top:10px;padding:10px;border:1px solid var(--line);font-size:11px;white-space:pre-wrap;">${a.instruction}</div>`;
  openModal("OFFICE ALERT · " + (selectedOffice ? selectedOffice.id : ""), body);
}

/* NWS Metadata — full points response */
function fetchNWSMetadata() {
  fetch(`https://api.weather.gov/points/${localLat},${localLon}`)
    .then(r => r.json())
    .then(d => {
      globalPointsMeta = d.properties || {};
      const p = globalPointsMeta;
      const rel = p.relativeLocation && p.relativeLocation.properties ? p.relativeLocation.properties : {};
      let html = `<div class="phdr"><i class="fa-solid fa-database"></i> NWS POINT METADATA</div>`;
      html += `<div style="font-size:10.5px;line-height:1.65;color:var(--text);">`;
      const rows = [
        ["Grid ID", p.gridId],
        ["Grid X / Y", `${p.gridX} / ${p.gridY}`],
        ["Forecast Office", p.cwa || p.forecastOffice],
        ["Time Zone", p.timeZone],
        ["Radar Station", p.radarStation],
        ["County", p.county],
        ["Fire Weather Zone", p.fireWeatherZone],
        ["Forecast Zone", p.forecastZone],
        ["Relative City", rel.city],
        ["Relative State", rel.state],
        ["Distance", rel.distance && rel.distance.value != null ? rel.distance.value.toFixed(1) + " " + (rel.distance.unitCode||"").replace("wmoUnit:","") : "—"],
        ["Bearing", rel.bearing && rel.bearing.value != null ? rel.bearing.value + "°" : "—"],
        ["@id", p["@id"] || "—"]
      ];
      rows.forEach(([k,v]) => {
        if (v == null || v === "") return;
        html += `<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding:3px 0;">
          <span style="color:var(--text-dim);">${k}</span>
          <span style="color:var(--cyan);text-align:right;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${v}">${v}</span>
        </div>`;
      });
      html += `</div>`;
      // endpoints
      html += `<div class="phdr" style="margin-top:10px;"><i class="fa-solid fa-link"></i> ENDPOINTS</div>`;
      html += `<div style="font-size:9.5px;line-height:1.6;">`;
      ["forecast","forecastHourly","forecastGridData","observationStations"].forEach(key => {
        if (p[key]) html += `<div style="color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p[key]}">${key}: <span style="color:var(--cyan-dim);">${p[key].replace("https://api.weather.gov/","")}</span></div>`;
      });
      html += `</div>`;
      $("#nws-meta-container").html(html);
    })
    .catch(() => $("#nws-meta-container").html(`<span style="color:var(--red);">Metadata unavailable</span>`));
}

/* Clock / status */
function updateClock() {
  const now = new Date();
  const utc = now.toISOString().substr(11,8) + "Z";
  const local = now.toLocaleTimeString("en-US",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const el = document.getElementById("mission-clock");
  if (el) el.textContent = `${local} L  ·  ${utc}`;
}
function setDot(id, ok) {
  const el = document.getElementById(id);
  if (el) el.className = "dot " + (ok ? "ok" : "err");
}
function markSync() {
  const el = document.getElementById("last-sync");
  if (el) el.textContent = "SYNC " + new Date().toLocaleTimeString("en-US",{hour12:false});
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

/* Forecast */
function fetchNWSForecast() {
  fetch(`https://api.weather.gov/points/${localLat},${localLon}`)
    .then(r => r.json()).then(d => fetch(d.properties.forecast))
    .then(r => r.json())
    .then(data => {
      feedStatus.nws = true; setDot("dot-nws", true);
      globalForecastDataCache = data.properties.periods;
      let html = `<div class="phdr"><i class="fa-solid fa-calendar-days"></i> 7-DAY · 19428</div><div class="fc-grid">`;
      globalForecastDataCache.forEach((p,i) => {
        html += `<div class="fc-card" onclick="openForecastDetails(${i})">
          <div style="color:var(--text-dim);font-size:9px;font-weight:600;height:14px;overflow:hidden;">${p.name.toUpperCase()}</div>
          <img src="${p.icon}" alt="">
          <div class="${p.isDaytime?"t-hi":"t-lo"}">${p.temperature}°</div>
          <div style="font-size:8px;color:var(--text-dim);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${p.shortForecast}</div>
        </div>`;
      });
      html += `</div>`;
      $("#forecast-container").html(html);
    })
    .catch(() => { feedStatus.nws=false; setDot("dot-nws",false); $("#forecast-container").html(`<span style="color:var(--red);">TIMEOUT</span>`); });
}
function openForecastDetails(i) {
  const p = globalForecastDataCache && globalForecastDataCache[i];
  if (!p) return;
  openModal(p.name, `
    <div style="text-align:center;margin-bottom:12px;">
      <img src="${p.icon}" style="width:52px;">
      <div style="font-size:20px;color:#fff;margin:4px 0;">${p.temperature}°${p.temperatureUnit}</div>
      <div style="color:var(--cyan);font-weight:600;">${p.shortForecast}</div>
    </div>
    <div style="border-top:1px solid var(--line);padding-top:12px;line-height:1.55;">${p.detailedForecast}</div>
    <div style="margin-top:10px;font-size:10px;color:var(--text-dim);">
      Wind: ${p.windSpeed||"—"} ${p.windDirection||""} · Precip: ${p.probabilityOfPrecipitation && p.probabilityOfPrecipitation.value != null ? p.probabilityOfPrecipitation.value+"%" : "—"}
      · Start: ${p.startTime ? new Date(p.startTime).toLocaleString() : "—"}
    </div>`);
}

function fetchHourlyForecast() {
  fetch(`https://api.weather.gov/points/${localLat},${localLon}`)
    .then(r => r.json()).then(d => fetch(d.properties.forecastHourly))
    .then(r => r.json())
    .then(data => {
      globalHourlyCache = (data.properties.periods||[]).slice(0,24);
      let html = `<div class="phdr"><i class="fa-solid fa-clock"></i> NEXT 24 H</div><div class="hr-strip">`;
      globalHourlyCache.forEach(p => {
        const t = new Date(p.startTime);
        const label = t.toLocaleTimeString("en-US",{hour:"numeric",hour12:true});
        const pop = p.probabilityOfPrecipitation && p.probabilityOfPrecipitation.value != null ? p.probabilityOfPrecipitation.value+"%" : "—";
        html += `<div class="hr-card">
          <div style="color:var(--text-dim);font-size:8px;">${label}</div>
          <img src="${p.icon}" alt="">
          <div class="${p.isDaytime?"t-hi":"t-lo"}" style="font-size:11px;">${p.temperature}°</div>
          <div style="font-size:8px;color:var(--blue);">${pop}</div>
        </div>`;
      });
      html += `</div>`;
      $("#hourly-container").html(html);
    })
    .catch(() => $("#hourly-container").html(`<span style="color:var(--red);">TIMEOUT</span>`));
}

/* PA Alerts */
function sevClass(s) {
  s = (s||"").toLowerCase();
  if (s==="extreme") return "sev-extreme";
  if (s==="severe") return "sev-severe";
  if (s==="moderate") return "sev-moderate";
  if (s==="minor") return "sev-minor";
  return "sev-unknown";
}
function sevKey(s) {
  s = (s||"").toLowerCase();
  return ["extreme","severe","moderate","minor"].includes(s) ? s : "unknown";
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
        alerts.sort((a,b) => {
          const o = {extreme:0,severe:1,moderate:2,minor:3};
          return (o[(a.properties.severity||"").toLowerCase()]??4) - (o[(b.properties.severity||"").toLowerCase()]??4);
        });
        alerts.forEach(f => {
          const p = f.properties;
          globalActiveAlertsCache[p.id] = p;
          currentIds.add(p.id);
          if (hasAlertBaseline && !previousAlertIds.has(p.id)) newSevs.add(sevKey(p.severity));
          const crit = ["extreme","severe"].includes((p.severity||"").toLowerCase());
          html += `<div class="alert-item ${sevClass(p.severity)}" onclick="openAlertDetails('${p.id}')">
            <div class="alert-title" style="color:${crit?"var(--red)":"var(--orange)"};">${p.event}</div>
            <div class="alert-meta">${p.severity||"—"} · ${(p.areaDesc||"").substring(0,50)}</div>
          </div>`;
        });
      } else html = `<div style="color:var(--green);font-size:11px;padding:4px 0;"><i class="fa-solid fa-check"></i> CLEAR</div>`;
      if (hasAlertBaseline && newSevs.size && audioEnabled) playAlertsForSeverities(newSevs);
      if (!hasAlertBaseline) hasAlertBaseline = true;
      previousAlertIds = currentIds;
      const n = alerts.length;
      const ce = document.getElementById("alert-count");
      const chip = document.getElementById("alert-chip");
      const pc = document.getElementById("alert-panel-count");
      if (ce) ce.textContent = n;
      if (pc) pc.textContent = n ? n+" ACTIVE" : "CLEAR";
      if (chip) { if (n) chip.classList.add("alert-on"); else chip.classList.remove("alert-on"); }
      $("#alerts-container").html(html);
      updateTelemetry();
    })
    .catch(() => { feedStatus.nws=false; setDot("dot-nws",false); $("#alerts-container").html(`<span style="color:var(--red);">DOWN</span>`); });
}
function openAlertDetails(id) {
  const a = globalActiveAlertsCache[id];
  if (!a) return;
  let body = `<div style="color:var(--red);font-weight:600;margin-bottom:8px;border-bottom:1px solid var(--line);padding-bottom:6px;">${a.headline||a.event}</div>`;
  body += `<div style="color:var(--text-dim);margin-bottom:6px;font-size:11px;">${a.severity||"—"} · ${a.urgency||"—"} · ${a.certainty||"—"}</div>`;
  body += `<div style="color:var(--text-dim);margin-bottom:8px;font-size:11px;"><b>Area:</b> ${a.areaDesc||""}</div>`;
  body += `<div style="background:var(--bg);padding:10px;border:1px solid var(--line);font-size:11px;white-space:pre-wrap;">${a.description||""}</div>`;
  if (a.instruction) body += `<div style="color:var(--cyan);margin-top:10px;padding:10px;border:1px solid var(--line);font-size:11px;white-space:pre-wrap;">${a.instruction}</div>`;
  openModal("NWS ALERT", body);
}

/* Observations — richer metadata */
function fetchCurrentObservations() {
  fetch(`https://api.weather.gov/points/${localLat},${localLon}`)
    .then(r => r.json()).then(d => fetch(d.properties.observationStations))
    .then(r => r.json())
    .then(st => {
      const stations = (st.features||[]).slice(0,5);
      return Promise.all(stations.map(s =>
        fetch(`https://api.weather.gov/stations/${s.properties.stationIdentifier}/observations/latest`)
          .then(r => r.json())
          .then(obs => ({ id: s.properties.stationIdentifier, name: s.properties.name, elev: s.properties.elevation, obs }))
          .catch(() => null)
      ));
    })
    .then(results => {
      feedStatus.obs = true; setDot("dot-obs", true);
      const valid = (results||[]).filter(Boolean);
      globalObsCache = {};
      let html = `<div class="phdr"><i class="fa-solid fa-temperature-half"></i> SURFACE STATIONS</div>`;
      if (!valid.length) html += `<span style="color:var(--orange);">NO DATA</span>`;
      else valid.forEach(item => {
        const p = item.obs.properties || {};
        const tempC = p.temperature && p.temperature.value != null ? p.temperature.value : null;
        const tempF = tempC != null ? Math.round(tempC*9/5+32) : "—";
        const wind = p.windSpeed && p.windSpeed.value != null ? Math.round(p.windSpeed.value*2.237) : "—";
        const rh = p.relativeHumidity && p.relativeHumidity.value != null ? Math.round(p.relativeHumidity.value) : "—";
        globalObsCache[item.id] = { props: p, name: item.name, elev: item.elev };
        html += `<div class="obs-row" onclick="openObsDetails('${item.id}')">
          <div><div style="color:#fff;font-size:11px;font-weight:600;">${item.id}</div>
          <div class="obs-lbl">${(item.name||"").substring(0,24)}</div></div>
          <div style="text-align:right;"><div class="obs-val">${tempF}°F</div>
          <div class="obs-lbl">${p.textDescription||"—"} · ${wind} mph · ${rh}%</div></div>
        </div>`;
      });
      $("#obs-container").html(html);
    })
    .catch(() => { feedStatus.obs=false; setDot("dot-obs",false); $("#obs-container").html(`<span style="color:var(--red);">TIMEOUT</span>`); });
}
function openObsDetails(id) {
  const pack = globalObsCache[id];
  if (!pack) return;
  const p = pack.props;
  const tF = p.temperature && p.temperature.value != null ? ((p.temperature.value*9/5)+32).toFixed(1) : "—";
  const dF = p.dewpoint && p.dewpoint.value != null ? ((p.dewpoint.value*9/5)+32).toFixed(1) : "—";
  const wind = p.windSpeed && p.windSpeed.value != null ? (p.windSpeed.value*2.237).toFixed(1) : "—";
  const dir = p.windDirection && p.windDirection.value != null ? p.windDirection.value+"°" : "—";
  const gust = p.windGust && p.windGust.value != null ? (p.windGust.value*2.237).toFixed(1)+" mph" : "—";
  const press = p.barometricPressure && p.barometricPressure.value != null ? (p.barometricPressure.value/100).toFixed(1)+" hPa" : "—";
  const slp = p.seaLevelPressure && p.seaLevelPressure.value != null ? (p.seaLevelPressure.value/100).toFixed(1)+" hPa" : "—";
  const vis = p.visibility && p.visibility.value != null ? (p.visibility.value/1609.34).toFixed(1)+" mi" : "—";
  const elev = pack.elev && pack.elev.value != null ? pack.elev.value + " " + (pack.elev.unitCode||"").replace("wmoUnit:","") : "—";
  const heat = p.heatIndex && p.heatIndex.value != null ? ((p.heatIndex.value*9/5)+32).toFixed(1)+"°F" : "—";
  const chill = p.windChill && p.windChill.value != null ? ((p.windChill.value*9/5)+32).toFixed(1)+"°F" : "—";
  openModal(`STATION ${id} · ${pack.name||""}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
      <div><span style="color:var(--text-dim);">Temperature</span><br><b style="color:var(--cyan);font-size:16px;">${tF} °F</b></div>
      <div><span style="color:var(--text-dim);">Dewpoint</span><br><b style="color:var(--cyan);font-size:16px;">${dF} °F</b></div>
      <div><span style="color:var(--text-dim);">Wind</span><br><b style="color:var(--cyan);">${wind} mph @ ${dir}</b></div>
      <div><span style="color:var(--text-dim);">Gust</span><br><b style="color:var(--cyan);">${gust}</b></div>
      <div><span style="color:var(--text-dim);">Humidity</span><br><b style="color:var(--cyan);">${p.relativeHumidity&&p.relativeHumidity.value!=null?Math.round(p.relativeHumidity.value)+"%":"—"}</b></div>
      <div><span style="color:var(--text-dim);">Visibility</span><br><b style="color:var(--cyan);">${vis}</b></div>
      <div><span style="color:var(--text-dim);">Pressure</span><br><b style="color:var(--cyan);">${press}</b></div>
      <div><span style="color:var(--text-dim);">Sea Level</span><br><b style="color:var(--cyan);">${slp}</b></div>
      <div><span style="color:var(--text-dim);">Heat Index</span><br><b style="color:var(--cyan);">${heat}</b></div>
      <div><span style="color:var(--text-dim);">Wind Chill</span><br><b style="color:var(--cyan);">${chill}</b></div>
      <div><span style="color:var(--text-dim);">Elevation</span><br><b style="color:var(--cyan);">${elev}</b></div>
      <div><span style="color:var(--text-dim);">Cloud Layers</span><br><b style="color:var(--cyan);">${p.cloudLayers ? p.cloudLayers.length : "—"}</b></div>
    </div>
    <div style="margin-top:12px;color:var(--text-dim);font-size:11px;">${p.textDescription||""} · ${p.timestamp?new Date(p.timestamp).toLocaleString():""}</div>
    ${p.rawMessage ? `<div style="margin-top:10px;background:var(--bg);padding:8px;border:1px solid var(--line);font-size:10px;font-family:monospace;white-space:pre-wrap;color:var(--cyan-dim);">${p.rawMessage}</div>` : ""}`);
}

/* AFD */
function fetchNWSDiscussion() {
  fetch("https://api.weather.gov/products/types/AFD/locations/PHI")
    .then(r => r.json())
    .then(data => {
      const products = data["@graph"] || [];
      if (!products.length) throw new Error("none");
      return fetch(products[0]["@id"] || `https://api.weather.gov/products/${products[0].id}`);
    })
    .then(r => r.json())
    .then(prod => {
      const text = prod.productText || "No discussion.";
      const preview = text.length > 800 ? text.substring(0,800)+"\n\n… [FULL]" : text;
      window._afdFull = text;
      window._afdWhen = prod.issuanceTime || prod.creationDate || "";
      $("#discussion-container").html(`
        <div class="phdr">
          <span><i class="fa-solid fa-file-lines"></i> PHI AFD</span>
          <button onclick="openFullAFD()" style="background:transparent;border:1px solid var(--line-bright);color:var(--cyan);font-family:inherit;font-size:9px;padding:1px 5px;cursor:pointer;">FULL</button>
        </div>
        <div class="txt-prod" style="cursor:pointer;" onclick="openFullAFD()">${esc(preview)}</div>`);
    })
    .catch(() => $("#discussion-container").html(`<div class="phdr">PHI AFD</div><div style="color:var(--text-dim);font-size:10px;">Unavailable</div>`));
}
function openFullAFD() {
  openModal(`PHI AFD · ${window._afdWhen?new Date(window._afdWhen).toLocaleString():""}`,
    `<pre class="txt-prod" style="max-height:none;border:none;background:transparent;padding:0;">${esc(window._afdFull||"")}</pre>`);
}
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

/* AQI */
const AQI_INFO = {
  1:{label:"Good",color:"#00e400",msg:"Satisfactory."},
  2:{label:"Moderate",color:"#ffff00",msg:"Acceptable."},
  3:{label:"Unhealthy SG",color:"#ff7e00",msg:"Sensitive groups affected."},
  4:{label:"Unhealthy",color:"#ff0000",msg:"Everyone may experience effects."},
  5:{label:"Very Unhealthy",color:"#8f3f97",msg:"Health alert."},
  6:{label:"Hazardous",color:"#7e0023",msg:"Emergency."}
};
function aqiSpec(val, cat) {
  if (cat && AQI_INFO[cat]) return AQI_INFO[cat];
  if (val<=50) return AQI_INFO[1]; if (val<=100) return AQI_INFO[2];
  if (val<=150) return AQI_INFO[3]; if (val<=200) return AQI_INFO[4];
  if (val<=300) return AQI_INFO[5]; return AQI_INFO[6];
}
function fetchAirQualityData() {
  const cur = `https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${localZip}&distance=25&API_KEY=${AIRNOW_API_KEY}`;
  const fc = `https://www.airnowapi.org/aq/forecast/zipCode/?format=application/json&zipCode=${localZip}&distance=25&API_KEY=${AIRNOW_API_KEY}`;
  Promise.all([fetch(cur).then(r=>r.json()), fetch(fc).then(r=>r.json()).catch(()=>[])])
    .then(([data, forecastData]) => {
      feedStatus.aqi = true; setDot("dot-aqi", true);
      globalAQIDetailsCache = {};
      let html = `<div class="phdr"><i class="fa-solid fa-wind"></i> 19428 · LIVE</div>`;
      if (!data||!data.length) html += `<div style="color:var(--orange);font-size:10px;">NO DATA</div>`;
      else {
        html += `<div class="aqi-grid">`;
        data.forEach((p,idx) => {
          const cat = p.Category && p.Category.Number;
          const pr = aqiSpec(p.AQI, cat);
          const key = `p-${idx}`;
          globalAQIDetailsCache[key] = { title: `${p.ParameterName} — ${pr.label}`, body: `<div style="color:${pr.color};font-weight:600;margin-bottom:8px;">${p.ParameterName} — AQI ${p.AQI}</div><div style="font-size:11px;">${pr.msg}</div>` };
          html += `<div class="aqi-cell" onclick="openAQIDetails('${key}')">
            <div style="font-size:8px;color:var(--text-dim);font-weight:600;text-transform:uppercase;">${p.ParameterName}</div>
            <div style="font-size:16px;color:${pr.color};font-weight:600;">${p.AQI}</div>
            <div style="font-size:8px;color:${pr.color};">${pr.label}</div>
          </div>`;
        });
        html += `</div>`;
      }
      $("#aqi-container-target").html(html);
    })
    .catch(() => { feedStatus.aqi=false; setDot("dot-aqi",false); $("#aqi-container-target").html(`<span style="color:var(--red);">TIMEOUT</span>`); });
}
function openAQIDetails(key) {
  const d = globalAQIDetailsCache[key];
  if (d) openModal(d.title, d.body);
}

/* Tides */
function fetchNOAATides() {
  const st = "8545240";
  const base = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${st}&time_zone=lst_ldt&units=english&format=json&date=today`;
  Promise.all([
    fetch(`${base}&product=water_level&datum=MLLW`).then(r=>r.json()),
    fetch(`${base}&product=water_level&datum=NAVD`).then(r=>r.json()),
    fetch(`${base}&product=predictions&datum=MLLW`).then(r=>r.json()),
    fetch(`${base}&product=air_temperature`).then(r=>r.json())
  ]).then(([wlM,wlN,pred,air]) => {
    feedStatus.tides = true; setDot("dot-tides", true);
    const lm = wlM.data ? wlM.data[wlM.data.length-1] : null;
    const ln = wlN.data ? wlN.data[wlN.data.length-1] : null;
    const la = air.data ? air.data[air.data.length-1] : null;
    let g = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;width:100%;">`;
    if (lm) g += `<div style="background:var(--bg-elev);border:1px solid var(--line);padding:5px;text-align:center;"><div style="font-size:8px;color:var(--text-dim);">MLLW</div><div style="font-size:14px;color:var(--cyan);font-weight:600;">${lm.v}</div><div style="font-size:8px;color:var(--text-dim);">ft</div></div>`;
    if (ln) g += `<div style="background:var(--bg-elev);border:1px solid var(--line);padding:5px;text-align:center;"><div style="font-size:8px;color:var(--text-dim);">NAVD</div><div style="font-size:14px;color:var(--cyan);font-weight:600;">${ln.v}</div><div style="font-size:8px;color:var(--text-dim);">ft</div></div>`;
    if (la) g += `<div style="background:var(--bg-elev);border:1px solid var(--line);padding:5px;text-align:center;"><div style="font-size:8px;color:var(--text-dim);">AIR</div><div style="font-size:14px;color:var(--cyan);font-weight:600;">${la.v}</div><div style="font-size:8px;color:var(--text-dim);">°F</div></div>`;
    g += `</div>`;
    $("#noaa-gauges").html(g);
    const labels = wlM.data ? wlM.data.map(d => { const t=d.t.split(" ")[1].split(":"); return t[0]+":"+t[1]; }) : [];
    const dm = wlM.data ? wlM.data.map(d => parseFloat(d.v)) : [];
    const dp = pred.predictions ? pred.predictions.map(d => parseFloat(d.v)) : [];
    const canvas = document.getElementById("noaaChart");
    if (!canvas) return;
    if (noaaChartInstance) noaaChartInstance.destroy();
    Chart.defaults.color = "#6b7582";
    Chart.defaults.font.family = "'IBM Plex Mono', monospace";
    noaaChartInstance = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: { labels, datasets: [
        { label: "Obs", data: dm, borderColor: "#7ec8c8", backgroundColor: "rgba(126,200,200,0.06)", borderWidth: 1.5, pointRadius: 0, fill: true, tension: 0.35 },
        { label: "Pred", data: dp.slice(0, labels.length), borderColor: "#e05a5a", borderDash: [3,3], borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.35 }
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: { legend: { display: true, position: "top", labels: { boxWidth: 8, usePointStyle: true, font: { size: 9 } } } },
        scales: { x: { ticks: { maxTicksLimit: 5, font: { size: 8 } }, grid: { color: "#1c2128" } }, y: { ticks: { font: { size: 8 } }, grid: { color: "#1c2128" } } }
      }
    });
  }).catch(() => { feedStatus.tides=false; setDot("dot-tides",false); $("#noaa-gauges").html(`<span style="color:var(--red);font-size:10px;">TIMEOUT</span>`); });
}

/* Hydro */
function fetchSchuylkillHydrology() {
  feedStatus.hydro = true; setDot("dot-hydro", true);
  let html = `<div class="phdr"><i class="fa-solid fa-water"></i> SCHUYLKILL</div>`;
  schuylkillGauges.forEach(g => {
    html += `<div class="g-card">
      <div style="font-weight:600;color:#fff;font-size:11px;">${g.name}</div>
      <div style="color:var(--cyan);margin:2px 0;font-size:9px;">USGS-${g.id}</div>
      <button class="g-btn" onclick="openHydro('${g.id}','${g.name.replace(/'/g,"\\'")}')"><i class="fa-solid fa-chart-line"></i> Hydrograph</button>
    </div>`;
  });
  $("#hydro-river-list").html(html);
}
function openHydro(id, name) {
  const url = `https://dashboard.waterdata.usgs.gov/api/gwis/2.1/service/site?agencyCode=USGS&siteNumber=${id}&open=plots&banner=false&pad=false`;
  openModal(`USGS · ${name}`, `<div style="height:480px;"><iframe src="${url}" style="width:100%;height:100%;border:none;background:#fff;"></iframe></div>`);
}

/* Modal */
function openModal(title, html) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = html;
  document.getElementById("hubModal").style.display = "flex";
}
function closeModal() {
  document.getElementById("hubModal").style.display = "none";
  document.getElementById("modalBody").innerHTML = "";
}

/* Cycle — includes office alerts */
function fullRefresh() {
  fetchNWSForecast();
  fetchHourlyForecast();
  fetchPennsylvaniaAlerts();
  fetchAirQualityData();
  fetchNOAATides();
  fetchSchuylkillHydrology();
  fetchCurrentObservations();
  fetchNWSDiscussion();
  fetchNWSMetadata();
  if (selectedOffice) fetchOfficeAlerts(selectedOffice);
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
