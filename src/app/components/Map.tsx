// at top
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

// If you used typed dynamic imports (Option A)
import type {
  MapContainerProps,
  TileLayerProps,
  PolylineProps,
  TooltipProps,
} from "react-leaflet";
import type { LatLngTuple } from "leaflet";

const MapContainer = dynamic<MapContainerProps>(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic<TileLayerProps>(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Polyline = dynamic<PolylineProps>(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false }
);
const Tooltip = dynamic<TooltipProps>(
  () => import("react-leaflet").then((m) => m.Tooltip),
  { ssr: false }
);

const WORLD_CENTER: LatLngTuple = [20, 0];



// helper to build a tiny arrow from wind u,v (m/s) around lat,lon
function arrowFromUV(
  lat: number,
  lon: number,
  u: number,
  v: number,
  scale = 4000
) {
  // convert meters to deg approx
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const x = (u * scale) / mPerDegLon; // east-west
  const y = (v * scale) / mPerDegLat; // north-south
  const tip: [number, number] = [lat + y, lon + x];
  const tail: [number, number] = [lat - y, lon - x];
  return { tail, tip };
}

type Track = { id: string; t: string; lat: number; lon: number; alt?: number };

export default function Map() {
  const [data, setData] = useState<Record<string, Track[]>>({});
  const [maxTracks, setMaxTracks] = useState(150);
  const [minSegs, setMinSegs] = useState(4);
  const [thinMeters, setThinMeters] = useState(30000);
  const [maxSpeedMs, setMaxSpeedMs] = useState(90);

  // winds UI state
  const [showWinds, setShowWinds] = useState(true);
  const [pressure, setPressure] = useState("700"); // 700, 500, 300

  async function load() {
    const res = await fetch("/api/telemetry", { cache: "no-store" });
    const json = await res.json();
    setData(json.data ?? {});
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // choose tracks and segments exactly as you already do...
  // assume you kept the scoring/thinning code from our last message
  // here we also compute midpoints for wind sampling:

  const { polylines, mids } = useMemo(() => {
    // --- compute selected tracks as before (scoring/thinning) ---
    const thin = (pts: Track[], minDistM: number) => {
      if (!pts.length) return pts;
      const out: Track[] = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const a = out[out.length - 1],
          b = pts[i];
        const d = haversine(a.lat, a.lon, b.lat, b.lon);
        if (d >= minDistM) out.push(b);
      }
      return out;
    };

    const scored = Object.entries(data).map(([id, pts]) => {
      const th = thin(pts, thinMeters);
      let dist = 0;
      for (let i = 1; i < th.length; i++)
        dist += haversine(th[i - 1].lat, th[i - 1].lon, th[i].lat, th[i].lon);
      return { id, pts: th, score: dist };
    });

    const picked = scored
      .filter((t) => t.pts.length >= minSegs + 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxTracks);

    // map polylines
    const lines = picked.flatMap(({ id, pts }) => {
      const segs = segmentSpeeds(pts).filter((s) => s.speed <= maxSpeedMs);
      return segs.map((s) => {
        const a = pts[s.from],
          b = pts[s.to];
        return (
          <Polyline
            key={`${id}-${s.from}`}
            positions={[
              [a.lat, a.lon],
              [b.lat, b.lon],
            ]}
            pathOptions={{
              color: colorForSpeed(s.speed),
              weight: 2,
              opacity: 0.55,
            }}
          >
            <Tooltip>
              <div>
                <div>
                  <b>Balloon</b> {id}
                </div>
                <div>
                  <b>Speed</b> {(s.speed * 3.6).toFixed(1)} km h^-1
                </div>
                <div>
                  <b>Time</b> {new Date(b.t).toUTCString()}
                </div>
                {typeof b.alt === "number" && (
                  <div>
                    <b>Alt</b> {b.alt} m
                  </div>
                )}
              </div>
            </Tooltip>
          </Polyline>
        );
      });
    });

    // pick midpoints (one per track)
    const mids = picked.map(({ pts }) => {
  return pts[Math.floor(pts.length / 2)]; // ✅ mid already has .id
});

    return { polylines: lines, mids };
  }, [data, maxTracks, minSegs, thinMeters, maxSpeedMs]);

  // fetch winds for midpoints when toggled/pressure changes
  const [winds, setWinds] = useState<
    Record<
      string,
      { u: number; v: number; speed: number; dir: number; time: string }
    >
  >({});
  useEffect(() => {
    if (!showWinds) {
      setWinds({});
      return;
    }
    (async () => {
      const entries = await Promise.all(
        mids.map(async (m) => {
          const url = `/api/wind?lat=${m.lat}&lon=${
            m.lon
          }&t=${encodeURIComponent(m.t)}&pressure=${pressure}`;
          const res = await fetch(url, { cache: "no-store" });
          const { ok, wind } = await res.json();
          return [m.id, ok && wind ? wind : null] as const;
        })
      );
      const obj: any = {};
      for (const [id, w] of entries) if (w) obj[id] = w;
      setWinds(obj);
    })();
  }, [showWinds, pressure, mids]);

  // wind overlay arrows
  const windArrows = useMemo(() => {
    if (!showWinds) return null;
    return mids.flatMap((m) => {
      const w = winds[m.id];
      if (!w) return [];
      const { tail, tip } = arrowFromUV(m.lat, m.lon, w.u, w.v, 6000);
      return (
        <Polyline
          key={`wind-${m.id}`}
          positions={[tail, tip]}
          pathOptions={{ color: "#0066ff", weight: 2, opacity: 0.8 }}
        >
          <Tooltip>
            <div>
              <div>
                <b>Wind</b> {pressure} hPa
              </div>
              <div>
                <b>Speed</b> {w.speed.toFixed(1)} m s^-1
              </div>
              <div>
                <b>Dir</b> {w.dir.toFixed(0)} deg
              </div>
              <div>
                <b>Time</b> {new Date(w.time).toUTCString()}
              </div>
            </div>
          </Tooltip>
        </Polyline>
      );
    });
  }, [mids, winds, showWinds, pressure]);

  return (
    <div className="w-full h-[85vh]">
      <p style={{ fontSize: 12, opacity: 0.7, margin: "6px 0" }}>
        Balloons {Object.keys(data).length} • Points{" "}
        {Object.values(data).reduce(
          (n: number, arr: any[]) => n + arr.length,
          0
        )}
      </p>

      {/* controls */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 8,
          fontSize: 12,
        }}
      >
        <label>
          Top tracks{" "}
          <input
            type="number"
            value={maxTracks}
            onChange={(e) => setMaxTracks(+e.target.value)}
            style={{ width: 70, marginLeft: 6 }}
          />
        </label>
        <label>
          Min segments{" "}
          <input
            type="number"
            value={minSegs}
            onChange={(e) => setMinSegs(+e.target.value)}
            style={{ width: 60, marginLeft: 6 }}
          />
        </label>
        <label>
          Thinning m{" "}
          <input
            type="number"
            value={thinMeters}
            onChange={(e) => setThinMeters(+e.target.value)}
            style={{ width: 80, marginLeft: 6 }}
          />
        </label>
        <label>
          Max speed m s^-1{" "}
          <input
            type="number"
            value={maxSpeedMs}
            onChange={(e) => setMaxSpeedMs(+e.target.value)}
            style={{ width: 80, marginLeft: 6 }}
          />
        </label>
        <label style={{ marginLeft: 12 }}>
          <input
            type="checkbox"
            checked={showWinds}
            onChange={(e) => setShowWinds(e.target.checked)}
          />{" "}
          Show winds
        </label>
        <label>
          Pressure
          <select
            value={pressure}
            onChange={(e) => setPressure(e.target.value)}
            style={{ marginLeft: 6 }}
          >
            <option value="700">700 hPa</option>
            <option value="500">500 hPa</option>
            <option value="300">300 hPa</option>
          </select>
        </label>
      </div>

      <MapContainer center={WORLD_CENTER} zoom={2} style={{ height: "100%", width: "100%" }}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  {polylines}
  {windArrows}
</MapContainer>

    </div>
  );
}
