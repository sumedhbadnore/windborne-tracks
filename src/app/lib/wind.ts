// Open-Meteo pressure-level winds near a point and time window
export async function fetchWinds(lat: number, lon: number, start: string, end: string, pressure="700") {
  const url = new URL("https://api.open-meteo.com/v1/forecast")
  url.searchParams.set("latitude", String(lat))
  url.searchParams.set("longitude", String(lon))
  url.searchParams.set("hourly", `u_component_of_wind_${pressure}hPa,v_component_of_wind_${pressure}hPa`)
  url.searchParams.set("start_hour", new Date(start).toISOString())
  url.searchParams.set("end_hour", new Date(end).toISOString())
  url.searchParams.set("timezone", "UTC")
  const res = await fetch(url.toString(), { cache: "no-store" })
  if (!res.ok) return null
  return res.json()
}
