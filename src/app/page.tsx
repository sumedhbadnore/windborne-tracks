// src/app/page.tsx
import Map from "./components/Map";

export default function Page() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-600/15 via-cyan-500/5 to-fuchsia-600/10 blur-2xl"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              BalloonTracks <span className="text-neutral-400 text-3xl">- 24H Live Constellation</span>
            </h1>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-600/15 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-600/30">
                Live
              </span>
              <span className="inline-flex items-center rounded-full bg-sky-600/10 px-3 py-1 text-xs font-medium text-sky-300 ring-1 ring-sky-500/30">
                Refresh 5 min
              </span>
              <span className="inline-flex items-center rounded-full bg-orange-600/10 px-3 py-1 text-xs font-medium text-orange-300 ring-1 ring-orange-500/30">
                Speed-colored
              </span>
            </div>
          </div>

          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-300">
            Mission-control view of WindBorne balloon tracks over the last 24 hours. Hover any segment for speed, time,
            and altitude. Toggle wind vectors by pressure level to explain drift and spikes.
          </p>
          <p className="text-yellow-300"> This site is work in progress!</p>
        </div>
      </section>

      {/* Map frame */}
      <section className="px-2 sm:px-4 pb-6">
        <div className="mx-auto max-w-[1600px] rounded-xl border border-neutral-800 bg-neutral-900/40 shadow-lg ring-1 ring-black/5 overflow-hidden">
          <Map />
        </div>
      </section>
    </main>
  );
}
