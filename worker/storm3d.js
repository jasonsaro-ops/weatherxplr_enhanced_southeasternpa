/**
 * WEATHERXPLR Storm 3D — Cloudflare Worker
 * Deploy: wrangler deploy (or paste into CF dashboard as module worker)
 *
 * GET /?lat=40.08&lon=-75.30
 * Returns JSON storm-structure metrics for the Three.js panel.
 * Uses public Open-Meteo + NWS only (no Level-II decode).
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=60",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    try {
      const url = new URL(request.url);
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

  // Heuristic structure from public fields (NOT Level-II measured)
  let echoTop = 0;
  let maxDbz = 5;
  let maxDbzHt = 2000;
  let coreTop = 0;
  let intensity = "none";

  if (hasTstorm || cape > 500 || precip > 0.1) {
    intensity = "weak";
    maxDbz = 35 + Math.min(25, cape / 80);
    echoTop = 18000 + Math.min(28000, cape * 12);
    maxDbzHt = 4000 + Math.min(8000, cape * 2);
    coreTop = echoTop * 0.55;
  }
  if (cape > 1500 || code >= 95 || (alerts.severe && alerts.severe.some(a => /tornado|severe thunder/i.test(a.event)))) {
    intensity = "moderate";
    maxDbz = 50 + Math.min(15, cape / 200);
    echoTop = 30000 + Math.min(20000, cape * 8);
    maxDbzHt = 6000 + Math.min(12000, cape * 3);
    coreTop = echoTop * 0.65;
  }
  if (cape > 2500 || (alerts.severe && alerts.severe.some(a => /tornado/i.test(a.event)))) {
    intensity = "strong";
    maxDbz = Math.min(72, 58 + cape / 500);
    echoTop = Math.min(60000, 40000 + cape * 6);
    maxDbzHt = 8000 + Math.min(15000, cape * 2);
    coreTop = echoTop * 0.72;
  }
  if (precip > 0.5) maxDbz = Math.min(75, maxDbz + 5);
  if (gust > 40) coreTop = Math.min(echoTop * 0.85, coreTop + 3000);

  // Quiet sky
  if (intensity === "none" && precip < 0.05 && cape < 300) {
    echoTop = 0;
    maxDbz = 0;
    maxDbzHt = 0;
    coreTop = 0;
  }

  return {
    ok: true,
    mode: intensity === "none" ? "clear" : "estimated",
    disclaimer:
      "Structure is estimated from public Open-Meteo CAPE/precip and NWS alerts — not NEXRAD Level-II measured volume. For true volumetric radar use commercial products (e.g. 4070 Storm 3D).",
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
    source: {
      meteo: "Open-Meteo",
      alerts: "api.weather.gov",
    },
  };
}

async function fetchMeteo(lat, lon) {
  const u =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=precipitation,weather_code,wind_gusts_10m,cape` +
    `&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York`;
  try {
    const r = await fetch(u, { cf: { cacheTtl: 120 } });
    if (!r.ok) return {};
    const j = await r.json();
    const c = j.current || {};
    return {
      precip: c.precipitation,
      weather_code: c.weather_code,
      gust: c.wind_gusts_10m,
      cape: c.cape,
    };
  } catch {
    return {};
  }
}

async function fetchAlerts(lat, lon) {
  // Point-based active alerts
  const u = `https://api.weather.gov/alerts/active?point=${lat},${lon}`;
  try {
    const r = await fetch(u, {
      headers: { Accept: "application/geo+json", "User-Agent": "WeatherXplrStorm3D/1.0" },
      cf: { cacheTtl: 60 },
    });
    if (!r.ok) return { severe: [] };
    const j = await r.json();
    const severe = (j.features || [])
      .map((f) => f.properties || {})
      .filter((p) => {
        const s = (p.severity || "").toLowerCase();
        return s === "extreme" || s === "severe" || /thunder|tornado|funnel|severe/i.test(p.event || "");
      })
      .slice(0, 5)
      .map((p) => ({
        event: p.event,
        severity: p.severity,
        headline: p.headline,
      }));
    return { severe };
  } catch {
    return { severe: [] };
  }
}
