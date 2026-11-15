/**
 * WEATHERXPLR edge worker — Storm 3D heuristics + Visual Crossing proxy
 *
 * Routes:
 *   GET /?lat=&lon=              → Storm 3D metrics (Open-Meteo + NWS)
 *   GET /vc/current?lat=&lon=    → VC current (key from env VC_API_KEY)
 *   GET /vc/history?lat=&lon=&start=&end=  or  ?location=&start=&end=
 *
 * Secrets (Cloudflare): VC_API_KEY
 * Set via GitHub Actions from repository secret VC_API_KEY
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=60",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";

      if (path === "/vc/current" || path.endsWith("/vc/current")) {
        return await handleVCCurrent(url, env);
      }
      if (path === "/vc/history" || path.endsWith("/vc/history")) {
        return await handleVCHistory(url, env);
      }

      // default: storm 3d
      const lat = parseFloat(url.searchParams.get("lat") || "40.0759");
      const lon = parseFloat(url.searchParams.get("lon") || "-75.2996");
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return json({ error: "Invalid lat/lon" }, 400);
      }
      const data = await buildStorm(lat, lon);
      return json(data);
    } catch (e) {
      return json({ error: String(e.message || e), mode: "error" }, 500);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}

async function handleVCCurrent(url, env) {
  const key = env.VC_API_KEY;
  if (!key) return json({ error: "VC_API_KEY not configured on worker" }, 503);
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  const location = url.searchParams.get("location");
  const loc = location
    ? location
    : `${lat || "40.0759"},${lon || "-75.2996"}`;
  const api = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(loc)}?unitGroup=us&include=current&key=${encodeURIComponent(key)}&contentType=json`;
  const r = await fetch(api);
  const text = await r.text();
  if (!r.ok) return json({ error: "VC upstream " + r.status, detail: text.slice(0, 200) }, r.status);
  return new Response(text, { status: 200, headers: CORS });
}

async function handleVCHistory(url, env) {
  const key = env.VC_API_KEY;
  if (!key) return json({ error: "VC_API_KEY not configured on worker" }, 503);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end) return json({ error: "start and end required (YYYY-MM-DD)" }, 400);
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  const location = url.searchParams.get("location");
  const loc = location
    ? location
    : `${lat || "40.0759"},${lon || "-75.2996"}`;
  const api = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(loc)}/${encodeURIComponent(start)}/${encodeURIComponent(end)}?unitGroup=us&include=days&key=${encodeURIComponent(key)}&contentType=json`;
  const r = await fetch(api);
  const text = await r.text();
  if (!r.ok) return json({ error: "VC upstream " + r.status, detail: text.slice(0, 200) }, r.status);
  return new Response(text, { status: 200, headers: { ...CORS, "Cache-Control": "public, max-age=300" } });
}

async function buildStorm(lat, lon) {
  const now = new Date();
  const [meteo, alerts] = await Promise.all([
    fetchMeteo(lat, lon),
    fetchAlerts(lat, lon),
  ]);

  const cape = meteo.cape ?? 0;
  const precip = meteo.precip ?? 0;
  const code = meteo.weather_code ?? 0;
  const gust = meteo.gust ?? 0;
  const hasTstorm = code >= 95 || (alerts.severe && alerts.severe.length > 0);

  let echoTop = 0;
  let maxDbz = 0;
  let maxDbzHt = 0;
  let coreTop = 0;
  let intensity = "none";
  const raining = precip >= 0.05 || (code >= 61 && code <= 67) || (code >= 80 && code <= 82);

  if (raining || cape > 200) {
    intensity = "weak";
    maxDbz = 28 + Math.min(20, precip * 40 + cape / 100);
    echoTop = 12000 + Math.min(18000, precip * 8000 + cape * 8);
    maxDbzHt = 3000 + Math.min(6000, cape * 2);
    coreTop = echoTop * 0.45;
  }
  if (hasTstorm || cape > 500 || precip > 0.15 || code >= 80) {
    intensity = "weak";
    maxDbz = Math.max(maxDbz, 35 + Math.min(25, cape / 80 + precip * 30));
    echoTop = Math.max(echoTop, 18000 + Math.min(28000, cape * 12));
    maxDbzHt = Math.max(maxDbzHt, 4000 + Math.min(8000, cape * 2));
    coreTop = echoTop * 0.55;
  }
  if (cape > 1500 || code >= 95 || (alerts.severe && alerts.severe.some(a => /tornado|severe thunder/i.test(a.event)))) {
    intensity = "moderate";
    maxDbz = 50 + Math.min(15, cape / 200);
    echoTop = 30000 + Math.min(20000, cape * 8);
    maxDbzHt = 7000 + Math.min(10000, cape * 2);
    coreTop = echoTop * 0.65;
  }
  if (cape > 2500 || (alerts.severe && alerts.severe.some(a => /tornado/i.test(a.event)))) {
    intensity = "strong";
    maxDbz = Math.min(72, 58 + cape / 500);
    echoTop = Math.min(60000, 40000 + cape * 6);
    maxDbzHt = 8000 + Math.min(15000, cape * 2);
    coreTop = echoTop * 0.72;
  }
  if (precip > 0.3) maxDbz = Math.min(75, maxDbz + 8);
  if (gust > 40) coreTop = Math.min(echoTop * 0.85, coreTop + 3000);
  if (!raining && !hasTstorm && cape < 500 && precip < 0.05) {
    echoTop = 0; maxDbz = 0; maxDbzHt = 0; coreTop = 0; intensity = "none";
  }

  return {
    ok: true,
    mode: intensity === "none" ? "clear" : "estimated",
    disclaimer: "Point sample only (0 mi radius). Structure estimated from Open-Meteo CAPE/precip and NWS alerts — not NEXRAD Level-II measured volume.",
    location: { lat, lon },
    time: now.toISOString(),
    timeLocal: now.toLocaleString("en-US", { timeZone: "America/New_York" }),
    metrics: {
      echoTopFt: Math.round(echoTop),
      maxDbz: Math.round(maxDbz * 10) / 10,
      maxDbzHeightFt: Math.round(maxDbzHt),
      coreTopFt: Math.round(coreTop),
      intensity,
      cape: Math.round(cape),
      precipIn: Math.round(precip * 100) / 100,
      weatherCode: code,
      gustMph: Math.round(gust),
    },
    alerts: alerts.severe || [],
    source: { meteo: "Open-Meteo", alerts: "api.weather.gov" },
  };
}

async function fetchMeteo(lat, lon) {
  const u =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=precipitation,weather_code,wind_gusts_10m,cape` +
    `&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York`;
  try {
    const j = await fetch(u).then((r) => r.json());
    const c = j.current || {};
    return {
      precip: c.precipitation || 0,
      weather_code: c.weather_code || 0,
      gust: c.wind_gusts_10m || 0,
      cape: c.cape || 0,
    };
  } catch (e) {
    return { precip: 0, weather_code: 0, gust: 0, cape: 0 };
  }
}

async function fetchAlerts(lat, lon) {
  try {
    const u = `https://api.weather.gov/alerts/active?point=${lat},${lon}`;
    const j = await fetch(u, {
      headers: { Accept: "application/geo+json", "User-Agent": "WeatherXplr-Worker/1.0" },
    }).then((r) => r.json());
    const severe = (j.features || [])
      .map((f) => f.properties || {})
      .filter((p) => {
        const s = (p.severity || "").toLowerCase();
        return s === "extreme" || s === "severe" || /thunder|tornado|funnel|severe/i.test(p.event || "");
      })
      .slice(0, 5)
      .map((p) => ({ event: p.event, severity: p.severity, headline: p.headline }));
    return { severe };
  } catch (e) {
    return { severe: [] };
  }
}
