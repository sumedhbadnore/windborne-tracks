// src/app/api/telemetry/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { fetch24h } from "../../lib/telemetry";

export async function GET() {
  const data = await fetch24h();
  const balloons = Object.keys(data).length;
  const points = Object.values(data).reduce((n, a) => n + a.length, 0);
  console.log("[telemetry]", { balloons, points });
  return NextResponse.json({ ok: true, data }, { status: 200 });
}
