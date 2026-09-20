/**
 * WEATHERXPLR ENHANCED — Southeastern Pennsylvania Command Array
 * CAVE-inspired multi-pane weather operations center.
 * Real-time NWS / AirNow / USGS / NOAA Tides feeds · 120s cycle · Multi-tone alerting
 * Alert tones adapted from montcoxplr Web Audio system.
 */

// ---------------------------------------------------------------------------
// LOCAL CONFIG
// ---------------------------------------------------------------------------
const localLat = 40.0759;
const localLon = -75.2996;
const localZip = "19428";
const AIRNOW_API_KEY = "E5AFEF36-80F6-4A42-AE38-F3C56E3AEAC4";

const schuylkillGauges = [
    { id: "01472000", name: "Schuylkill River at Reading, PA", lat: 40.3323, lon: -75.9324, noaaId: "RDGP1" },
    { id: "01473500", name: "Schuylkill River at Pottstown, PA", lat: 40.2429, lon: -75.6605, noaaId: "PTTP1" },
    { id: "01474500", name: "Schuylkill River at Norriton, PA", lat: 40.1118, lon: -75.3532, noaaId: "NSRP1" },
    { id: "01474703", name: "Schuylkill River at Conshohocken, PA", lat: 40.0712, lon: -75.3093, noaaId: "CSHP1" },
    { id: "01474000", name: "Schuylkill River at Philadelphia, PA (Fairmount Dam)", lat: 39.9676, lon: -75.1832, noaaId: "PADP1" }
];

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------
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
let lastSyncTime = null;
let feedStatus = { nws: true, aqi: true, hydro: true, tides: true, obs: true };

// ---------------------------------------------------------------------------
// AUDIO — Multi-tone system ported from montcoxplr
// Extreme/Severe → Fire wail | Moderate → EMS chime | Minor/Advisory → Traffic beep
// ---------------------------------------------------------------------------
let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
}

function scheduleTone(freq, startTime, duration, waveType, peakGain) {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = waveType;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
}

/** Extreme / critical warnings — urgent alternating two-tone wail */
function playExtremeTone() {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    [880, 660, 880, 660, 880, 660].forEach((freq, i) => {
        scheduleTone(freq, now + i * 0.14, 0.13, "sawtooth", 0.22);
    });
}

/** Severe / moderate warnings — rising two-note EMS-style chime */
function playSevereTone() {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    scheduleTone(523.25, now, 0.32, "sine", 0.2);       // C5
    scheduleTone(784.0, now + 0.28, 0.4, "sine", 0.2);    // G5
}

/** Advisories / minor — short neutral double-beep */
function playAdvisoryTone() {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    scheduleTone(440, now, 0.1, "triangle", 0.2);
    scheduleTone(440, now + 0.17, 0.1, "triangle", 0.2);
}

const SEVERITY_TONES = {
    extreme: playExtremeTone,
    severe: playSevereTone,
    moderate: playSevereTone,
    minor: playAdvisoryTone,
    unknown: playAdvisoryTone
};

function playAlertsForSeverities(sevSet) {
    let delay = 0;
    ["extreme", "severe", "moderate", "minor", "unknown"].forEach((sev) => {
        if (!sevSet.has(sev)) return;
        setTimeout(() => SEVERITY_TONES[sev](), delay);
        delay += 900;
    });
}

function initAudioToggle() {
    const btn = document.getElementById("audio-toggle-btn");
    if (!btn) return;
    let stored = null;
    try { stored = localStorage.getItem("weatherxplr_audio_enabled"); } catch (e) { /* ignore */ }
    audioEnabled = stored === "true";
    updateAudioToggleUI();
    btn.addEventListener("click", () => {
        audioEnabled = !audioEnabled;
        try { localStorage.setItem("weatherxplr_audio_enabled", String(audioEnabled)); } catch (e) { /* ignore */ }
        if (audioEnabled) {
            getAudioCtx();
            playAdvisoryTone();
        }
        updateAudioToggleUI();
    });
}

function updateAudioToggleUI() {
    const btn = document.getElementById("audio-toggle-btn");
    const lbl = document.getElementById("lbl-audio");
    const icon = document.getElementById("audio-icon");
    if (!btn || !lbl) return;
    if (audioEnabled) {
        btn.classList.remove("audio-off");
        btn.classList.add("audio-on");
        lbl.textContent = "TONES ON";
        if (icon) icon.className = "fa-solid fa-volume-high";
    } else {
        btn.classList.remove("audio-on");
        btn.classList.add("audio-off");
        lbl.textContent = "TONES OFF";
        if (icon) icon.className = "fa-solid fa-volume-xmark";
    }
}

// ---------------------------------------------------------------------------
// LAYOUT (CAVE-style dense multi-pane)
// ---------------------------------------------------------------------------
const config = {
    settings: {
        hasHeaders: true,
        reorderEnabled: true,
        showPopoutIcon: false,
        showMaximiseIcon: true,
        showCloseIcon: false
    },
    content: [{
        type: "row",
        content: [
            {
                type: "column",
                width: 38,
                content: [
                    { type: "component", componentName: "radarMap", title: "RADAR / MULTI-LAYER ARRAY" },
                    {
                        type: "stack",
                        height: 42,
                        content: [
                            { type: "component", componentName: "localForecast", title: "7-DAY SYNOPTIC OUTLOOK" },
                            { type: "component", componentName: "hourlyForecast", title: "HOURLY FORECAST" }
                        ]
                    }
                ]
            },
            {
                type: "column",
                width: 32,
                content: [
                    { type: "component", componentName: "nwsAlerts", title: "NWS HAZARD MATRIX — PENNSYLVANIA" },
                    {
                        type: "stack",
                        height: 38,
                        content: [
                            { type: "component", componentName: "currentObs", title: "SURFACE OBSERVATIONS" },
                            { type: "component", componentName: "nwsDiscussion", title: "NWS AREA DISCUSSION" }
                        ]
                    }
                ]
            },
            {
                type: "column",
                width: 30,
                content: [
                    { type: "component", componentName: "cloudMap", title: "SATELLITE / CLOUD LAYERS" },
                    {
                        type: "stack",
                        height: 55,
                        content: [
                            { type: "component", componentName: "airQualityPanel", title: "AIR QUALITY MATRIX" },
                            { type: "component", componentName: "hydrologyFeed", title: "SCHUYLKILL HYDROLOGY" },
                            { type: "component", componentName: "noaaTides", title: "NOAA TIDES 8545240" },
                            { type: "component", componentName: "systemTelemetry", title: "SYSTEM TELEMETRY" }
                        ]
                    }
                ]
            }
        ]
    }]
};

const layout = new GoldenLayout(config, "#desktopLayoutContainer");

// ---------------------------------------------------------------------------
// COMPONENT REGISTRATIONS
// ---------------------------------------------------------------------------
layout.registerComponent("radarMap", function (container) {
    container.getElement().html(`
        <div style="position:relative; width:100%; height:100%; background:#0a0e14;">
            <div style="position:absolute; top:10px; right:10px; z-index:999;">
                <select id="windyLayerSelect" class="layer-select">
                    <option value="radar">Weather Radar</option>
                    <option value="satellite">Satellite</option>
                    <option value="wind">Wind</option>
                    <option value="rain">Rain</option>
                    <option value="thunder">Thunderstorms</option>
                    <option value="temp">Temperature</option>
                    <option value="clouds">Clouds</option>
                    <option value="waves">Waves</option>
                    <option value="thermals">Thermals</option>
                    <option value="cape">CAPE Index</option>
                </select>
            </div>
            <iframe id="windyIframe" src="https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=f&metricWind=mph&zoom=8&overlay=radar&product=radar&level=surface&lat=${localLat}&lon=${localLon}" style="width:100%; height:100%; border:none;"></iframe>
        </div>
    `);
    setTimeout(() => {
        const select = container.getElement().find("#windyLayerSelect");
        const iframe = container.getElement().find("#windyIframe")[0];
        select.on("change", function () {
            const layer = this.value;
            const product = (layer === "radar" || layer === "satellite") ? layer : "gfs";
            iframe.src = `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=f&metricWind=mph&zoom=8&overlay=${layer}&product=${product}&level=surface&lat=${localLat}&lon=${localLon}`;
        });
    }, 200);
});

layout.registerComponent("cloudMap", function (container) {
    container.getElement().html(`
        <div style="position:relative; width:100%; height:100%; background:#0a0e14;">
            <div style="position:absolute; top:10px; right:10px; z-index:999;">
                <select id="windyCloudLayerSelect" class="layer-select">
                    <option value="radar">Weather Radar</option>
                    <option value="satellite">Satellite</option>
                    <option value="wind">Wind</option>
                    <option value="rain">Rain</option>
                    <option value="thunder">Thunderstorms</option>
                    <option value="temp">Temperature</option>
                    <option value="clouds" selected>Clouds</option>
                    <option value="highclouds">High Clouds</option>
                    <option value="mediumclouds">Medium Clouds</option>
                    <option value="lowclouds">Low Clouds</option>
                    <option value="fog">Fog</option>
                    <option value="cloudtop">Cloud Tops</option>
                    <option value="cloudbase">Cloud Base</option>
                    <option value="waves">Waves</option>
                    <option value="thermals">Thermals</option>
                    <option value="cape">CAPE Index</option>
                </select>
            </div>
            <iframe id="windyCloudIframe" src="https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=f&metricWind=mph&zoom=8&overlay=clouds&product=gfs&level=surface&lat=${localLat}&lon=${localLon}" style="width:100%; height:100%; border:none;"></iframe>
        </div>
    `);
    setTimeout(() => {
        const select = container.getElement().find("#windyCloudLayerSelect");
        const iframe = container.getElement().find("#windyCloudIframe")[0];
        select.on("change", function () {
            const layer = this.value;
            const product = (layer === "radar" || layer === "satellite") ? layer : "gfs";
            iframe.src = `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=f&metricWind=mph&zoom=8&overlay=${layer}&product=${product}&level=surface&lat=${localLat}&lon=${localLon}`;
        });
    }, 200);
});

layout.registerComponent("localForecast", function (container) {
    container.getElement().html(`<div class="weather-component" id="forecast-container">Connecting to synoptic timeline grids...</div>`);
    container.on("open", fetchNWSForecast);
});

layout.registerComponent("hourlyForecast", function (container) {
    container.getElement().html(`<div class="weather-component" id="hourly-container">Loading hourly forecast stream...</div>`);
    container.on("open", fetchHourlyForecast);
});

layout.registerComponent("nwsAlerts", function (container) {
    container.getElement().html(`
        <div class="weather-component" style="position:relative;">
            <div class="panel-header">
                <span><i class="fa-solid fa-triangle-exclamation"></i> ACTIVE NWS ALERTS</span>
                <span id="alert-panel-count" style="color:var(--text-dim); font-weight:400;"></span>
            </div>
            <div id="alerts-container">Scanning NWS alert network...</div>
        </div>`);
    container.on("open", fetchPennsylvaniaAlerts);
});

layout.registerComponent("currentObs", function (container) {
    container.getElement().html(`<div class="weather-component" id="obs-container">Interrogating surface observation stations...</div>`);
    container.on("open", fetchCurrentObservations);
});

layout.registerComponent("nwsDiscussion", function (container) {
    container.getElement().html(`<div class="weather-component" id="discussion-container">Retrieving PHI Area Forecast Discussion...</div>`);
    container.on("open", fetchNWSDiscussion);
});

layout.registerComponent("airQualityPanel", function (container) {
    container.getElement().html(`<div class="weather-component" id="aqi-container-target">Interrogating AirNow sensor frames...</div>`);
    container.on("open", fetchAirQualityData);
});

layout.registerComponent("noaaTides", function (container) {
    container.getElement().html(`
        <div class="weather-component" style="display:flex; flex-direction:column; gap:8px;">
            <div id="noaa-gauges" class="aqi-panel-wrap">
                <span style="color:var(--text-dim); font-size:0.75rem;"><i class="fa-solid fa-satellite-dish"></i> Contacting NOAA sensors...</span>
            </div>
            <div style="flex-grow:1; min-height:160px; position:relative; background:#161b22; border:1px solid #30363d; border-radius:3px; padding:8px;">
                <canvas id="noaaChart"></canvas>
            </div>
        </div>
    `);
    container.on("open", fetchNOAATides);
});

layout.registerComponent("hydrologyFeed", function (container) {
    container.getElement().html(`<div class="weather-component" id="hydro-river-list">Interrogating USGS stream vectors...</div>`);
    container.on("open", fetchSchuylkillHydrology);
});

layout.registerComponent("systemTelemetry", function (container) {
    container.getElement().html(`
        <div class="weather-component" id="telemetry-container">
            <div class="panel-header"><i class="fa-solid fa-microchip"></i> COMMAND ARRAY TELEMETRY</div>
            <div class="telemetry-grid" id="telemetry-grid">
                <div class="telemetry-cell"><div class="t-val" id="t-cycle">120</div><div class="t-label">Cycle (s)</div></div>
                <div class="telemetry-cell"><div class="t-val" id="t-alerts">0</div><div class="t-label">Active Alerts</div></div>
                <div class="telemetry-cell"><div class="t-val" id="t-feeds">5/5</div><div class="t-label">Feeds OK</div></div>
                <div class="telemetry-cell"><div class="t-val" id="t-audio">OFF</div><div class="t-label">Alert Tones</div></div>
            </div>
            <div style="margin-top:12px; font-size:0.7rem; color:var(--text-dim); line-height:1.6;">
                <div><strong style="color:var(--cyan);">FOCUS POINT</strong> 40.0759°N / 75.2996°W</div>
                <div><strong style="color:var(--cyan);">CWA</strong> Philadelphia (PHI)</div>
                <div><strong style="color:var(--cyan);">ZONE</strong> Montgomery / SE PA</div>
                <div style="margin-top:8px; color:var(--amber);">2-MINUTE REAL-TIME REFRESH CYCLE</div>
                <div style="margin-top:6px;">Multi-tone alerting: Extreme → wail · Severe → chime · Advisory → beep</div>
            </div>
        </div>
    `);
    container.on("open", updateTelemetryPanel);
});

layout.init();

// ---------------------------------------------------------------------------
// CLOCK & STATUS
// ---------------------------------------------------------------------------
function updateMissionClock() {
    const now = new Date();
    const utc = now.toISOString().substr(11, 8) + "Z";
    const local = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const el = document.getElementById("mission-clock");
    if (el) el.textContent = `${local} L  ·  ${utc}`;
}

function setFeedDot(id, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = "feed-dot " + (ok ? "ok" : "err");
}

function markSync() {
    lastSyncTime = new Date();
    const el = document.getElementById("last-sync");
    if (el) {
        el.textContent = "LAST SYNC: " + lastSyncTime.toLocaleTimeString("en-US", { hour12: false });
    }
}

function updateTelemetryPanel() {
    const tCycle = document.getElementById("t-cycle");
    const tAlerts = document.getElementById("t-alerts");
    const tFeeds = document.getElementById("t-feeds");
    const tAudio = document.getElementById("t-audio");
    if (tCycle) tCycle.textContent = countdownVal;
    if (tAlerts) tAlerts.textContent = Object.keys(globalActiveAlertsCache).length;
    const okCount = Object.values(feedStatus).filter(Boolean).length;
    if (tFeeds) tFeeds.textContent = `${okCount}/5`;
    if (tAudio) tAudio.textContent = audioEnabled ? "ON" : "OFF";
}

// ---------------------------------------------------------------------------
// NWS FORECAST (7-day)
// ---------------------------------------------------------------------------
function fetchNWSForecast() {
    fetch(`https://api.weather.gov/points/${localLat},${localLon}`)
        .then((res) => res.json())
        .then((d) => fetch(d.properties.forecast))
        .then((res) => res.json())
        .then((data) => {
            feedStatus.nws = true;
            setFeedDot("dot-nws", true);
            globalForecastDataCache = data.properties.periods;
            let html = `<div class="panel-header" style="margin-bottom:10px;"><i class="fa-solid fa-calendar-days"></i> 7-DAY OUTLOOK · 19428</div>`;
            html += `<div class="forecast-grid">`;
            globalForecastDataCache.forEach((p, i) => {
                html += `
                <div class="forecast-card" onclick="openForecastDetails(${i})">
                    <div style="color:var(--text-dim); font-size:0.68rem; font-weight:bold; height:20px; overflow:hidden;">${p.name.toUpperCase()}</div>
                    <img src="${p.icon}" alt="">
                    <div class="${p.isDaytime ? "temp-high" : "temp-low"}">${p.temperature}°${p.temperatureUnit}</div>
                    <div style="font-size:0.6rem; color:var(--text-dim); text-overflow:ellipsis; white-space:nowrap; overflow:hidden; margin-top:3px;">${p.shortForecast}</div>
                </div>`;
            });
            html += `</div>`;
            $("#forecast-container").html(html);
        })
        .catch((err) => {
            console.error("Forecast error:", err);
            feedStatus.nws = false;
            setFeedDot("dot-nws", false);
            $("#forecast-container").html(`<span style="color:var(--red);"><i class="fa-solid fa-triangle-exclamation"></i> FORECAST FEED TIMEOUT</span>`);
        });
}

function openForecastDetails(index) {
    if (!globalForecastDataCache || !globalForecastDataCache[index]) return;
    const period = globalForecastDataCache[index];
    const modalHTML = `
        <div style="text-align:center; margin-bottom:14px;">
            <img src="${period.icon}" style="width:64px; border-radius:4px;">
            <h2 style="margin:6px 0; color:#fff;">${period.temperature}°${period.temperatureUnit}</h2>
            <div style="color:var(--amber); font-weight:bold; letter-spacing:1px;">${period.shortForecast}</div>
        </div>
        <div style="border-top:1px solid #30363d; padding-top:14px; color:#c9d1d9; line-height:1.6; font-size:0.85rem;">
            ${period.detailedForecast}
        </div>`;
    openFloatingModal(`${period.name} · METEOROLOGICAL DETAILS`, modalHTML);
}

// ---------------------------------------------------------------------------
// HOURLY FORECAST
// ---------------------------------------------------------------------------
function fetchHourlyForecast() {
    fetch(`https://api.weather.gov/points/${localLat},${localLon}`)
        .then((res) => res.json())
        .then((d) => fetch(d.properties.forecastHourly))
        .then((res) => res.json())
        .then((data) => {
            globalHourlyCache = (data.properties.periods || []).slice(0, 24);
            let html = `<div class="panel-header"><i class="fa-solid fa-clock"></i> NEXT 24 HOURS</div>`;
            html += `<div class="hourly-strip">`;
            globalHourlyCache.forEach((p) => {
                const t = new Date(p.startTime);
                const label = t.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
                html += `
                <div class="hourly-card">
                    <div style="color:var(--text-dim); font-size:0.6rem;">${label}</div>
                    <img src="${p.icon}" alt="">
                    <div class="${p.isDaytime ? "temp-high" : "temp-low"}" style="font-size:0.85rem;">${p.temperature}°</div>
                    <div style="font-size:0.55rem; color:var(--text-dim); margin-top:2px;">${p.shortForecast.split(" ").slice(0, 2).join(" ")}</div>
                    <div style="font-size:0.55rem; color:var(--blue);">${p.probabilityOfPrecipitation && p.probabilityOfPrecipitation.value != null ? p.probabilityOfPrecipitation.value + "%" : "—"}</div>
                </div>`;
            });
            html += `</div>`;
            $("#hourly-container").html(html);
        })
        .catch((err) => {
            console.error("Hourly error:", err);
            $("#hourly-container").html(`<span style="color:var(--red);">HOURLY FEED TIMEOUT</span>`);
        });
}

// ---------------------------------------------------------------------------
// ALERTS (with multi-tone detection)
// ---------------------------------------------------------------------------
function severityClass(sev) {
    const s = (sev || "").toLowerCase();
    if (s === "extreme") return "severity-extreme";
    if (s === "severe") return "severity-severe";
    if (s === "moderate") return "severity-moderate";
    if (s === "minor") return "severity-minor";
    return "severity-unknown";
}

function severityKey(sev) {
    const s = (sev || "").toLowerCase();
    if (["extreme", "severe", "moderate", "minor"].includes(s)) return s;
    return "unknown";
}

function fetchPennsylvaniaAlerts() {
    const container = $("#alerts-container");
    fetch("https://api.weather.gov/alerts/active?area=PA")
        .then((res) => res.json())
        .then((data) => {
            feedStatus.nws = true;
            setFeedDot("dot-nws", true);
            const paAlerts = data.features || [];
            globalActiveAlertsCache = {};
            let html = "";
            const currentIds = new Set();
            const newSevs = new Set();

            if (paAlerts.length > 0) {
                // Sort: extreme/severe first
                paAlerts.sort((a, b) => {
                    const order = { extreme: 0, severe: 1, moderate: 2, minor: 3 };
                    const sa = order[(a.properties.severity || "").toLowerCase()] ?? 4;
                    const sb = order[(b.properties.severity || "").toLowerCase()] ?? 4;
                    return sa - sb;
                });

                paAlerts.forEach((f) => {
                    const props = f.properties;
                    const alertId = props.id;
                    globalActiveAlertsCache[alertId] = props;
                    currentIds.add(alertId);

                    if (hasAlertBaseline && !previousAlertIds.has(alertId)) {
                        newSevs.add(severityKey(props.severity));
                    }

                    const sevCls = severityClass(props.severity);
                    const isCritical = ["extreme", "severe"].includes((props.severity || "").toLowerCase());
                    html += `
                        <div class="alert-item ${sevCls}" onclick="openAlertDetails('${alertId}')">
                            <div class="alert-title" style="color:${isCritical ? "var(--red-bright)" : "var(--orange)"};">${props.event}</div>
                            <div class="alert-meta">${props.severity || "Unknown"} · ${(props.areaDesc || "").substring(0, 60)}${(props.areaDesc || "").length > 60 ? "…" : ""}</div>
                        </div>`;
                });
            } else {
                html = `<div style="color:var(--green); font-size:0.8rem; padding:8px 0;"><i class="fa-solid fa-check"></i> SYSTEM CLEAN — NO ACTIVE ALERTS FOR PENNSYLVANIA</div>`;
            }

            // Tone trigger for new arrivals
            if (hasAlertBaseline && newSevs.size > 0 && audioEnabled) {
                playAlertsForSeverities(newSevs);
            }
            if (!hasAlertBaseline) hasAlertBaseline = true;
            previousAlertIds = currentIds;

            // UI chips
            const count = paAlerts.length;
            const countEl = document.getElementById("alert-count");
            const chip = document.getElementById("alert-count-chip");
            const panelCount = document.getElementById("alert-panel-count");
            if (countEl) countEl.textContent = count;
            if (panelCount) panelCount.textContent = count ? `${count} ACTIVE` : "CLEAR";
            if (chip) {
                if (count > 0) chip.classList.add("alert-active");
                else chip.classList.remove("alert-active");
            }

            container.html(html);
            updateTelemetryPanel();
        })
        .catch((err) => {
            console.error("Alerts fetch error:", err);
            feedStatus.nws = false;
            setFeedDot("dot-nws", false);
            container.html(`<span style="color:var(--red);"><i class="fa-solid fa-triangle-exclamation"></i> ALERT DATABASE UNREACHABLE</span>`);
        });
}

function openAlertDetails(id) {
    const alertData = globalActiveAlertsCache[id];
    if (!alertData) return;
    let body = `<div style="color:var(--red-bright); font-weight:bold; margin-bottom:10px; border-bottom:1px solid #30363d; padding-bottom:8px;">${alertData.headline || alertData.event}</div>`;
    body += `<div style="color:var(--text-dim); margin-bottom:6px; font-size:0.8rem;"><strong>Severity:</strong> ${alertData.severity || "—"} · <strong>Urgency:</strong> ${alertData.urgency || "—"} · <strong>Certainty:</strong> ${alertData.certainty || "—"}</div>`;
    body += `<div style="color:var(--text-dim); margin-bottom:8px; font-size:0.8rem;"><strong>Area:</strong> ${alertData.areaDesc}</div>`;
    body += `<div style="color:#fff; background:#0a0e14; padding:12px; border-radius:3px; border:1px solid #21262d; margin-bottom:14px; font-size:0.8rem; white-space:pre-wrap; word-wrap:break-word;">${alertData.description || ""}</div>`;
    if (alertData.instruction) {
        body += `<div style="color:var(--amber); font-weight:bold; margin-bottom:5px;"><i class="fa-solid fa-shield-halved"></i> RECOMMENDED ACTIONS</div>`;
        body += `<div style="color:var(--cyan); background:#1a222d; padding:12px; border-radius:3px; border:1px solid #30363d; font-size:0.8rem; white-space:pre-wrap; word-wrap:break-word;">${alertData.instruction}</div>`;
    }
    openFloatingModal("NWS ALERT DETAILS", body);
}

// ---------------------------------------------------------------------------
// SURFACE OBSERVATIONS
// ---------------------------------------------------------------------------
function fetchCurrentObservations() {
    fetch(`https://api.weather.gov/points/${localLat},${localLon}`)
        .then((res) => res.json())
        .then((d) => {
            const stationsUrl = d.properties.observationStations;
            return fetch(stationsUrl);
        })
        .then((res) => res.json())
        .then((stData) => {
            const stations = (stData.features || []).slice(0, 4);
            if (!stations.length) throw new Error("No stations");
            return Promise.all(
                stations.map((s) =>
                    fetch(`https://api.weather.gov/stations/${s.properties.stationIdentifier}/observations/latest`)
                        .then((r) => r.json())
                        .then((obs) => ({ id: s.properties.stationIdentifier, name: s.properties.name, obs }))
                        .catch(() => null)
                )
            );
        })
        .then((results) => {
            feedStatus.obs = true;
            setFeedDot("dot-obs", true);
            const valid = results.filter(Boolean);
            globalObsCache = {};
            let html = `<div class="panel-header"><i class="fa-solid fa-temperature-half"></i> NEAREST SURFACE STATIONS</div>`;
            if (!valid.length) {
                html += `<span style="color:var(--orange);">NO OBSERVATION DATA</span>`;
            } else {
                valid.forEach((item) => {
                    const p = item.obs.properties || {};
                    const tempC = p.temperature && p.temperature.value != null ? p.temperature.value : null;
                    const tempF = tempC != null ? Math.round((tempC * 9) / 5 + 32) : "—";
                    const wind = p.windSpeed && p.windSpeed.value != null ? Math.round(p.windSpeed.value * 2.237) : "—";
                    const humidity = p.relativeHumidity && p.relativeHumidity.value != null ? Math.round(p.relativeHumidity.value) : "—";
                    const desc = p.textDescription || "—";
                    globalObsCache[item.id] = p;
                    html += `
                    <div class="obs-row" style="cursor:pointer;" onclick="openObsDetails('${item.id}')">
                        <div>
                            <div style="color:#fff; font-size:0.78rem; font-weight:600;">${item.id}</div>
                            <div class="obs-label">${(item.name || "").substring(0, 28)}</div>
                        </div>
                        <div style="text-align:right;">
                            <div class="obs-val">${tempF}°F</div>
                            <div class="obs-label">${desc} · ${wind} mph · ${humidity}%</div>
                        </div>
                    </div>`;
                });
            }
            $("#obs-container").html(html);
        })
        .catch((err) => {
            console.error("Obs error:", err);
            feedStatus.obs = false;
            setFeedDot("dot-obs", false);
            $("#obs-container").html(`<span style="color:var(--red);">OBS FEED TIMEOUT</span>`);
        });
}

function openObsDetails(id) {
    const p = globalObsCache[id];
    if (!p) return;
    const tempC = p.temperature && p.temperature.value != null ? p.temperature.value : null;
    const tempF = tempC != null ? ((tempC * 9) / 5 + 32).toFixed(1) : "—";
    const dewC = p.dewpoint && p.dewpoint.value != null ? p.dewpoint.value : null;
    const dewF = dewC != null ? ((dewC * 9) / 5 + 32).toFixed(1) : "—";
    const windMph = p.windSpeed && p.windSpeed.value != null ? (p.windSpeed.value * 2.237).toFixed(1) : "—";
    const windDir = p.windDirection && p.windDirection.value != null ? p.windDirection.value + "°" : "—";
    const pressure = p.barometricPressure && p.barometricPressure.value != null ? (p.barometricPressure.value / 100).toFixed(1) + " hPa" : "—";
    const vis = p.visibility && p.visibility.value != null ? (p.visibility.value / 1609.34).toFixed(1) + " mi" : "—";
    const body = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.85rem;">
            <div><span style="color:var(--text-dim);">Temperature</span><br><strong style="color:var(--cyan); font-size:1.2rem;">${tempF} °F</strong></div>
            <div><span style="color:var(--text-dim);">Dewpoint</span><br><strong style="color:var(--cyan); font-size:1.2rem;">${dewF} °F</strong></div>
            <div><span style="color:var(--text-dim);">Wind</span><br><strong style="color:var(--cyan);">${windMph} mph @ ${windDir}</strong></div>
            <div><span style="color:var(--text-dim);">Humidity</span><br><strong style="color:var(--cyan);">${p.relativeHumidity && p.relativeHumidity.value != null ? Math.round(p.relativeHumidity.value) + "%" : "—"}</strong></div>
            <div><span style="color:var(--text-dim);">Pressure</span><br><strong style="color:var(--cyan);">${pressure}</strong></div>
            <div><span style="color:var(--text-dim);">Visibility</span><br><strong style="color:var(--cyan);">${vis}</strong></div>
        </div>
        <div style="margin-top:14px; color:var(--text-dim); font-size:0.8rem;">${p.textDescription || ""} · Observed ${p.timestamp ? new Date(p.timestamp).toLocaleString() : ""}</div>
    `;
    openFloatingModal(`STATION ${id} · SURFACE OBS`, body);
}

// ---------------------------------------------------------------------------
// NWS AREA FORECAST DISCUSSION (PHI)
// ---------------------------------------------------------------------------
function fetchNWSDiscussion() {
    // PHI office product AFD
    fetch("https://api.weather.gov/products/types/AFD/locations/PHI")
        .then((res) => res.json())
        .then((data) => {
            const products = data["@graph"] || [];
            if (!products.length) throw new Error("No AFD");
            const latest = products[0];
            return fetch(latest["@id"] || latest.id || `https://api.weather.gov/products/${latest.id}`);
        })
        .then((res) => res.json())
        .then((prod) => {
            const text = prod.productText || "No discussion text available.";
            // Truncate for panel; full in modal
            const preview = text.length > 1200 ? text.substring(0, 1200) + "\n\n… [click for full discussion]" : text;
            $("#discussion-container").html(`
                <div class="panel-header">
                    <span><i class="fa-solid fa-file-lines"></i> PHI AREA FORECAST DISCUSSION</span>
                    <button onclick="openFullDiscussion()" style="background:transparent; border:1px solid var(--border-bright); color:var(--cyan); font-family:inherit; font-size:0.65rem; padding:2px 6px; border-radius:2px; cursor:pointer;">FULL</button>
                </div>
                <div class="text-product" id="afd-preview" style="cursor:pointer;" onclick="openFullDiscussion()">${escapeHtml(preview)}</div>
            `);
            window._afdFullText = text;
            window._afdIssuance = prod.issuanceTime || prod.creationDate || "";
        })
        .catch((err) => {
            console.error("AFD error:", err);
            $("#discussion-container").html(`
                <div class="panel-header"><i class="fa-solid fa-file-lines"></i> PHI AREA FORECAST DISCUSSION</div>
                <div style="color:var(--text-dim); font-size:0.75rem; padding:8px 0;">
                    Discussion product temporarily unavailable. NWS text products may lag during high-impact events.
                </div>
            `);
        });
}

function openFullDiscussion() {
    const text = window._afdFullText || "No discussion loaded.";
    const when = window._afdIssuance ? new Date(window._afdIssuance).toLocaleString() : "";
    openFloatingModal(`PHI AFD · ${when}`, `<pre class="text-product" style="max-height:none; border:none; background:transparent; padding:0;">${escapeHtml(text)}</pre>`);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// AIR QUALITY (AirNow)
// ---------------------------------------------------------------------------
const AQI_CATEGORY_INFO = {
    1: { label: "Good", color: "#00e400", message: "Air quality is satisfactory, and air pollution poses little or no risk." },
    2: { label: "Moderate", color: "#ffff00", message: "Air quality is acceptable. Unusually sensitive individuals should consider limiting prolonged outdoor exertion." },
    3: { label: "Unhealthy SG", color: "#ff7e00", message: "Members of sensitive groups (asthma, heart/lung conditions, children, older adults) may experience health effects." },
    4: { label: "Unhealthy", color: "#ff0000", message: "Everyone may begin to experience health effects; sensitive groups may experience more serious effects." },
    5: { label: "Very Unhealthy", color: "#8f3f97", message: "Health alert: risk of health effects is increased for everyone." },
    6: { label: "Hazardous", color: "#7e0023", message: "Health warning of emergency conditions: the entire population is more likely to be affected." }
};

function getAQIColorSpecs(aqiValue, categoryNumber) {
    if (categoryNumber && AQI_CATEGORY_INFO[categoryNumber]) return AQI_CATEGORY_INFO[categoryNumber];
    if (aqiValue <= 50) return AQI_CATEGORY_INFO[1];
    if (aqiValue <= 100) return AQI_CATEGORY_INFO[2];
    if (aqiValue <= 150) return AQI_CATEGORY_INFO[3];
    if (aqiValue <= 200) return AQI_CATEGORY_INFO[4];
    if (aqiValue <= 300) return AQI_CATEGORY_INFO[5];
    return AQI_CATEGORY_INFO[6];
}

function fetchAirQualityData() {
    const currentUrl = `https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${localZip}&distance=25&API_KEY=${AIRNOW_API_KEY}`;
    const forecastUrl = `https://www.airnowapi.org/aq/forecast/zipCode/?format=application/json&zipCode=${localZip}&distance=25&API_KEY=${AIRNOW_API_KEY}`;

    Promise.all([
        fetch(currentUrl).then((res) => res.json()),
        fetch(forecastUrl).then((res) => res.json()).catch(() => [])
    ])
        .then(([data, forecastData]) => {
            feedStatus.aqi = true;
            setFeedDot("dot-aqi", true);
            let html = `
                <div class="panel-header">
                    <span><i class="fa-solid fa-wind"></i> CONSHOHOCKEN (19428) · LIVE</span>
                </div>`;

            globalAQIDetailsCache = {};

            if (!data || data.length === 0) {
                html += `<div style="color:var(--orange); font-size:0.75rem; padding:8px 0;">NO SENSOR DATA</div>`;
            } else {
                let worstCategory = 0;
                let worstParam = null;
                data.forEach((p) => {
                    const catNum = p.Category && p.Category.Number ? p.Category.Number : null;
                    if (catNum && catNum > worstCategory) {
                        worstCategory = catNum;
                        worstParam = p;
                    }
                });

                if (worstCategory >= 3 && worstParam) {
                    const alertProfile = getAQIColorSpecs(worstParam.AQI, worstCategory);
                    globalAQIDetailsCache["health"] = {
                        title: `${alertProfile.label.toUpperCase()} — ${worstParam.ParameterName}`,
                        body: `<div style="color:${alertProfile.color}; font-weight:bold; margin-bottom:10px;">${worstParam.ParameterName} — AQI ${worstParam.AQI} (Cat ${worstCategory}: ${alertProfile.label})</div>
                            <div style="color:var(--text-dim); margin-bottom:8px;">${worstParam.ReportingArea || ""}, ${worstParam.StateCode || ""} · ${worstParam.DateObserved || ""} ${worstParam.HourObserved !== undefined ? worstParam.HourObserved + ":00" : ""}</div>
                            <div style="color:#fff; background:#0a0e14; padding:12px; border-radius:3px; border:1px solid #21262d; font-size:0.85rem;">${alertProfile.message}</div>`
                    };
                    html += `
                        <div style="border-left:4px solid ${alertProfile.color}; background:#211515; padding:8px; margin-bottom:8px; border-radius:2px; cursor:pointer;" onclick="openAQIDetails('health')">
                            <div style="color:${alertProfile.color}; font-weight:bold; font-size:0.72rem; text-transform:uppercase;">
                                <i class="fa-solid fa-triangle-exclamation"></i> ${alertProfile.label.toUpperCase()} — ${worstParam.ParameterName}
                            </div>
                            <div style="color:#c9d1d9; font-size:0.68rem; margin-top:3px;">${alertProfile.message}</div>
                        </div>`;
                }

                const actionDay = Array.isArray(forecastData) ? forecastData.find((f) => f.ActionDay) : null;
                if (actionDay) {
                    const fullDiscussion = actionDay.Discussion || "An Air Quality Action Day has been declared.";
                    globalAQIDetailsCache["actionday"] = {
                        title: `AIR QUALITY ACTION DAY — ${actionDay.ReportingArea || ""}`,
                        body: `<div style="color:var(--amber); font-weight:bold; margin-bottom:10px;">${actionDay.ParameterName || ""} · ${actionDay.DateForecast || ""}</div>
                            <div style="color:#fff; background:#0a0e14; padding:12px; border-radius:3px; border:1px solid #21262d; font-size:0.85rem; white-space:pre-wrap;">${fullDiscussion}</div>`
                    };
                    html += `
                        <div style="border-left:4px solid var(--amber); background:#2d2416; padding:8px; margin-bottom:8px; border-radius:2px; cursor:pointer;" onclick="openAQIDetails('actionday')">
                            <div style="color:var(--amber); font-weight:bold; font-size:0.72rem;"><i class="fa-solid fa-bell"></i> AIR QUALITY ACTION DAY</div>
                            <div style="color:#c9d1d9; font-size:0.68rem; margin-top:3px;">${fullDiscussion.substring(0, 120)}…</div>
                        </div>`;
                }

                const meta = data[0];
                if (meta) {
                    html += `<div style="font-size:0.62rem; color:var(--text-dim); margin-bottom:6px;">
                        <i class="fa-solid fa-location-dot"></i> ${meta.ReportingArea || ""}, ${meta.StateCode || ""} · ${meta.DateObserved || ""} ${meta.HourObserved !== undefined ? meta.HourObserved + ":00" : ""} ${meta.LocalTimeZone || ""}
                    </div>`;
                }

                html += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">`;
                data.forEach((p, idx) => {
                    const catNum = p.Category && p.Category.Number ? p.Category.Number : null;
                    const profile = getAQIColorSpecs(p.AQI, catNum);
                    const cacheKey = `param-${idx}`;
                    globalAQIDetailsCache[cacheKey] = {
                        title: `${p.ParameterName} — ${profile.label.toUpperCase()}`,
                        body: `<div style="color:${profile.color}; font-weight:bold; margin-bottom:10px;">${p.ParameterName} — AQI ${p.AQI}${catNum ? " (Cat " + catNum + ")" : ""}</div>
                            <div style="color:var(--text-dim); margin-bottom:8px;">${p.ReportingArea || ""}, ${p.StateCode || ""}</div>
                            <div style="color:#fff; background:#0a0e14; padding:12px; border-radius:3px; border:1px solid #21262d; font-size:0.85rem;">${profile.message}</div>`
                    };
                    html += `
                        <div style="background:#0a0e14; border:1px solid #21262d; border-radius:3px; padding:6px; text-align:center; cursor:pointer;" onclick="openAQIDetails('${cacheKey}')">
                            <div style="font-size:0.6rem; color:var(--text-dim); font-weight:bold; text-transform:uppercase;">${p.ParameterName}</div>
                            <div style="font-size:1.5rem; color:${profile.color}; font-weight:bold;">${p.AQI}</div>
                            <div style="font-size:0.58rem; color:${profile.color}; font-weight:bold;">${profile.label}</div>
                        </div>`;
                });
                html += `</div>`;

                if (Array.isArray(forecastData) && forecastData.length > 0) {
                    html += `<div style="margin-top:10px; padding-top:8px; border-top:1px dashed #30363d;">
                        <div style="font-size:0.65rem; color:var(--text-dim); font-weight:bold; margin-bottom:5px; text-transform:uppercase;"><i class="fa-solid fa-calendar-days"></i> AirNow Forecast</div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(80px, 1fr)); gap:5px;">`;
                    forecastData.forEach((f, fidx) => {
                        if (!f.ParameterName) return;
                        const fCatNum = f.Category && f.Category.Number ? f.Category.Number : null;
                        const fProfile = getAQIColorSpecs(f.AQI, fCatNum);
                        const fCacheKey = `forecast-${fidx}`;
                        globalAQIDetailsCache[fCacheKey] = {
                            title: `${f.ParameterName} FORECAST — ${f.DateForecast || ""}`,
                            body: `<div style="color:${fProfile.color}; font-weight:bold; margin-bottom:10px;">${f.ParameterName} — Forecast AQI ${f.AQI !== -1 ? f.AQI : "N/A"}</div>
                                <div style="color:var(--text-dim); margin-bottom:8px;">${f.DateForecast || ""} · Action Day: ${f.ActionDay ? "YES" : "No"}</div>
                                <div style="color:#fff; background:#0a0e14; padding:12px; border-radius:3px; border:1px solid #21262d; font-size:0.85rem; white-space:pre-wrap;">${f.Discussion || fProfile.message}</div>`
                        };
                        html += `
                            <div style="background:#161b22; border:1px solid #30363d; border-radius:3px; padding:4px; text-align:center; cursor:pointer;" onclick="openAQIDetails('${fCacheKey}')">
                                <div style="font-size:0.52rem; color:var(--text-dim);">${f.DateForecast ? f.DateForecast.substring(5) : ""}</div>
                                <div style="font-size:0.55rem; color:var(--text-dim);">${f.ParameterName}</div>
                                <div style="font-size:1rem; color:${fProfile.color}; font-weight:bold;">${f.AQI !== -1 ? f.AQI : "—"}</div>
                                <div style="font-size:0.5rem; color:${fProfile.color};">${fProfile.label}</div>
                            </div>`;
                    });
                    html += `</div></div>`;
                }
            }
            $("#aqi-container-target").html(html);
        })
        .catch((err) => {
            console.error("AirNow error:", err);
            feedStatus.aqi = false;
            setFeedDot("dot-aqi", false);
            $("#aqi-container-target").html(`<span style="color:var(--red);"><i class="fa-solid fa-triangle-exclamation"></i> AIRNOW FEED TIMEOUT</span>`);
        });
}

function openAQIDetails(key) {
    const detail = globalAQIDetailsCache[key];
    if (!detail) return;
    openFloatingModal(detail.title, detail.body);
}

// ---------------------------------------------------------------------------
// NOAA TIDES
// ---------------------------------------------------------------------------
function fetchNOAATides() {
    const station = "8545240";
    const timeZone = "lst_ldt";
    const units = "english";
    const format = "json";
    const date = "today";
    const baseUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${station}&time_zone=${timeZone}&units=${units}&format=${format}&date=${date}`;

    Promise.all([
        fetch(`${baseUrl}&product=water_level&datum=MLLW`).then((r) => r.json()),
        fetch(`${baseUrl}&product=water_level&datum=NAVD`).then((r) => r.json()),
        fetch(`${baseUrl}&product=predictions&datum=MLLW`).then((r) => r.json()),
        fetch(`${baseUrl}&product=air_temperature`).then((r) => r.json())
    ])
        .then(([wlMllw, wlNavd, predsMllw, airTemp]) => {
            feedStatus.tides = true;
            setFeedDot("dot-tides", true);

            const latestWlMllw = wlMllw.data ? wlMllw.data[wlMllw.data.length - 1] : null;
            const latestWlNavd = wlNavd.data ? wlNavd.data[wlNavd.data.length - 1] : null;
            const latestAirTemp = airTemp.data ? airTemp.data[airTemp.data.length - 1] : null;

            let gaugeHtml = `<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; width:100%;">`;
            if (latestWlMllw) gaugeHtml += `<div style="background:#161b22; border:1px solid #30363d; border-radius:3px; padding:6px; text-align:center;"><div style="font-size:0.6rem; color:var(--text-dim); font-weight:bold;">MLLW</div><div style="font-size:1.3rem; color:var(--cyan); font-weight:bold;">${latestWlMllw.v}</div><div style="font-size:0.55rem; color:var(--text-dim);">ft</div></div>`;
            if (latestWlNavd) gaugeHtml += `<div style="background:#161b22; border:1px solid #30363d; border-radius:3px; padding:6px; text-align:center;"><div style="font-size:0.6rem; color:var(--text-dim); font-weight:bold;">NAVD</div><div style="font-size:1.3rem; color:var(--cyan); font-weight:bold;">${latestWlNavd.v}</div><div style="font-size:0.55rem; color:var(--text-dim);">ft</div></div>`;
            if (latestAirTemp) gaugeHtml += `<div style="background:#161b22; border:1px solid #30363d; border-radius:3px; padding:6px; text-align:center;"><div style="font-size:0.6rem; color:var(--text-dim); font-weight:bold;">AIR TEMP</div><div style="font-size:1.3rem; color:var(--cyan); font-weight:bold;">${latestAirTemp.v}</div><div style="font-size:0.55rem; color:var(--text-dim);">°F</div></div>`;
            gaugeHtml += `</div>`;
            $("#noaa-gauges").html(gaugeHtml || '<span style="color:var(--red);">NOAA TIMEOUT</span>');

            const labels = wlMllw.data
                ? wlMllw.data.map((d) => {
                      const timeParts = d.t.split(" ")[1].split(":");
                      return `${timeParts[0]}:${timeParts[1]}`;
                  })
                : [];
            const dataMllw = wlMllw.data ? wlMllw.data.map((d) => parseFloat(d.v)) : [];
            const dataPreds = predsMllw.predictions ? predsMllw.predictions.map((d) => parseFloat(d.v)) : [];

            const canvas = document.getElementById("noaaChart");
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (noaaChartInstance) noaaChartInstance.destroy();

            Chart.defaults.color = "#8b949e";
            Chart.defaults.font.family = "'Share Tech Mono', monospace";

            noaaChartInstance = new Chart(ctx, {
                type: "line",
                data: {
                    labels,
                    datasets: [
                        {
                            label: "Observed (MLLW) ft",
                            data: dataMllw,
                            borderColor: "#00ffcc",
                            backgroundColor: "rgba(0, 255, 204, 0.1)",
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: "Predicted (MLLW) ft",
                            data: dataPreds.slice(0, labels.length),
                            borderColor: "#ff5555",
                            borderDash: [4, 4],
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: false,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { intersect: false, mode: "index" },
                    plugins: {
                        legend: { display: true, position: "top", labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } } }
                    },
                    scales: {
                        x: { ticks: { maxTicksLimit: 6, font: { size: 9 } }, grid: { color: "#21262d" } },
                        y: { ticks: { font: { size: 9 } }, grid: { color: "#21262d" } }
                    }
                }
            });
        })
        .catch((err) => {
            console.error("NOAA API Error:", err);
            feedStatus.tides = false;
            setFeedDot("dot-tides", false);
            $("#noaa-gauges").html('<span style="color:var(--red); font-size:0.75rem;"><i class="fa-solid fa-triangle-exclamation"></i> NOAA TIMEOUT</span>');
        });
}

// ---------------------------------------------------------------------------
// HYDROLOGY
// ---------------------------------------------------------------------------
function fetchSchuylkillHydrology() {
    feedStatus.hydro = true;
    setFeedDot("dot-hydro", true);
    let html = `<div class="panel-header"><i class="fa-solid fa-water"></i> SCHUYLKILL BASIN STREAMFLOW</div>`;
    schuylkillGauges.forEach((g) => {
        html += `
            <div class="gauge-card">
                <div style="font-weight:bold; color:#fff; font-size:0.78rem;">${g.name}</div>
                <div style="color:var(--cyan); margin:3px 0; font-size:0.68rem;"><i class="fa-solid fa-water"></i> USGS-${g.id}</div>
                <button class="gauge-btn" onclick="openHydrographModal('${g.id}', '${g.name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-chart-line"></i> Open Waveform / Hydrograph</button>
            </div>`;
    });
    $("#hydro-river-list").html(html);
}

function openHydrographModal(stationId, stationName) {
    const embedUrl = `https://dashboard.waterdata.usgs.gov/api/gwis/2.1/service/site?agencyCode=USGS&siteNumber=${stationId}&open=plots&banner=false&pad=false`;
    const modalHTML = `<div style="height:520px; width:100%;"><iframe src="${embedUrl}" style="width:100%; height:100%; background:#fff; border:none; border-radius:3px;"></iframe></div>`;
    openFloatingModal(`USGS HYDROGRAPH · ${stationName}`, modalHTML);
}

// ---------------------------------------------------------------------------
// MODAL
// ---------------------------------------------------------------------------
function openFloatingModal(title, textHTML) {
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalBody").innerHTML = textHTML;
    document.getElementById("hubFloatingModal").style.display = "flex";
}
function closeFloatingModal() {
    document.getElementById("hubFloatingModal").style.display = "none";
    document.getElementById("modalBody").innerHTML = "";
}

// ---------------------------------------------------------------------------
// GLOBAL REFRESH CYCLE (120s)
// ---------------------------------------------------------------------------
function runFullRefresh() {
    fetchNWSForecast();
    fetchHourlyForecast();
    fetchPennsylvaniaAlerts();
    fetchAirQualityData();
    fetchNOAATides();
    fetchSchuylkillHydrology();
    fetchCurrentObservations();
    fetchNWSDiscussion();
    markSync();
    updateTelemetryPanel();
}

setInterval(() => {
    countdownVal--;
    if (countdownVal <= 0) {
        countdownVal = 120;
        runFullRefresh();
    }
    const targetTimer = document.getElementById("countdown");
    if (targetTimer) targetTimer.innerText = countdownVal;
    const tCycle = document.getElementById("t-cycle");
    if (tCycle) tCycle.textContent = countdownVal;
}, 1000);

setInterval(updateMissionClock, 1000);
updateMissionClock();

window.addEventListener("resize", () => {
    layout.updateSize();
});

// Init
document.addEventListener("DOMContentLoaded", () => {
    initAudioToggle();
    markSync();
});
