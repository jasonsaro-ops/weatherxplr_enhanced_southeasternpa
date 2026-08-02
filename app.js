/* WEATHERXPLR Enhanced — ZIP 19428
   NWS PA alerts · AirNow · USGS · NOAA tides · Esri + NEXRAD · SPC
*/

const HOME_VIEW = { lat: 40.05, lon: -75.15, zoom: 9 };   // SE PA / Mount Holly NWS area
const USA_VIEW  = { lat: 39.8, lon: -98.5, zoom: 4 };     // CONUS

const CONFIG = {
  zip: '19428',
  lat: 40.0759,
  lon: -75.2996,
  place: 'Conshohocken, PA',
  airNowKey: 'E5AFEF36-80F6-4A42-AE38-F3C56E3AEAC4',
  noaaStation: '8545240',
  refreshSec: 120,
  nwsUA: 'WEATHERXPLR-Enhanced/1.0 (dashboard; zip 19428)',
  // Optional: OpenWeatherMap Maps 1.0 key for precipitation tiles
  // https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png?appid=KEY
  openWeatherKey: '', // set your OWM key to enable OWM precip layer
};

// RainViewer public radar (no key) — https://www.rainviewer.com/api.html
const RAINVIEWER_MAPS = 'https://api.rainviewer.com/public/weather-maps.json';


const SCHUYLKILL_GAUGES = [
  { id: '01472000', name: 'Schuylkill River at Reading, PA' },
  { id: '01473500', name: 'Schuylkill River at Pottstown, PA' },
  { id: '01474500', name: 'Schuylkill River at Norriton, PA' },
  { id: '01474703', name: 'Schuylkill River at Conshohocken, PA' },
  { id: '01474000', name: 'Schuylkill River at Philadelphia, PA (Fairmount Dam)' },
];

const AQI_CATEGORY = {
  1: { label: 'Good', color: '#00e400', message: 'Air quality is satisfactory; little or no risk.' },
  2: { label: 'Moderate', color: '#ffff00', message: 'Acceptable. Sensitive people should limit prolonged outdoor exertion.' },
  3: { label: 'Unhealthy SG', color: '#ff7e00', message: 'Sensitive groups may experience health effects.' },
  4: { label: 'Unhealthy', color: '#ff0000', message: 'Everyone may begin to experience health effects.' },
  5: { label: 'Very Unhealthy', color: '#8f3f97', message: 'Health alert: more serious effects possible.' },
  6: { label: 'Hazardous', color: '#7e0023', message: 'Emergency conditions for the entire population.' },
};

const BASEMAPS = {
  streets: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles © Esri',
    maxZoom: 19,
    maxNativeZoom: 19,
  },
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles © Esri',
    maxZoom: 16,
    maxNativeZoom: 16,
  },
  topo: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles © Esri',
    maxZoom: 19,
    maxNativeZoom: 19,
  },
  imagery: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles © Esri',
    maxZoom: 19,
    maxNativeZoom: 19,
  },
};

const state = {
  alerts: [],
  alertFilter: 'all',
  alertCache: {},
  forecast: [],
  aqiCurrent: [],
  aqiForecast: [],
  aqiCache: {},
  spcFeatures: [],
  spcProduct: 'cat', // cat | torn | wind | hail
  advisoryAlerts: [],
  soundEnabled: false,
  knownAlertIds: new Set(),
  countdown: CONFIG.refreshSec,
  tideChart: null,
  audioCtx: null,
  showAlertPoly: true,
  showSpc: false,
  wind: null,
  radarSource: 'rainviewer', // rainviewer | nexrad
  nexrad: {
    product: 'nexrad-n0q-900913',
    offsets: [50, 40, 30, 20, 10, 0],
    frameIndex: 5,
    playing: false,
    speed: 1400,
    timer: null,
  },
  rainViewer: {
    host: 'https://tilecache.rainviewer.com',
    frames: [], // {time, path}
    frameIndex: 0,
    loaded: false,
  },
};

let map, baseTileLayer, nexradTileLayer, hrrrTileLayer, owmTileLayer, rainViewerLayer;
const alertLayer = L.layerGroup();
const spcLayer = L.layerGroup();

function $(id){ return document.getElementById(id); }
function esc(s){
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtTime(iso){
  if(!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return String(iso); }
}
function setStatus(kind, text){
  const el = $('api-status');
  if(!el) return;
  el.className = 'status-pill' + (kind ? ' ' + kind : '');
  $('api-status-text').textContent = text;
}
function openModal(title, sub, body){
  $('modal-title').textContent = title;
  $('modal-sub').textContent = sub || '';
  $('modal-body').innerHTML = body;
  const bd = $('modal-backdrop');
  // Keep modal above Leaflet map panes (which use high z-index)
  bd.style.zIndex = '10000';
  document.body.appendChild(bd);
  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');
}
function closeModal(){
  const bd = $('modal-backdrop');
  bd.classList.remove('open');
  bd.setAttribute('aria-hidden', 'true');
  $('modal-body').innerHTML = '';
}

/* Audio tones */
function ensureAudio(){
  if(!state.audioCtx){
    try { state.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
  return state.audioCtx;
}
/** Alert chimes — synthesized in-browser (no audio files)
 *  SEVERE: alternating wail 880↔660 Hz, sawtooth
 *  LOCAL:  calm rising C5→G5, soft sine
 *  ALL PA: short flat double-beep 440 Hz, triangle
 */
function playTone(kind){
  if(!state.soundEnabled) return;
  const ctx = ensureAudio();
  if(!ctx) return;
  if(ctx.state === 'suspended') ctx.resume().catch(()=>{});
  const now = ctx.currentTime;

  if(kind === 'severe'){
    // Alternating wail 880 ↔ 660 Hz, sawtooth (edgiest)
    const steps = [880, 660, 880, 660, 880];
    steps.forEach((freq, i)=>{
      const t0 = now + i * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.13);
    });
    return;
  }

  if(kind === 'local'){
    // Calm rising two-note chime C5 (523.25) → G5 (783.99), soft sine
    const notes = [523.25, 783.99];
    notes.forEach((freq, i)=>{
      const t0 = now + i * 0.28;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.38);
    });
    return;
  }

  // ALL PA — short flat double-beep 440 Hz triangle (neutral)
  [0, 0.16].forEach((delay)=>{
    const t0 = now + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.11);
  });
}

/** Map an alert to SEVERE / LOCAL / ALL chime */
function classifyAlertTone(p){
  if(isSevereAlert(p)) return 'severe';
  if(isLocalAlert(p)) return 'local';
  return 'all';
}

/* Map */
function initMap(){
  map = L.map('leaflet-map', {
    center: [HOME_VIEW.lat, HOME_VIEW.lon],
    zoom: HOME_VIEW.zoom,
    minZoom: 3,
    maxZoom: 18,
    zoomControl: false,
  });
  setBasemap('streets');
  alertLayer.addTo(map);
  // RainViewer radar (no API key) — load frames + play loop
  ensureRainViewer()
    .then(()=> startNexradAnim())
    .catch(err=>{
      console.error('RainViewer failed, falling back to NEXRAD', err);
      state.radarSource = 'nexrad';
      showNexradFrame(state.nexrad.frameIndex);
      startNexradAnim();
    });
}

function setBasemap(key){
  const def = BASEMAPS[key] || BASEMAPS.streets;
  if(baseTileLayer) map.removeLayer(baseTileLayer);
  baseTileLayer = L.tileLayer(def.url, {
    maxZoom: def.maxZoom || 19,
    maxNativeZoom: def.maxNativeZoom || def.maxZoom || 19,
    attribution: def.attr,
    errorTileUrl: '',
  }).addTo(map);
  // Keep map within what the active basemap can show
  if(map.getZoom() > (def.maxZoom || 19)){
    map.setZoom(def.maxZoom || 19);
  }
  restack();
}

function restack(){
  // Order: basemap → NEXRAD → HRRR → SPC → alert polygons
  if(nexradTileLayer && map.hasLayer(nexradTileLayer)){
    map.removeLayer(nexradTileLayer);
    nexradTileLayer.addTo(map);
  }
  if(hrrrTileLayer && map.hasLayer(hrrrTileLayer)){
    map.removeLayer(hrrrTileLayer);
    hrrrTileLayer.addTo(map);
  }
  if(owmTileLayer && map.hasLayer(owmTileLayer)){
    map.removeLayer(owmTileLayer);
    owmTileLayer.addTo(map);
  }
  if(rainViewerLayer && map.hasLayer(rainViewerLayer)){
    map.removeLayer(rainViewerLayer);
    rainViewerLayer.addTo(map);
  }
  [spcLayer, alertLayer].forEach(ly=>{
    if(map.hasLayer(ly)){ ly.remove(); ly.addTo(map); }
  });
}

function setOwmPrecipLayer(on){
  if(!on){
    if(owmTileLayer){ try{ map.removeLayer(owmTileLayer); }catch(_){ } owmTileLayer = null; }
    return;
  }
  const key = CONFIG.openWeatherKey;
  if(!key){
    alert('Set CONFIG.openWeatherKey in app.js to enable OpenWeatherMap precipitation tiles.\n\nURL pattern:\nhttps://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=YOUR_KEY');
    const cb = $('layer-owm');
    if(cb) cb.checked = false;
    return;
  }
  const url = `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${key}`;
  if(owmTileLayer){
    owmTileLayer.setUrl(url);
  } else {
    owmTileLayer = L.tileLayer(url, {
      opacity: 0.55,
      maxZoom: 12,
      attribution: '© OpenWeatherMap',
    }).addTo(map);
  }
  restack();
}

async function loadRainViewerFrames(){
  const res = await fetch(RAINVIEWER_MAPS, { cache: 'no-cache' });
  if(!res.ok) throw new Error('RainViewer HTTP ' + res.status);
  const data = await res.json();
  const past = data?.radar?.past || [];
  const nowcast = data?.radar?.nowcast || [];
  state.rainViewer.host = data.host || 'https://tilecache.rainviewer.com';
  state.rainViewer.frames = past.concat(nowcast);
  state.rainViewer.frameIndex = Math.max(0, state.rainViewer.frames.length - 1);
  state.rainViewer.loaded = true;
  return state.rainViewer.frames;
}

function rainViewerTileUrl(frame){
  // Public API: {host}{path}/256/{z}/{x}/{y}/{color}/{options}.png
  // color 2 = universal, options 1_1 = smooth + snow
  const host = state.rainViewer.host;
  return `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
}

function showRainViewerFrame(index){
  const frames = state.rainViewer.frames;
  if(!frames.length) return;
  const i = ((index % frames.length) + frames.length) % frames.length;
  state.rainViewer.frameIndex = i;
  const frame = frames[i];
  const url = rainViewerTileUrl(frame);
  if(rainViewerLayer){
    rainViewerLayer.setUrl(url);
  } else {
    rainViewerLayer = L.tileLayer(url, {
      opacity: 0.65,
      maxZoom: 19,
      maxNativeZoom: 7,
      updateWhenIdle: true,
      attribution: 'Radar: RainViewer',
    }).addTo(map);
  }
  // Hide NEXRAD while RainViewer is active
  if(nexradTileLayer && map.hasLayer(nexradTileLayer)){
    try{ map.removeLayer(nexradTileLayer); }catch(_){}
  }
  restack();
  const el = $('nexrad-frame-label');
  if(el){
    const ageMin = Math.max(0, Math.round((Date.now()/1000 - frame.time) / 60));
    el.textContent = ageMin <= 2 ? 'RainViewer: live' : `RainViewer: −${ageMin} min`;
  }
}

async function ensureRainViewer(){
  if(!state.rainViewer.loaded || !state.rainViewer.frames.length){
    await loadRainViewerFrames();
  }
  showRainViewerFrame(state.rainViewer.frameIndex);
}

function clearRainViewer(){
  if(rainViewerLayer){
    try{ map.removeLayer(rainViewerLayer); }catch(_){}
    rainViewerLayer = null;
  }
}

function setHrrrLayer(on){
  const sel = $('hrrr-product');
  if(sel) sel.style.display = on ? '' : 'none';
  if(!on){
    if(hrrrTileLayer){
      try{ map.removeLayer(hrrrTileLayer); }catch(_){}
      hrrrTileLayer = null;
    }
    return;
  }
  const product = sel?.value || 'hrrr::REFC-F0000-0';
  const url = `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/${product}/{z}/{x}/{y}.png`;
  if(hrrrTileLayer){
    hrrrTileLayer.setUrl(url);
  } else {
    hrrrTileLayer = L.tileLayer(url, {
      opacity: 0.55,
      maxZoom: 19,
      maxNativeZoom: 7,
      updateWhenIdle: true,
      attribution: 'HRRR: NOAA / IEM',
    }).addTo(map);
  }
  restack();
}

function nexradUrl(product, offsetMin){
  let id = product;
  if(offsetMin && !product.startsWith('q2-')) id = `${product}-m${offsetMin}m`;
  return `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/${id}/{z}/{x}/{y}.png`;
}

function showNexradFrame(index){
  const anim = state.nexrad;
  anim.frameIndex = ((index % anim.offsets.length) + anim.offsets.length) % anim.offsets.length;
  const offset = anim.offsets[anim.frameIndex];
  const product = $('nexrad-product')?.value || anim.product;
  anim.product = product;
  const url = nexradUrl(product, offset);
  if(nexradTileLayer){
    nexradTileLayer.setUrl(url);
  } else {
    nexradTileLayer = L.tileLayer(url, {
      opacity: 0.7,
      maxZoom: 19,
      maxNativeZoom: 8,
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 2,
      attribution: 'Radar: IEM / NEXRAD',
    }).addTo(map);
  }
  restack();
  const el = $('nexrad-frame-label');
  if(el) el.textContent = offset === 0 ? 'Radar: live' : `Radar: −${offset} min`;
}

function startNexradAnim(){
  stopNexradAnim();
  state.nexrad.playing = true;
  $('nexrad-play')?.classList.add('active');
  $('nexrad-pause')?.classList.remove('active');
  const tick = ()=>{
    if(state.radarSource === 'rainviewer'){
      showRainViewerFrame(state.rainViewer.frameIndex + 1);
    } else {
      showNexradFrame(state.nexrad.frameIndex + 1);
    }
  };
  tick();
  state.nexrad.timer = setInterval(tick, state.nexrad.speed);
}
function stopNexradAnim(){
  state.nexrad.playing = false;
  if(state.nexrad.timer){ clearInterval(state.nexrad.timer); state.nexrad.timer = null; }
  $('nexrad-play')?.classList.remove('active');
  $('nexrad-pause')?.classList.add('active');
}

async function setRadarSource(src){
  state.radarSource = src;
  document.querySelectorAll('#radar-source-seg button').forEach(b=>{
    b.classList.toggle('active', b.dataset.radar === src);
  });
  const prod = $('nexrad-product');
  if(prod) prod.style.display = src === 'nexrad' ? '' : 'none';

  const wasPlaying = state.nexrad.playing;
  stopNexradAnim();

  if(src === 'rainviewer'){
    if(nexradTileLayer && map.hasLayer(nexradTileLayer)){
      try{ map.removeLayer(nexradTileLayer); }catch(_){}
    }
    await ensureRainViewer();
  } else {
    clearRainViewer();
    showNexradFrame(state.nexrad.frameIndex);
  }
  if(wasPlaying) startNexradAnim();
}

/* NWS Alerts — statewide PA via area=PA */
function isLocalAlert(p){
  const area = (p.areaDesc || '').toLowerCase();
  return /montgomery|philadelphia|chester|delaware|bucks|conshohocken|norristown|king of prussia|berks/.test(area);
}
function isSevereAlert(p){
  const event = (p.event || '').toLowerCase();
  const sev = (p.severity || '').toLowerCase();
  return sev === 'extreme' || sev === 'severe' ||
    /warning|tornado|flash flood|severe thunderstorm|winter storm/.test(event);
}
function matchesAlertFilter(p){
  if(state.alertFilter === 'local') return isLocalAlert(p);
  if(state.alertFilter === 'severe') return isSevereAlert(p);
  return true;
}

async function fetchAlerts(){
  try{
    // Statewide PA — reliable, smaller payload than national dump
    const res = await fetch('https://api.weather.gov/alerts/active?area=PA', {
      headers: {
        Accept: 'application/geo+json',
        'User-Agent': CONFIG.nwsUA,
      },
      cache: 'no-cache',
    });
    if(!res.ok) throw new Error('NWS HTTP ' + res.status);
    const data = await res.json();
    const features = data.features || [];

    const prev = state.knownAlertIds;
    if(prev.size > 0){
      const newcomers = features.filter(f=>{
        const id = f.properties?.id;
        return id && !prev.has(id) && matchesAlertFilter(f.properties || {});
      });
      if(newcomers.length){
        const rank = { info:0, watch:1, warning:2, extreme:3 };
        let best = 'info';
        newcomers.forEach(f=>{
          const k = classifyAlertTone(f.properties || {});
          if(rank[k] > rank[best]) best = k;
        });
        playTone(best);
      }
    }
    state.knownAlertIds = new Set(features.map(f => f.properties?.id).filter(Boolean));
    state.alerts = features;
    state.alertCache = {};
    features.forEach(f => { if(f.properties?.id) state.alertCache[f.properties.id] = f; });

    // Split: primary watches/warnings vs advisories/statements/outlooks
    const isAdvisory = (p)=>{
      const ev = (p.event || '').toLowerCase();
      const mt = (p.msgType || '').toLowerCase();
      return /advisory|statement|outlook|air quality|special weather|hazardous weather|beach|frost|freeze|wind chill|heat index/.test(ev)
        || mt === 'update' && /outlook|advisory/.test(ev);
    };
    state.advisoryAlerts = features.filter(f => isAdvisory(f.properties || {}));
    // Primary list excludes pure advisories/outlooks (still filterable)
    state.alertsPrimary = features.filter(f => !isAdvisory(f.properties || {}));

    renderAlerts();
    renderAdvisories();
    renderAlertPolygons();
  }catch(err){
    console.error('Alerts', err);
    $('alerts-list').innerHTML = `<div class="empty err">Alerts unreachable: ${esc(err.message)}</div>`;
  }
}

function renderAdvisories(){
  const list = state.advisoryAlerts || [];
  const badge = $('adv-badge');
  if(badge){
    badge.textContent = String(list.length);
    badge.classList.toggle('hot', list.length > 0);
  }
  const host = $('advisory-list');
  if(!host) return;
  if(!list.length){
    host.innerHTML = `<div class="empty ok">No active advisories / outlooks</div>`;
    return;
  }
  host.innerHTML = list.map(f=>{
    const p = f.properties || {};
    const tone = classifyAlertTone(p);
    const evClass = tone === 'severe' ? 'warning' : tone === 'local' ? 'watch' : '';
    return `<div class="card alert-card" data-alert-id="${esc(p.id || '')}">
      <div class="ev ${evClass}">${esc(p.event || 'Advisory')}</div>
      <div class="s">${esc(p.headline || p.areaDesc || '')}</div>
      <div class="meta">${esc((p.severity || '') + ' · ' + (p.urgency || ''))}</div>
    </div>`;
  }).join('');
  host.querySelectorAll('[data-alert-id]').forEach(el=>{
    el.addEventListener('click', ()=> openAlertModal(el.dataset.alertId));
  });
}

function renderAlerts(){
  const source = state.alertsPrimary && state.alertsPrimary.length ? state.alertsPrimary : state.alerts;
  const list = source.filter(f => matchesAlertFilter(f.properties || {}));
  $('stat-alerts').textContent = String(list.length);
  const badge = $('alerts-badge');
  badge.textContent = String(list.length);
  badge.classList.toggle('hot', list.length > 0);

  if(!list.length){
    $('alerts-list').innerHTML = `<div class="empty ok">No matching PA alerts</div>`;
    return;
  }
  $('alerts-list').innerHTML = list.map(f=>{
    const p = f.properties || {};
    const tone = classifyAlertTone(p);
    const sevClass = tone === 'severe' ? 'sev-warning' : tone === 'local' ? 'sev-watch' : '';
    const evClass = tone === 'severe' ? 'warning' : tone === 'local' ? 'watch' : '';
    return `<div class="card alert-card ${sevClass}" data-alert-id="${esc(p.id || '')}">
      <div class="ev ${evClass}">${esc(p.event || 'Alert')}</div>
      <div class="s">${esc(p.headline || p.areaDesc || '')}</div>
      <div class="meta">${esc((p.severity || '') + ' · ' + (p.urgency || ''))}</div>
    </div>`;
  }).join('');
  $('alerts-list').querySelectorAll('[data-alert-id]').forEach(el=>{
    el.addEventListener('click', ()=> openAlertModal(el.dataset.alertId));
  });
}

function openAlertModal(id){
  const f = state.alertCache[id];
  const p = f?.properties;
  if(!p) return;
  const tone = classifyAlertTone(p);
  const color = tone === 'severe' ? 'var(--red)' :
    tone === 'local' ? 'var(--amber)' : 'var(--cyan)';
  openModal(p.event || 'NWS Alert', `${p.severity || ''} · ${p.urgency || ''}`, `
    <span class="tag" style="background:${color}33;color:${color}">${esc(p.severity || '—')}</span>
    <span class="tag" style="background:var(--cyan-dim);color:var(--cyan)">${esc(p.msgType || p.status || '')}</span>
    <div class="block" style="font-weight:600">${esc(p.headline || '')}</div>
    <div class="meta-kv"><span class="k">Area</span><span class="v">${esc(p.areaDesc || '—')}</span></div>
    <div class="meta-kv"><span class="k">Onset</span><span class="v">${fmtTime(p.onset)}</span></div>
    <div class="meta-kv"><span class="k">Expires</span><span class="v">${fmtTime(p.expires)}</span></div>
    <div class="meta-kv"><span class="k">Sender</span><span class="v">${esc(p.senderName || '—')}</span></div>
    ${p.description ? `<div class="block">${esc(p.description)}</div>` : ''}
    ${p.instruction ? `<div class="block warn"><b>Actions</b>\n${esc(p.instruction)}</div>` : ''}
  `);
  // Zoom to alert geometry if present
  if(f.geometry && map){
    try{
      const layer = L.geoJSON(f);
      map.fitBounds(layer.getBounds().pad(0.2));
    }catch{}
  }
}

function renderAlertPolygons(){
  alertLayer.clearLayers();
  if(!state.showAlertPoly) return;
  state.alerts.forEach(f=>{
    if(!f.geometry) return;
    const p = f.properties || {};
    const tone = classifyAlertTone(p);
    const color = (tone === 'extreme' || tone === 'warning') ? '#ff4d5e' :
      tone === 'watch' ? '#ff8a3d' : '#4fd1c5';
    try{
      const layer = L.geoJSON(f, {
        style: { color, weight: 1.5, fillColor: color, fillOpacity: 0.12, opacity: 0.85 },
      });
      layer.bindTooltip(p.event || 'Alert', { sticky: true });
      layer.on('click', ()=> openAlertModal(p.id));
      layer.addTo(alertLayer);
    }catch{}
  });
}

/* SPC Day-1 categorical outlook */
const SPC_URLS = {
  cat:  'https://www.spc.noaa.gov/products/outlook/day1otlk_cat.lyr.geojson',
  torn: 'https://www.spc.noaa.gov/products/outlook/day1otlk_torn.lyr.geojson',
  wind: 'https://www.spc.noaa.gov/products/outlook/day1otlk_wind.lyr.geojson',
  hail: 'https://www.spc.noaa.gov/products/outlook/day1otlk_hail.lyr.geojson',
};

async function fetchSpc(){
  const prod = state.spcProduct || 'cat';
  const url = SPC_URLS[prod] || SPC_URLS.cat;
  try{
    const res = await fetch(url, {
      headers: { Accept: 'application/geo+json' },
      cache: 'no-cache',
    });
    if(!res.ok) throw new Error('SPC HTTP ' + res.status);
    const data = await res.json();
    state.spcFeatures = data.features || [];
    renderSpc();
    renderSpcList();
  }catch(err){
    console.error('SPC', err);
    const host = $('spc-list');
    if(host) host.innerHTML = `<div class="empty err">SPC unavailable</div>`;
  }
}

function renderSpcList(){
  const host = $('spc-list');
  const badge = $('spc-badge');
  if(!host) return;
  const feats = state.spcFeatures || [];
  if(badge) badge.textContent = String(feats.length);
  if(!feats.length){
    host.innerHTML = `<div class="empty ok">No SPC risk areas</div>`;
    return;
  }
  host.innerHTML = feats.map((f, i)=>{
    const p = f.properties || {};
    const fill = p.fill || '#55BB55';
    return `<div class="card" data-spc-idx="${i}" style="border-left:3px solid ${fill}">
      <div class="t" style="font-size:12px;font-weight:600;color:var(--text-hi)">${esc(p.LABEL2 || p.LABEL || 'Risk')}</div>
      <div class="s">${esc(p.LABEL || '')} · DN ${p.DN ?? '—'}</div>
      <div class="meta">Valid ${esc(p.VALID_ISO || p.VALID || '—')}</div>
    </div>`;
  }).join('');
  host.querySelectorAll('[data-spc-idx]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const f = state.spcFeatures[Number(el.dataset.spcIdx)];
      if(!f) return;
      const p = f.properties || {};
      openModal(p.LABEL2 || p.LABEL || 'SPC Day-1', p.FORECASTER || 'SPC', `
        <div class="meta-kv"><span class="k">Risk</span><span class="v">${esc(p.LABEL2 || p.LABEL || '')}</span></div>
        <div class="meta-kv"><span class="k">Label</span><span class="v">${esc(p.LABEL || '')}</span></div>
        <div class="meta-kv"><span class="k">DN</span><span class="v">${p.DN ?? '—'}</span></div>
        <div class="meta-kv"><span class="k">Issue</span><span class="v">${esc(p.ISSUE_ISO || p.ISSUE || '')}</span></div>
        <div class="meta-kv"><span class="k">Valid</span><span class="v">${esc(p.VALID_ISO || p.VALID || '')}</span></div>
        <div class="meta-kv"><span class="k">Expire</span><span class="v">${esc(p.EXPIRE_ISO || p.EXPIRE || '')}</span></div>
        <div class="meta-kv"><span class="k">Forecaster</span><span class="v">${esc(p.FORECASTER || '—')}</span></div>
      `);
      if(f.geometry && map){
        try{
          const layer = L.geoJSON(f);
          map.fitBounds(layer.getBounds().pad(0.15));
        }catch{}
      }
      // Preview on map when user opens a risk card
      if(!state.showSpc){
        state.showSpc = true;
        setSpcToggleUI(true);
        renderSpc();
      }
    });
  });
}

function renderSpc(){
  spcLayer.clearLayers();
  if(!state.showSpc){
    if(map.hasLayer(spcLayer)) map.removeLayer(spcLayer);
    return;
  }
  if(!map.hasLayer(spcLayer)) spcLayer.addTo(map);
  state.spcFeatures.forEach(f=>{
    const p = f.properties || {};
    const fill = p.fill || '#55BB55';
    const stroke = p.stroke || fill;
    try{
      const layer = L.geoJSON(f, {
        style: { color: stroke, weight: 1.5, fillColor: fill, fillOpacity: 0.22, opacity: 0.85 },
      });
      layer.bindTooltip(p.LABEL2 || p.LABEL || 'SPC', { sticky: true });
      layer.on('click', ()=>{
        openModal(p.LABEL2 || p.LABEL || 'SPC Day-1', p.FORECASTER || '', `
          <div class="meta-kv"><span class="k">Risk</span><span class="v">${esc(p.LABEL2 || p.LABEL || '')}</span></div>
          <div class="meta-kv"><span class="k">Issue</span><span class="v">${esc(p.ISSUE_ISO || p.ISSUE || '')}</span></div>
          <div class="meta-kv"><span class="k">Valid</span><span class="v">${esc(p.VALID_ISO || p.VALID || '')}</span></div>
          <div class="meta-kv"><span class="k">Expire</span><span class="v">${esc(p.EXPIRE_ISO || p.EXPIRE || '')}</span></div>
        `);
      });
      layer.addTo(spcLayer);
    }catch{}
  });
  restack();
  renderSpcList();
}

/* Forecast */
async function fetchForecast(){
  try{
    const pts = await fetch(`https://api.weather.gov/points/${CONFIG.lat},${CONFIG.lon}`, {
      headers: { Accept: 'application/geo+json', 'User-Agent': CONFIG.nwsUA },
    }).then(r => r.json());
    const url = pts.properties?.forecast;
    if(!url) throw new Error('No forecast URL');
    const data = await fetch(url, {
      headers: { Accept: 'application/geo+json', 'User-Agent': CONFIG.nwsUA },
    }).then(r => r.json());
    state.forecast = data.properties?.periods || [];
    renderForecast();
  }catch(err){
    console.error('Forecast', err);
    $('forecast-grid').innerHTML = `<div class="empty err">Forecast unavailable</div>`;
  }
}
function renderForecast(){
  const periods = state.forecast;
  if(!periods.length) return;
  const cur = periods[0];
  $('stat-temp').textContent = `${cur.temperature}°${cur.temperatureUnit || 'F'}`;
  $('current-obs').innerHTML = `
    <img src="${cur.icon}" alt="" />
    <div>
      <div class="t">${esc(cur.name)} · ${cur.temperature}°${cur.temperatureUnit || 'F'}</div>
      <div class="s">${esc(cur.shortForecast || '')} · Wind ${esc(cur.windSpeed || '—')} ${esc(cur.windDirection || '')}</div>
    </div>`;
  $('current-obs').onclick = ()=> openForecastModal(0);
  $('forecast-grid').innerHTML = periods.slice(0, 14).map((p, i)=>`
    <div class="fc-card" data-fc="${i}">
      <div class="name">${esc(p.name)}</div>
      <img src="${p.icon}" alt="" />
      <div class="temp ${p.isDaytime ? 'day' : 'night'}">${p.temperature}°</div>
      <div class="short">${esc(p.shortForecast || '')}</div>
    </div>`).join('');
  $('forecast-grid').querySelectorAll('[data-fc]').forEach(el=>{
    el.addEventListener('click', ()=> openForecastModal(Number(el.dataset.fc)));
  });
}
function openForecastModal(i){
  const p = state.forecast[i];
  if(!p) return;
  openModal(p.name, p.shortForecast || '', `
    <div style="text-align:center;margin-bottom:12px;">
      <img src="${p.icon}" width="72" height="72" style="border-radius:8px;" alt="" />
      <div style="font-family:var(--font-display);font-size:28px;font-weight:700;margin-top:6px;">${p.temperature}°${p.temperatureUnit || 'F'}</div>
      <div style="color:var(--amber);font-weight:600;margin-top:4px;">${esc(p.shortForecast || '')}</div>
    </div>
    <div class="meta-kv"><span class="k">Wind</span><span class="v">${esc(p.windSpeed || '—')} ${esc(p.windDirection || '')}</span></div>
    <div class="meta-kv"><span class="k">Precip</span><span class="v">${p.probabilityOfPrecipitation?.value != null ? p.probabilityOfPrecipitation.value + '%' : '—'}</span></div>
    <div class="block">${esc(p.detailedForecast || '')}</div>
  `);
}

/* AirNow */
function aqiProfile(aqi, catNum){
  if(catNum && AQI_CATEGORY[catNum]) return AQI_CATEGORY[catNum];
  if(aqi == null || aqi < 0) return AQI_CATEGORY[1];
  if(aqi <= 50) return AQI_CATEGORY[1];
  if(aqi <= 100) return AQI_CATEGORY[2];
  if(aqi <= 150) return AQI_CATEGORY[3];
  if(aqi <= 200) return AQI_CATEGORY[4];
  if(aqi <= 300) return AQI_CATEGORY[5];
  return AQI_CATEGORY[6];
}
async function fetchAQI(){
  const key = CONFIG.airNowKey;
  const zip = CONFIG.zip;
  try{
    const [cur, fc] = await Promise.all([
      fetch(`https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${zip}&distance=25&API_KEY=${key}`).then(r => r.json()),
      fetch(`https://www.airnowapi.org/aq/forecast/zipCode/?format=application/json&zipCode=${zip}&distance=25&API_KEY=${key}`).then(r => r.json()).catch(() => []),
    ]);
    state.aqiCurrent = Array.isArray(cur) ? cur : [];
    state.aqiForecast = Array.isArray(fc) ? fc : [];
    renderAQI();
  }catch(err){
    console.error('AQI', err);
    $('aqi-panel').innerHTML = `<div class="empty err">AirNow timeout</div>`;
  }
}
function renderAQI(){
  const data = state.aqiCurrent;
  state.aqiCache = {};
  if(!data.length){
    $('aqi-panel').innerHTML = `<div class="empty">No sensor data</div>`;
    $('stat-aqi').textContent = '—';
    return;
  }
  let worstCat = 0, worst = null;
  data.forEach(p=>{
    const n = p.Category?.Number || 0;
    if(n > worstCat){ worstCat = n; worst = p; }
  });
  if(worst) $('stat-aqi').textContent = String(worst.AQI);

  let html = '';
  if(worst && worstCat >= 3){
    const prof = aqiProfile(worst.AQI, worstCat);
    state.aqiCache.health = { title: `${prof.label} — ${worst.ParameterName}`, body: aqiDetail(worst, prof) };
    html += `<div class="banner bad" data-aqi="health"><b style="color:${prof.color}">${prof.label.toUpperCase()} · ${esc(worst.ParameterName)}</b>
      <div style="margin-top:3px;color:var(--text-mid)">${esc(prof.message)}</div></div>`;
  }
  const meta = data[0];
  html += `<div style="font-family:var(--font-display);font-size:10px;color:var(--text-dim);margin-bottom:8px;">
    ${esc(meta.ReportingArea || '')}, ${esc(meta.StateCode || '')} · ${esc(meta.DateObserved || '')}
  </div><div class="aqi-grid">`;
  data.forEach((p, idx)=>{
    const prof = aqiProfile(p.AQI, p.Category?.Number);
    const key = 'p' + idx;
    state.aqiCache[key] = { title: `${p.ParameterName} · ${prof.label}`, body: aqiDetail(p, prof) };
    html += `<div class="aqi-cell" data-aqi="${key}">
      <div class="p">${esc(p.ParameterName)}</div>
      <div class="v" style="color:${prof.color}">${p.AQI}</div>
      <div class="c" style="color:${prof.color}">${prof.label}</div>
    </div>`;
  });
  html += `</div>`;
  $('aqi-panel').innerHTML = html;
  $('aqi-panel').querySelectorAll('[data-aqi]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const d = state.aqiCache[el.dataset.aqi];
      if(d) openModal(d.title, 'AirNow · ' + CONFIG.zip, d.body);
    });
  });
}
function aqiDetail(p, prof){
  return `<span class="tag" style="background:${prof.color}33;color:${prof.color}">${prof.label}</span>
    <div class="meta-kv"><span class="k">Parameter</span><span class="v">${esc(p.ParameterName)}</span></div>
    <div class="meta-kv"><span class="k">AQI</span><span class="v" style="color:${prof.color}">${p.AQI}</span></div>
    <div class="meta-kv"><span class="k">Area</span><span class="v">${esc((p.ReportingArea||'')+', '+(p.StateCode||''))}</span></div>
    <div class="block">${esc(prof.message)}</div>`;
}

/* Wind — Open-Meteo (no API key) */
function degToCompass(deg){
  if(deg == null || Number.isNaN(Number(deg))) return '—';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(((Number(deg) % 360) / 22.5)) % 16];
}

async function fetchWind(){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=mph&forecast_days=1`;
  try{
    const res = await fetch(url, { cache: 'no-cache' });
    if(!res.ok) throw new Error('Open-Meteo HTTP ' + res.status);
    const data = await res.json();
    state.wind = data;
    renderWind();
    // Map marker for local wind
    updateWindMarker(data.current);
  }catch(err){
    console.error('Wind', err);
    const host = $('wind-panel');
    if(host) host.innerHTML = `<div class="empty err">Wind data unavailable</div>`;
  }
}

function renderWind(){
  const cur = state.wind?.current;
  const host = $('wind-panel');
  if(!cur || !host){
    if(host) host.innerHTML = `<div class="empty">No wind data</div>`;
    return;
  }
  const spd = cur.wind_speed_10m;
  const gst = cur.wind_gusts_10m;
  const dir = cur.wind_direction_10m;
  const compass = degToCompass(dir);
  $('stat-wind').textContent = spd != null ? `${Math.round(spd)}` : '—';

  host.innerHTML = `
    <div class="wind-card">
      <div class="wind-metric"><div class="v">${spd != null ? Math.round(spd) : '—'}<span style="font-size:11px;color:var(--text-dim)"> mph</span></div><div class="k">Speed</div></div>
      <div class="wind-metric"><div class="v">${gst != null ? Math.round(gst) : '—'}<span style="font-size:11px;color:var(--text-dim)"> mph</span></div><div class="k">Gusts</div></div>
    </div>
    <div class="wind-dir">
      <span class="wind-arrow" style="transform:rotate(${(dir ?? 0) + 180}deg)">↑</span>
      <span><b style="color:var(--text-hi)">${compass}</b> · ${dir != null ? Math.round(dir) + '°' : '—'}</span>
    </div>
    <p class="hint">10 m wind · Open-Meteo · ${esc(cur.time || '')}</p>`;
}

let windMarker = null;
function updateWindMarker(cur){
  if(!map || !cur) return;
  const spd = cur.wind_speed_10m;
  const dir = cur.wind_direction_10m;
  const compass = degToCompass(dir);
  const html = `<div style="background:rgba(11,15,22,.92);border:1px solid #2a3548;border-radius:8px;padding:6px 8px;color:#eef2f8;font:11px Inter,sans-serif;white-space:nowrap;">
    <div style="color:#4fd1c5;font-weight:700;">${spd != null ? Math.round(spd) : '—'} mph ${compass}</div>
    <div style="color:#8b96ab;font-size:10px;">Gust ${cur.wind_gusts_10m != null ? Math.round(cur.wind_gusts_10m) : '—'} · 19428</div>
  </div>`;
  if(windMarker){
    windMarker.setLatLng([CONFIG.lat, CONFIG.lon]);
    windMarker.setIcon(L.divIcon({ className: '', html, iconSize: [120, 40], iconAnchor: [60, 40] }));
  } else {
    windMarker = L.marker([CONFIG.lat, CONFIG.lon], {
      icon: L.divIcon({ className: '', html, iconSize: [120, 40], iconAnchor: [60, 40] }),
      interactive: false,
    }).addTo(map);
  }
}

/* USGS + NOAA */
function renderHydro(){
  $('hydro-list').innerHTML = SCHUYLKILL_GAUGES.map(g=>`
    <div class="gauge-row" data-gauge="${g.id}" data-name="${esc(g.name)}">
      <div><div class="name">${esc(g.name)}</div><div class="id">USGS ${g.id}</div></div>
      <span style="color:var(--cyan)">↗</span>
    </div>`).join('');
  $('hydro-list').querySelectorAll('[data-gauge]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const id = el.dataset.gauge;
      const embed = `https://dashboard.waterdata.usgs.gov/api/gwis/2.1/service/site?agencyCode=USGS&siteNumber=${id}&open=plots&banner=false&pad=false`;
      openModal(el.dataset.name, 'USGS ' + id, `<div class="iframe-wrap"><iframe src="${embed}" title="USGS ${id}"></iframe></div>`);
    });
  });
}

async function fetchTides(){
  const station = CONFIG.noaaStation;
  const base = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${station}&time_zone=lst_ldt&units=english&format=json&date=today`;
  try{
    const [wlMllw, wlNavd, preds, air] = await Promise.all([
      fetch(`${base}&product=water_level&datum=MLLW`).then(r => r.json()),
      fetch(`${base}&product=water_level&datum=NAVD`).then(r => r.json()),
      fetch(`${base}&product=predictions&datum=MLLW`).then(r => r.json()),
      fetch(`${base}&product=air_temperature`).then(r => r.json()),
    ]);
    const last = a => (a && a.length ? a[a.length - 1] : null);
    const m = last(wlMllw.data), n = last(wlNavd.data), a = last(air.data);
    $('tide-mllw').textContent = m ? m.v + ' ft' : '—';
    $('tide-navd').textContent = n ? n.v + ' ft' : '—';
    $('tide-air').textContent = a ? a.v + '°F' : '—';
    const labels = (wlMllw.data || []).map(d => ((d.t || '').split(' ')[1] || '').slice(0, 5));
    const obs = (wlMllw.data || []).map(d => parseFloat(d.v));
    const pred = (preds.predictions || []).map(d => parseFloat(d.v)).slice(0, labels.length);
    const ctx = $('tide-chart')?.getContext('2d');
    if(!ctx) return;
    if(state.tideChart) state.tideChart.destroy();
    Chart.defaults.color = '#8b96ab';
    Chart.defaults.font.family = "'JetBrains Mono', monospace";
    state.tideChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Observed MLLW', data: obs, borderColor: '#4fd1c5', backgroundColor: 'rgba(79,209,197,0.12)', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.35 },
          { label: 'Predicted MLLW', data: pred, borderColor: '#ff4d5e', borderDash: [4,4], borderWidth: 2, pointRadius: 0, fill: false, tension: 0.35 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 10 } } } },
        scales: {
          x: { ticks: { maxTicksLimit: 6, font: { size: 9 } }, grid: { color: '#1c2433' } },
          y: { grid: { color: '#1c2433' }, ticks: { font: { size: 9 } } },
        },
      },
    });
  }catch(err){
    console.error('Tides', err);
  }
}

/* Refresh */
async function softRefresh(){
  $('refresh-btn')?.classList.add('spinning');
  setStatus('warn', 'Syncing');
  try{
    await Promise.all([fetchAlerts(), fetchForecast(), fetchAQI(), fetchWind(), fetchTides(), fetchSpc()]);
    if(state.radarSource === 'rainviewer'){
      try{
        await loadRainViewerFrames();
        showRainViewerFrame(state.rainViewer.frameIndex);
      }catch(e){ console.warn(e); }
    } else if(nexradTileLayer){
      showNexradFrame(state.nexrad.frameIndex);
    }
    setStatus('ok', 'Live');
  }catch{
    setStatus('err', 'Partial');
  }finally{
    $('refresh-btn')?.classList.remove('spinning');
    state.countdown = CONFIG.refreshSec;
  }
}
function tickCountdown(){
  state.countdown -= 1;
  if(state.countdown <= 0){
    state.countdown = CONFIG.refreshSec;
    softRefresh();
  }
  const el = $('countdown');
  if(el) el.textContent = String(state.countdown);
}

function setAlertOverlayUI(on){
  state.showAlertPoly = !!on;
  $('alerts-on')?.classList.toggle('active', state.showAlertPoly);
  $('alerts-off')?.classList.toggle('active', !state.showAlertPoly);
}

function setSpcToggleUI(on){
  state.showSpc = !!on;
  $('spc-on')?.classList.toggle('active', state.showSpc);
  $('spc-off')?.classList.toggle('active', !state.showSpc);
}

function wire(){
  $('modal-close')?.addEventListener('click', closeModal);
  $('modal-backdrop')?.addEventListener('click', e=>{ if(e.target === $('modal-backdrop')) closeModal(); });
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape') closeModal(); });
  $('refresh-btn')?.addEventListener('click', softRefresh);
  $('sound-btn')?.addEventListener('click', ()=>{
    ensureAudio();
    state.soundEnabled = !state.soundEnabled;
    const btn = $('sound-btn');
    btn.textContent = state.soundEnabled ? '🔊' : '🔇';
    btn.classList.toggle('active', state.soundEnabled);
    if(state.soundEnabled) playTone('local');
  });
  $('alert-filter-seg')?.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-af]');
    if(!btn) return;
    document.querySelectorAll('#alert-filter-seg button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.alertFilter = btn.dataset.af;
    renderAlerts();
  });
  $('basemap-select')?.addEventListener('change', e=> setBasemap(e.target.value));
  $('nexrad-product')?.addEventListener('change', ()=> showNexradFrame(state.nexrad.frameIndex));
  $('nexrad-play')?.addEventListener('click', startNexradAnim);
  $('nexrad-pause')?.addEventListener('click', ()=>{
    stopNexradAnim();
    state.nexrad.frameIndex = state.nexrad.offsets.length - 1;
    showNexradFrame(state.nexrad.frameIndex);
  });
  $('spc-on')?.addEventListener('click', ()=>{
    setSpcToggleUI(true);
    if(!state.spcFeatures.length) fetchSpc();
    else renderSpc();
  });
  $('spc-off')?.addEventListener('click', ()=>{
    setSpcToggleUI(false);
    renderSpc();
  });
  $('spc-product-seg')?.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-spc]');
    if(!btn) return;
    document.querySelectorAll('#spc-product-seg button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.spcProduct = btn.dataset.spc;
    fetchSpc(); // loads data; map only shows if SPC On
  });
  $('map-recenter')?.addEventListener('click', ()=>{
    map.flyTo([HOME_VIEW.lat, HOME_VIEW.lon], HOME_VIEW.zoom, { duration: 0.7 });
  });
  $('map-reset')?.addEventListener('click', ()=>{
    map.flyTo([HOME_VIEW.lat, HOME_VIEW.lon], HOME_VIEW.zoom, { duration: 0.7 });
  });
  $('map-usa')?.addEventListener('click', ()=>{
    map.flyTo([USA_VIEW.lat, USA_VIEW.lon], USA_VIEW.zoom, { duration: 0.9 });
  });
  $('map-zoom-in')?.addEventListener('click', ()=> map.zoomIn());
  $('map-zoom-out')?.addEventListener('click', ()=> map.zoomOut());
  $('layer-hrrr')?.addEventListener('change', e=>{
    setHrrrLayer(e.target.checked);
  });
  $('radar-source-seg')?.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-radar]');
    if(!btn) return;
    setRadarSource(btn.dataset.radar);
  });
  $('hrrr-product')?.addEventListener('change', ()=>{
    if($('layer-hrrr')?.checked) setHrrrLayer(true);
  });
  $('alerts-on')?.addEventListener('click', ()=>{
    setAlertOverlayUI(true);
    renderAlertPolygons();
  });
  $('alerts-off')?.addEventListener('click', ()=>{
    setAlertOverlayUI(false);
    renderAlertPolygons();
  });
  
  document.addEventListener('click', ()=> ensureAudio(), { once: true });
}

async function init(){
  wire();
  initMap();
  renderHydro();
  state.showSpc = false;
  setStatus('warn', 'Connecting');
  await softRefresh();
  setInterval(tickCountdown, 1000);
}
init();
