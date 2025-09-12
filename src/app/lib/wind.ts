// Robust Open-Meteo client using ERA5 archive first, then 10 m fallback.
export type WindSample = { u: number; v: number; speed: number; dir: number; time: string; level: string };

const HEADERS = { "user-agent": "BalloonTracks/1.0 (+sumedh)", "accept": "application/json, text/plain, */*" };

function ymd(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function nearestIndex(times: string[], targetISO: string) {
  const t = Date.parse(targetISO);
  let best = 0, bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(Date.parse(times[i]) - t);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return best;
}
function uvToDirDeg(u: number, v: number) {
  const rad = Math.atan2(-u, -v); // meteorological: from-direction
  const deg = (rad * 180) / Math.PI;
  return (deg + 360) % 360;
}
async function getJSON(url: string) {
  const r = await fetch(url, { headers: HEADERS, cache: "no-store", redirect: "follow" });
  const txt = await r.text();
  try { return r.ok ? JSON.parse(txt) : null; } catch { return null; }
}

export async function fetchWindAtPoint(
  lat: number,
  lon: number,
  whenISO: string,
  pressureHpa = "700"
): Promise<WindSample | null> {

  // 48 h window around the requested time
  const t = new Date(whenISO);
  const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - 1));
  const end   = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1));

  // 1) ERA5 pressure-level winds
  const urlPL = `https://archive-api.open-meteo.com/v1/era5?latitude=${lat}&longitude=${lon}` +
    `&hourly=u_component_of_wind_${pressureHpa}hPa,v_component_of_wind_${pressureHpa}hPa` +
    `&start_date=${ymd(start)}&end_date=${ymd(end)}&timezone=UTC&timeformat=iso8601`;

  let data = await getJSON(urlPL);
  if (data?.hourly?.time) {
    const times: string[] = data.hourly.time;
    const U: number[] = data.hourly[`u_component_of_wind_${pressureHpa}hPa`];
    const V: number[] = data.hourly[`v_component_of_wind_${pressureHpa}hPa`];
    if (Array.isArray(U) && Array.isArray(V)) {
      const idx = nearestIndex(times, whenISO);
      const u = Number(U[idx]), v = Number(V[idx]);
      if (isFinite(u) && isFinite(v)) {
        const speed = Math.hypot(u, v);
        return { u, v, speed, dir: uvToDirDeg(u, v), time: times[idx], level: `${pressureHpa} hPa` };
      }
    }
  }

  // 2) Fallback: ERA5 10 m winds (always available)
  const url10 = `https://archive-api.open-meteo.com/v1/era5?latitude=${lat}&longitude=${lon}` +
    `&hourly=u_component_of_wind_10m,v_component_of_wind_10m` +
    `&start_date=${ymd(start)}&end_date=${ymd(end)}&timezone=UTC&timeformat=iso8601`;

  data = await getJSON(url10);
  if (data?.hourly?.time) {
    const times: string[] = data.hourly.time;
    const U: number[] = data.hourly.u_component_of_wind_10m;
    const V: number[] = data.hourly.v_component_of_wind_10m;
    const idx = nearestIndex(times, whenISO);
    const u = Number(U?.[idx]), v = Number(V?.[idx]);
    if (isFinite(u) && isFinite(v)) {
      const speed = Math.hypot(u, v);
      return { u, v, speed, dir: uvToDirDeg(u, v), time: times[idx], level: "10 m" };
    }
  }

  return null;
}
