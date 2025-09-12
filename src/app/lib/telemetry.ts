export type TrackPoint = { id: string; t: string; lat: number; lon: number; alt?: number };

const BASE = "https://a.windbornesystems.com/treasure";
const H = {
  "user-agent": "BalloonTracks/1.0 (+sumedh)",
  "accept": "application/json, text/plain, */*",
  "referer": "https://windbornesystems.com/",
  "origin": "https://windbornesystems.com"
};

const toNum = (x: any) => (isFinite(Number(x)) ? Number(x) : undefined);
const toISO = (hoursAgo: number) => {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() - hoursAgo);
  return d.toISOString();
};

function parseAsPoints(anything: any, hoursAgo: number): Omit<TrackPoint, "id">[] {
  const pts: Omit<TrackPoint, "id">[] = [];

  // Case A: array of arrays [[lat,lon,alt?], ...]
  if (Array.isArray(anything) && Array.isArray(anything[0])) {
    for (const a of anything as any[]) {
      const lat = toNum(a[0]), lon = toNum(a[1]), alt = toNum(a[2]);
      if (lat !== undefined && lon !== undefined) {
        pts.push({ t: toISO(hoursAgo), lat, lon, alt });
      }
    }
    return pts;
  }

  // Case B: array of objects
  if (Array.isArray(anything)) {
    for (const r of anything) {
      const lat = toNum(r?.lat ?? r?.latitude), lon = toNum(r?.lon ?? r?.longitude);
      const alt = toNum(r?.alt ?? r?.altitude);
      if (lat !== undefined && lon !== undefined) {
        pts.push({ t: toISO(hoursAgo), lat, lon, alt });
      }
    }
    return pts;
  }

  // Case C: wrapped object
  if (anything && typeof anything === "object") {
    const arr = (anything as any).data || (anything as any).balloons;
    if (Array.isArray(arr)) return parseAsPoints(arr, hoursAgo);
    // dict of objects { id: {lat,lon,...} }
    for (const [, v] of Object.entries(anything)) {
      const lat = toNum((v as any)?.lat ?? (v as any)?.latitude);
      const lon = toNum((v as any)?.lon ?? (v as any)?.longitude);
      const alt = toNum((v as any)?.alt ?? (v as any)?.altitude);
      if (lat !== undefined && lon !== undefined) pts.push({ t: toISO(hoursAgo), lat, lon, alt });
    }
  }
  return pts;
}

async function fetchHour(hh: string): Promise<any | null> {
  const url = `${BASE}/${hh}.json?ts=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: "no-store", redirect: "follow", headers: H });
    const text = await res.text();
    if (!res.ok) return null;
    try { return JSON.parse(text); } catch { return null; }
  } catch { return null; }
}

// --- geo helpers
const R = 6371e3;
function haversine(a: {lat:number;lon:number}, b:{lat:number;lon:number}) {
  const toRad = (d:number)=> d*Math.PI/180;
  const dphi = toRad(b.lat-a.lat), dl = toRad(b.lon-a.lon);
  const A = Math.sin(dphi/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dl/2)**2;
  return 2*R*Math.asin(Math.sqrt(A)); // meters
}

const MAX_SPEED_MS = 80;        // 288 km/h – stricter than before
const MAX_JUMP_PER_HOUR_M = 400e3; // 400 km per hour step cap

// Greedy stitch: link each point to the nearest previous track if speed < limit
function stitchTracks(frames: Omit<TrackPoint,"id">[][], hoursAgo: number[]): Record<string, TrackPoint[]> {
  type Track = { id: string; pts: TrackPoint[] };
  const tracks: Track[] = [];
  let nextId = 1;

  // process from oldest to newest so time increases
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i];
    const tISO = (idx:number)=> frame[idx]?.t;
    // track candidates map
    const used = new Set<number>();
    for (let j = 0; j < frame.length; j++) {
      const p = frame[j];
      // find best existing track by distance from its last point
      let bestK = -1, bestD = Infinity, bestDtH = 1;
      for (let k = 0; k < tracks.length; k++) {
        if (used.has(k)) continue;
        const last = tracks[k].pts[tracks[k].pts.length - 1];
        const dtHours = Math.max(1, Math.abs((Date.parse(last.t) - Date.parse(p.t)) / 3600000));
        const d = haversine({ lat: last.lat, lon: last.lon }, { lat: p.lat, lon: p.lon });
        const speed = d / (dtHours * 3600); // m/s
        const jumpLimit = MAX_JUMP_PER_HOUR_M * dtHours;

        // must satisfy both a speed cap and an absolute jump limit
        if (speed <= MAX_SPEED_MS && d <= jumpLimit && d < bestD) {
          bestD = d; bestK = k;
        }
      }
      if (bestK >= 0) {
        tracks[bestK].pts.push({ id: tracks[bestK].id, ...p });
        used.add(bestK);
      } else {
        const id = `b${nextId++}`;
        tracks.push({ id, pts: [{ id, ...p }] });
      }
    }
  }

  // Keep tracks with 2+ points so polylines render
  const out: Record<string, TrackPoint[]> = {};
  for (const tr of tracks) if (tr.pts.length >= 2) out[tr.id] = tr.pts.sort((a,b)=>a.t.localeCompare(b.t));
  return out;
}

export async function fetch24h(): Promise<Record<string, TrackPoint[]>> {
  // Try 00..23; some hours may 404 → null frames
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const frames: Omit<TrackPoint,"id">[][] = [];
  const ages: number[] = [];

  const results = await Promise.all(hours.map(fetchHour));
  results.forEach((payload, idx) => {
    if (!payload) return;
    const pts = parseAsPoints(payload, idx);
    if (pts.length) { frames.push(pts); ages.push(idx); }
  });

  return stitchTracks(frames, ages);
}
