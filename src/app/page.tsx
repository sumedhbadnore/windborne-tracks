// server component (default)
import Map from "./components/Map";

export default function Page() {
  return (
    <main className="p-4">
      <h1>BalloonTracks — Live 24H Constellation</h1>
      <p>Speed-colored tracks, per-segment tooltips, updates every 5 minutes.</p>
      <Map />
    </main>
  );
}
