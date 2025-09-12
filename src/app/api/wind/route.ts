export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { fetchWindAtPoint } from "../../lib/wind";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const t   = url.searchParams.get("t") ?? new Date().toISOString();
  const p   = url.searchParams.get("pressure") ?? "700";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ ok: false, error: "lat and lon required" }, { status: 400 });
  }

  const wind = await fetchWindAtPoint(lat, lon, t, p);
  return NextResponse.json({ ok: !!wind, wind }, { status: 200 });
}
