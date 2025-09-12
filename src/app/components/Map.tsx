"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { segmentSpeeds, colorForSpeed, haversine } from "../lib/geo";

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
const Polyline     = dynamic(() => import("react-leaflet").then(m => m.Polyline), { ssr: false });
const Tooltip      = dynamic(() => import("react-leaflet").then(m => m.Tooltip), { ssr: false });

type Track = { id: string; t: string; lat: number; lon: number; alt?: number };

// keep your fetch of /api/telemetry as-is ...

// simple vertex thinning: keep a point only if far enough from last kept
function thin(points: Track[], minDistM: number) {
  if (!points.length) return points;
  const out: Track[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = out[out.length - 1], b = points[i];
    const d = haversine(a.lat, a.lon, b.lat, b.lon);
    if (d >= minDistM) out.push(b);
  }
  return out;
}

export default function Map() {
  const [data, setData] = useState<Record<string, Track[]>>({});
  const [maxTracks, setMaxTracks] = useState(150);
  const [minSegs, setMinSegs] = useState(3);
  const [thinMeters, setThinMeters] = useState(25000); // 25 km
  const [maxSpeedMs, setMaxSpeedMs] = useState(100);   // clip crazy segments client-side

  async function load() {
    const res = await fetch("/api/telemetry", { cache: "no-store" });
    const json = await res.json();
    setData(json.data ?? {});
  }
  useEffect(() => { load(); const id = setInterval(load, 5 * 60 * 1000); return () => clearInterval(id); }, []);

  const layers = useMemo(() => {
    // compute “score” = total length after thinning, keep top N
    const scored = Object.entries(data).map(([id, pts]) => {
      const th = thin(pts, thinMeters);
      let dist = 0;
      for (let i = 1; i < th.length; i++) {
        dist += haversine(th[i - 1].lat, th[i - 1].lon, th[i].lat, th[i].lon);
      }
      return { id, pts: th, score: dist };
    });

    const picked = scored
      .filter(t => t.pts.length >= (minSegs + 1))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxTracks);

    // draw segments with opacity + speed clipping
    return picked.flatMap(({ id, pts }) => {
      const segs = segmentSpeeds(pts).filter(s => s.speed <= maxSpeedMs);
      return segs.map(s => {
        const a = pts[s.from], b = pts[s.to];
        return (
          <Polyline
            key={`${id}-${s.from}`}
            positions={[[a.lat, a.lon], [b.lat, b.lon]]}
            pathOptions={{ color: colorForSpeed(s.speed), weight: 2, opacity: 0.55 }}
          >
            <Tooltip>
              <div>
                <div><b>Balloon</b> {id}</div>
                <div><b>Speed</b> {(s.speed * 3.6).toFixed(1)} km h^-1</div>
                <div><b>Time</b> {new Date(b.t).toUTCString()}</div>
                {typeof b.alt === "number" && <div><b>Alt</b> {b.alt} m</div>}
              </div>
            </Tooltip>
          </Polyline>
        );
      });
    });
  }, [data, maxTracks, minSegs, thinMeters, maxSpeedMs]);

  return (
    <div className="w-full h-[85vh]">
      {/* tiny stats */}
      <p style={{ fontSize: 12, opacity: 0.7, margin: "6px 0" }}>
        Balloons {Object.keys(data).length} • Points {
          Object.values(data).reduce((n: number, arr: any[]) => n + arr.length, 0)
        }
      </p>

      {/* simple controls */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8, fontSize: 12 }}>
        <label>Top tracks
          <input type="number" min={20} max={1000} step={10}
            value={maxTracks} onChange={e => setMaxTracks(Number(e.target.value))} style={{ marginLeft: 6, width: 70 }}/>
        </label>
        <label>Min segments
          <input type="number" min={1} max={20} step={1}
            value={minSegs} onChange={e => setMinSegs(Number(e.target.value))} style={{ marginLeft: 6, width: 60 }}/>
        </label>
        <label>Thinning m
          <input type="number" min={0} step={5000}
            value={thinMeters} onChange={e => setThinMeters(Number(e.target.value))} style={{ marginLeft: 6, width: 80 }}/>
        </label>
        <label>Max speed m s^-1
          <input type="number" min={10} max={200} step={10}
            value={maxSpeedMs} onChange={e => setMaxSpeedMs(Number(e.target.value))} style={{ marginLeft: 6, width: 80 }}/>
        </label>
      </div>

      <MapContainer center={[20, 0]} zoom={2} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        {layers}
      </MapContainer>
    </div>
  );
}
