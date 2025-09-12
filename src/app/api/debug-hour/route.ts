export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const hh = (new URL(req.url).searchParams.get("hh") ?? "00").padStart(2, "0");
  const url = `https://a.windbornesystems.com/treasure/${hh}.json?ts=${Date.now()}`;
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      "user-agent": "BalloonTracks/1.0 (+sumedh)",
      "accept": "application/json, text/plain, */*",
      "referer": "https://windbornesystems.com/",
      "origin": "https://windbornesystems.com"
    }
  }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) } as any));

  const text = await res.text();
  const ct = (res as any).headers?.get?.("content-type") ?? "";
  return NextResponse.json({
    ok: res.ok,
    status: (res as any).status ?? 0,
    contentType: ct,
    length: text.length,
    head: text.slice(0, 500)   // first 500 chars so we can see shape or HTML error
  });
}
