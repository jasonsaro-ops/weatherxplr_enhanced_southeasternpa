/* WEATHERXPLR Enhanced — ZIP 19428 (Conshohocken, PA)
   Data: NWS alerts/forecast · AirNow AQI · USGS Schuylkill · NOAA tides · Windy
*/

const CONFIG = {
  zip: '19428',
  lat: 40.0759,
  lon: -75.2996,
  place: 'Conshohocken, PA',
  airNowKey: 'E5AFEF36-80F6-4A42-AE38-F3C56E3AEAC4',
  noaaStation: '8545240',
  refreshSec: 120,
  nwsUserAgent: 'WEATHERXPLR-Enhanced/1.0 (local dashboard; 19428)',
};

const SCHUYLKILL_GAUGES = [
  { id: '01472000', name: 'Schuylkill River at Reading, PA', lat: 40.3323, lon: -75.9324 },
  { id: '01473500', name: 'Schuylkill River at Pottstown, PA', lat: 40.2429, lon: -75.6605 },
  { id: '01474500', name: 'Schuylkill River at Norriton, PA', lat: 40.1118, lon: -75.3532 },
  { id: '01474703', name: 'Schuylkill River at Conshohocken, PA', lat: 40.0712, lon: -75.3093 },
  { id: '01474000', name: 'Schuylkill River at Philadelphia, PA (Fairmount Dam)', lat: 39.9676, lon: -75.1832 },
];

const AQI_CATEGORY = {
  1: { label: 'Good', color: '#00e400', message: 'Air quality is satisfactory; little or no risk.' },
  2: { label: 'Moderate', color: '#ffff00', message: 'Acceptable. Unusually sensitive people should limit prolonged outdoor exertion.' },
  3: { label: 'Unhealthy SG', color: '#ff7e00', message: 'Sensitive groups may experience health effects.' },
  4: { label: 'Unhealthy', color: '#ff0000', message: 'Everyone may begin to experience health effects.' },
  5: { label: 'Very Unhealthy', color: '#8f3f97', message: 'Health alert: everyone may experience more serious effects.' },
  6: { label: 'Hazardous', color: '#7e0023', message: 'Emergency conditions. Entire population is more likely to be affected.' },
};

const state = {
  alerts: [],
  alertFilter: 'all', // all | local | severe
  alertCache: {},
  forecast: [],
  aqiCurrent: [],
  aqiForecast: [],
  aqiCache: {},
  soundEnabled: false,
  knownAlertIds: new Set(),
  countdown: CONFIG.refreshSec,
  tideChart: null,
  audioCtx: null,
};

/* ---------- UI helpers ---------- */
function $(id){ return document.getElementById(id); }

function setStatus(kind, text){
  const el = $('api-status');
  if(!el) return;
  el.className = 'status-pill' + (kind ? ' ' + kind : '');
  $('api-status-text').textContent = text;
}

function openModal(title, sub, bodyHtml){
  $('modal-title').textContent = title;
  $('modal-sub').textContent = sub || '';
  $('modal-body').innerHTML = bodyHtml;
  $('modal-backdrop').classList.add('open');
  $('modal-backdrop').setAttribute('aria-hidden', 'false');
}

function closeModal(){
  $('modal-backdrop').classList.remove('open');
  $('modal-backdrop').setAttribute('aria-hidden', 'true');
  $('modal-body').innerHTML = '';
}

/* ---------- Alert tones (watch / warning / extreme) ---------- */
function ensureAudio(){
  if(!state.audioCtx){
    try{ state.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(_){ /* ignore */ }
  }
  return state.audioCtx;
}

function playTone(kind){
  if(!state.soundEnabled) return;
  const ctx = ensureAudio();
  if(!ctx) return;
  if(ctx.state === 'suspended') ctx.resume().catch(()=>{});

  // Distinct multi-tone schemes (kHz-ish bands)
  const schemes = {
    info:    { freqs: [660], dur: 0.12, gap: 0.08 },
    watch:   { freqs: [880, 660], dur: 0.14, gap: 0.1 },
    warning: { freqs: [1040, 780, 1040], dur: 0.12, gap: 0.08 },
    extreme: { freqs: [1240, 980, 1240], dur: 0.16, gap: 0.07 },
  };
  const sch = schemes[kind] || schemes.info;
  const now = ctx.currentTime;
  sch.freqs.forEach((freq, i)=>{
    const t0 = now + i * (sch.dur + sch.gap);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + sch.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + sch.dur + 0.02);
  });
}

function classifyAlertTone(props){
  const event = (props.event || '').toLowerCase();
  const sev = (props.severity || '').toLowerCase();
  const urgency = (props.urgency || '').toLowerCase();
  if(
    sev === 'extreme' ||
    urgency === 'immediate' ||
    (/warning/.test(event) && /tornado|flash flood|hurricane|tsunami|extreme/.test(event))
  ) return 'extreme';
  if(sev === 'severe' || /warning/.test(event)) return 'warning';
  if(/watch/.test(event) || sev === 'moderate') return 'watch';
  return 'info';
}

/* ---------- NWS Alerts ---------- */
function isLocalAlert(props){
  const area = (props.areaDesc || '').toLowerCase();
  // Montgomery County + nearby counties for 19428
  return /montgomery|philadelphia|chester|delaware|bucks|conshohocken|norristown|king of prussia/.test(area);
}

function isSevereAlert(props){
  const event = (props.event || '').toLowerCase();
  const sev = (props.severity || '').toLowerCase();
  return sev === 'extreme' || sev === 'severe' ||
    /warning|tornado|flash flood|severe thunderstorm|winter storm/.test(event);
}

function matchesAlertFilter(props){
  if(state.alertFilter === 'local') return isLocalAlert(props);
  if(state.alertFilter === 'severe') return isSevereAlert(props);
  return true;
}

async function fetchAlerts(){
  try{
    const res = await fetch('https://api.weather.gov/alerts/active', {
      headers: { Accept: 'application/geo+json', 'User-Agent': CONFIG.nwsUserAgent },
      cache: 'no-cache',
    });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const all = data.features || [];

    // Prefer PA, keep national severe that might affect region
    const pa = all.filter(f=>{
      const area = f.properties?.areaDesc || '';
      return /\bPA\b|Pennsylvania/i.test(area);
    });

    // New-alert tones
    const prev = state.knownAlertIds;
    if(prev.size > 0){
      const newcomers = pa.filter(f=>{
        const id = f.properties?.id;
        return id && !prev.has(id) && matchesAlertFilter(f.properties || {});
      });
      if(newcomers.length){
        const rank = { info: 0, watch: 1, warning: 2, extreme: 3 };
        let best = 'info';
        newcomers.forEach(f=>{
          const k = classifyAlertTone(f.properties || {});
          if(rank[k] > rank[best]) best = k;
        });
        playTone(best);
      }
    }
    state.knownAlertIds = new Set(pa.map(f => f.properties?.id).filter(Boolean));
    state.alerts = pa;
    state.alertCache = {};
    pa.forEach(f => { if(f.properties?.id) state.alertCache[f.properties.id] = f.properties; });
    renderAlerts();
  }catch(err){
    console.error('Alerts', err);
    $('alerts-list').innerHTML = `<div class="empty err">Alerts unreachable</div>`;
  }
}

function renderAlerts(){
  const list = state.alerts.filter(f => matchesAlertFilter(f.properties || {}));
  $('stat-alerts').textContent = String(list.length);
  const badge = $('alerts-badge');
  badge.textContent = String(list.length);
  badge.classList.toggle('hot', list.length > 0);

  if(!list.length){
    $('alerts-list').innerHTML = `<div class="empty ok">No matching active alerts</div>`;
    return;
  }

  $('alerts-list').innerHTML = list.map(f=>{
    const p = f.properties || {};
    const tone = classifyAlertTone(p);
    const sevClass = tone === 'extreme' || tone === 'warning' ? 'sev-warning' :
      tone === 'watch' ? 'sev-watch' : '';
    const id = p.id || '';
    return `
      <div class="card alert-card ${sevClass}" data-alert-id="${id}">
        <div class="ev ${tone}">${esc(p.event || 'Alert')}</div>
        <div class="s">${esc(p.headline || p.areaDesc || '')}</div>
        <div class="meta">${esc((p.severity || '') + ' · ' + (p.urgency || ''))}</div>
      </div>`;
  }).join('');

  $('alerts-list').querySelectorAll('[data-alert-id]').forEach(el=>{
    el.addEventListener('click', ()=> openAlertModal(el.dataset.alertId));
  });
}

function openAlertModal(id){
  const p = state.alertCache[id];
  if(!p) return;
  const tone = classifyAlertTone(p);
  const color = tone === 'extreme' || tone === 'warning' ? 'var(--red)' :
    tone === 'watch' ? 'var(--amber)' : 'var(--cyan)';
  openModal(p.event || 'NWS Alert', p.severity + ' · ' + (p.urgency || ''), `
    <span class="tag" style="background:${color}33;color:${color}">${esc(p.severity || '—')}</span>
    <span class="tag" style="background:var(--cyan-dim);color:var(--cyan)">${esc(p.msgType || p.status || '')}</span>
    <div class="block" style="font-weight:600;color:var(--text-hi)">${esc(p.headline || '')}</div>
    <div class="meta-kv"><span class="k">Area</span><span class="v">${esc(p.areaDesc || '—')}</span></div>
    <div class="meta-kv"><span class="k">Onset</span><span class="v">${fmtTime(p.onset)}</span></div>
    <div class="meta-kv"><span class="k">Expires</span><span class="v">${fmtTime(p.expires)}</span></div>
    <div class="meta-kv"><span class="k">Sender</span><span class="v">${esc(p.senderName || '—')}</span></div>
    ${p.description ? `<div class="block">${esc(p.description)}</div>` : ''}
    ${p.instruction ? `<div class="block warn"><b>Actions</b>\n${esc(p.instruction)}</div>` : ''}
  `);
}

/* ---------- NWS Forecast ---------- */
async function fetchForecast(){
  try{
    const pts = await fetch(
      `https://api.weather.gov/points/${CONFIG.lat},${CONFIG.lon}`,
      { headers: { Accept: 'application/geo+json', 'User-Agent': CONFIG.nwsUserAgent } }
    ).then(r => r.json());
    const forecastUrl = pts.properties?.forecast;
    if(!forecastUrl) throw new Error('No forecast URL');
    const data = await fetch(forecastUrl, {
      headers: { Accept: 'application/geo+json', 'User-Agent': CONFIG.nwsUserAgent },
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
  if(!periods.length){
    $('current-obs').innerHTML = `<div class="empty">No forecast data</div>`;
    return;
  }
  const cur = periods[0];
  $('stat-temp').textContent = `${cur.temperature}°${cur.temperatureUnit || 'F'}`;
  $('current-obs').innerHTML = `
    <img src="${cur.icon}" alt="" />
    <div>
      <div class="t" style="cursor:pointer;">${esc(cur.name)} · ${cur.temperature}°${cur.temperatureUnit || 'F'}</div>
      <div class="s">${esc(cur.shortForecast || '')} · Wind ${esc(cur.windSpeed || '—')} ${esc(cur.windDirection || '')}</div>
    </div>`;
  $('current-obs').style.cursor = 'pointer';
  $('current-obs').onclick = ()=> openForecastModal(0);

  $('forecast-grid').innerHTML = periods.slice(0, 14).map((p, i)=>`
    <div class="fc-card" data-fc="${i}">
      <div class="name">${esc(p.name)}</div>
      <img src="${p.icon}" alt="" />
      <div class="temp ${p.isDaytime ? 'day' : 'night'}">${p.temperature}°</div>
      <div class="short">${esc(p.shortForecast || '')}</div>
    </div>
  `).join('');

  $('forecast-grid').querySelectorAll('[data-fc]').forEach(el=>{
    el.addEventListener('click', ()=> openForecastModal(Number(el.dataset.fc)));
  });
}

function openForecastModal(index){
  const p = state.forecast[index];
  if(!p) return;
  openModal(p.name, p.shortForecast || '', `
    <div style="text-align:center;margin-bottom:12px;">
      <img src="${p.icon}" width="72" height="72" style="border-radius:8px;" alt="" />
      <div style="font-family:var(--font-display);font-size:28px;font-weight:700;margin-top:6px;">
        ${p.temperature}°${p.temperatureUnit || 'F'}
      </div>
      <div style="color:var(--amber);font-weight:600;margin-top:4px;">${esc(p.shortForecast || '')}</div>
    </div>
    <div class="meta-kv"><span class="k">Wind</span><span class="v">${esc(p.windSpeed || '—')} ${esc(p.windDirection || '')}</span></div>
    <div class="meta-kv"><span class="k">Precip</span><span class="v">${p.probabilityOfPrecipitation?.value != null ? p.probabilityOfPrecipitation.value + '%' : '—'}</span></div>
    <div class="meta-kv"><span class="k">Humidity</span><span class="v">${p.relativeHumidity?.value != null ? p.relativeHumidity.value + '%' : '—'}</span></div>
    <div class="block">${esc(p.detailedForecast || '')}</div>
  `);
}

/* ---------- AirNow AQI ---------- */
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
  const zip = CONFIG.zip;
  const key = CONFIG.airNowKey;
  const currentUrl = `https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${zip}&distance=25&API_KEY=${key}`;
  const forecastUrl = `https://www.airnowapi.org/aq/forecast/zipCode/?format=application/json&zipCode=${zip}&distance=25&API_KEY=${key}`;
  try{
    const [cur, fc] = await Promise.all([
      fetch(currentUrl).then(r => r.json()),
      fetch(forecastUrl).then(r => r.json()).catch(() => []),
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
    state.aqiCache.health = { title: `${prof.label} — ${worst.ParameterName}`, body: aqiDetailHtml(worst, prof) };
    html += `<div class="banner bad" data-aqi="health">
      <b style="color:${prof.color}">${prof.label.toUpperCase()} · ${esc(worst.ParameterName)}</b>
      <div style="margin-top:3px;color:var(--text-mid)">${esc(prof.message)}</div>
    </div>`;
  }

  const actionDay = state.aqiForecast.find(f => f.ActionDay);
  if(actionDay){
    const disc = actionDay.Discussion || 'Air Quality Action Day declared.';
    state.aqiCache.actionday = {
      title: 'Air Quality Action Day',
      body: `<div class="block">${esc(disc)}</div>
        <div class="meta-kv"><span class="k">Date</span><span class="v">${esc(actionDay.DateForecast || '')}</span></div>
        <div class="meta-kv"><span class="k">Area</span><span class="v">${esc((actionDay.ReportingArea || '') + ' ' + (actionDay.StateCode || ''))}</span></div>`,
    };
    html += `<div class="banner" data-aqi="actionday">
      <b style="color:var(--amber)">AIR QUALITY ACTION DAY</b>
      <div style="margin-top:3px;color:var(--text-mid)">${esc(disc.slice(0, 140))}${disc.length > 140 ? '…' : ''}</div>
    </div>`;
  }

  const meta = data[0];
  html += `<div class="meta" style="font-family:var(--font-display);font-size:10px;color:var(--text-dim);margin-bottom:8px;">
    ${esc(meta.ReportingArea || '')}, ${esc(meta.StateCode || '')} · ${esc(meta.DateObserved || '')} ${meta.HourObserved != null ? meta.HourObserved + ':00' : ''}
  </div>`;

  html += `<div class="aqi-grid">`;
  data.forEach((p, idx)=>{
    const cat = p.Category?.Number;
    const prof = aqiProfile(p.AQI, cat);
    const key = 'p' + idx;
    state.aqiCache[key] = { title: `${p.ParameterName} · ${prof.label}`, body: aqiDetailHtml(p, prof) };
    html += `<div class="aqi-cell" data-aqi="${key}">
      <div class="p">${esc(p.ParameterName)}</div>
      <div class="v" style="color:${prof.color}">${p.AQI}</div>
      <div class="c" style="color:${prof.color}">${prof.label}</div>
    </div>`;
  });
  html += `</div>`;

  if(state.aqiForecast.length){
    html += `<div style="margin-top:10px;font-family:var(--font-display);font-size:9.5px;color:var(--text-dim);letter-spacing:.5px;text-transform:uppercase;">Forecast</div>
      <div class="aqi-grid" style="margin-top:6px;">`;
    state.aqiForecast.slice(0, 6).forEach((f, i)=>{
      if(!f.ParameterName) return;
      const prof = aqiProfile(f.AQI, f.Category?.Number);
      const key = 'f' + i;
      state.aqiCache[key] = {
        title: `${f.ParameterName} forecast`,
        body: `<div class="meta-kv"><span class="k">Date</span><span class="v">${esc(f.DateForecast || '')}</span></div>
          <div class="meta-kv"><span class="k">AQI</span><span class="v" style="color:${prof.color}">${f.AQI !== -1 ? f.AQI : '—'}</span></div>
          <div class="meta-kv"><span class="k">Category</span><span class="v">${prof.label}</span></div>
          <div class="meta-kv"><span class="k">Action day</span><span class="v">${f.ActionDay ? 'Yes' : 'No'}</span></div>
          ${f.Discussion ? `<div class="block">${esc(f.Discussion)}</div>` : `<div class="block">${esc(prof.message)}</div>`}`,
      };
      html += `<div class="aqi-cell" data-aqi="${key}">
        <div class="p">${esc((f.DateForecast || '').slice(5))} · ${esc(f.ParameterName)}</div>
        <div class="v" style="color:${prof.color};font-size:18px;">${f.AQI !== -1 ? f.AQI : '—'}</div>
        <div class="c" style="color:${prof.color}">${prof.label}</div>
      </div>`;
    });
    html += `</div>`;
  }

  $('aqi-panel').innerHTML = html;
  $('aqi-panel').querySelectorAll('[data-aqi]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const d = state.aqiCache[el.dataset.aqi];
      if(d) openModal(d.title, 'AirNow · ' + CONFIG.zip, d.body);
    });
  });
}

function aqiDetailHtml(p, prof){
  return `
    <span class="tag" style="background:${prof.color}33;color:${prof.color}">${prof.label}</span>
    <div class="meta-kv"><span class="k">Parameter</span><span class="v">${esc(p.ParameterName)}</span></div>
    <div class="meta-kv"><span class="k">AQI</span><span class="v" style="color:${prof.color}">${p.AQI}</span></div>
    <div class="meta-kv"><span class="k">Area</span><span class="v">${esc((p.ReportingArea || '') + ', ' + (p.StateCode || ''))}</span></div>
    <div class="meta-kv"><span class="k">Observed</span><span class="v">${esc(p.DateObserved || '')} ${p.HourObserved != null ? p.HourObserved + ':00' : ''} ${esc(p.LocalTimeZone || '')}</span></div>
    <div class="block">${esc(prof.message)}</div>`;
}

/* ---------- USGS hydrology ---------- */
function renderHydro(){
  $('hydro-list').innerHTML = SCHUYLKILL_GAUGES.map(g=>`
    <div class="gauge-row" data-gauge="${g.id}" data-name="${esc(g.name)}">
      <div>
        <div class="name">${esc(g.name)}</div>
        <div class="id">USGS ${g.id}</div>
      </div>
      <span style="color:var(--cyan);font-size:12px;">↗</span>
    </div>
  `).join('');

  $('hydro-list').querySelectorAll('[data-gauge]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const id = el.dataset.gauge;
      const name = el.dataset.name;
      const embed = `https://dashboard.waterdata.usgs.gov/api/gwis/2.1/service/site?agencyCode=USGS&siteNumber=${id}&open=plots&banner=false&pad=false`;
      openModal(name, 'USGS ' + id, `
        <div class="iframe-wrap"><iframe src="${embed}" title="USGS gauge ${id}"></iframe></div>
        <p class="hint" style="margin-top:8px;">Live USGS National Water Dashboard embed for site ${id}.</p>
      `);
    });
  });
}

/* ---------- NOAA Tides ---------- */
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

    const last = arr => (arr && arr.length ? arr[arr.length - 1] : null);
    const m = last(wlMllw.data);
    const n = last(wlNavd.data);
    const a = last(air.data);
    $('tide-mllw').textContent = m ? m.v + ' ft' : '—';
    $('tide-navd').textContent = n ? n.v + ' ft' : '—';
    $('tide-air').textContent = a ? a.v + '°F' : '—';

    const labels = (wlMllw.data || []).map(d => {
      const t = (d.t || '').split(' ')[1] || '';
      return t.slice(0, 5);
    });
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
          {
            label: 'Observed MLLW (ft)',
            data: obs,
            borderColor: '#4fd1c5',
            backgroundColor: 'rgba(79,209,197,0.12)',
            borderWidth: 2, pointRadius: 0, fill: true, tension: 0.35,
          },
          {
            label: 'Predicted MLLW (ft)',
            data: pred,
            borderColor: '#ff4d5e',
            borderDash: [4, 4],
            borderWidth: 2, pointRadius: 0, fill: false, tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
    $('tide-mllw').textContent = '—';
  }
}

/* ---------- Windy ---------- */
function windyUrl(overlay){
  const product = (overlay === 'radar' || overlay === 'satellite') ? overlay : 'gfs';
  return `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=f&metricWind=mph&zoom=9&overlay=${overlay}&product=${product}&level=surface&lat=${CONFIG.lat}&lon=${CONFIG.lon}`;
}

function setWindyLayer(layer){
  $('windy-frame').src = windyUrl(layer);
}

/* ---------- Refresh cycle ---------- */
async function softRefresh(){
  $('refresh-btn')?.classList.add('spinning');
  setStatus('warn', 'Syncing');
  try{
    await Promise.all([
      fetchAlerts(),
      fetchForecast(),
      fetchAQI(),
      fetchTides(),
    ]);
    setStatus('ok', 'Live');
  }catch(e){
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

/* ---------- Utils ---------- */
function esc(s){
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function fmtTime(iso){
  if(!iso) return '—';
  try{ return new Date(iso).toLocaleString(); }catch(_){ return String(iso); }
}

/* ---------- Wire UI ---------- */
function wire(){
  $('modal-close')?.addEventListener('click', closeModal);
  $('modal-backdrop')?.addEventListener('click', e=>{
    if(e.target === $('modal-backdrop')) closeModal();
  });
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape') closeModal(); });

  $('refresh-btn')?.addEventListener('click', softRefresh);

  $('sound-btn')?.addEventListener('click', ()=>{
    ensureAudio();
    state.soundEnabled = !state.soundEnabled;
    const btn = $('sound-btn');
    btn.textContent = state.soundEnabled ? '🔊' : '🔇';
    btn.classList.toggle('active', state.soundEnabled);
    if(state.soundEnabled) playTone('watch');
  });

  $('alert-filter-seg')?.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-af]');
    if(!btn) return;
    document.querySelectorAll('#alert-filter-seg button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.alertFilter = btn.dataset.af;
    renderAlerts();
  });

  $('windy-layer')?.addEventListener('change', e=> setWindyLayer(e.target.value));
  $('windy-reset')?.addEventListener('click', ()=>{
    setWindyLayer($('windy-layer').value || 'clouds');
  });

  // Unlock audio context on first gesture
  document.addEventListener('click', ()=> ensureAudio(), { once: true });
}

/* ---------- Boot ---------- */
async function init(){
  wire();
  renderHydro();
  setStatus('warn', 'Connecting');
  await softRefresh();
  setInterval(tickCountdown, 1000);
}

init();
