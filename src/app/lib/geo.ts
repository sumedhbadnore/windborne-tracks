const R = 6371e3
export function haversine(lat1:number, lon1:number, lat2:number, lon2:number) {
  const toRad = (d:number)=> d*Math.PI/180
  const dphi = toRad(lat2-lat1), dl = toRad(lon2-lon1)
  const a = Math.sin(dphi/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dl/2)**2
  return 2*R*Math.asin(Math.sqrt(a))
}
export function segmentSpeeds(points:{lat:number,lon:number,t:string}[]) {
  const out:{speed:number, from:number, to:number}[] = []
  for (let i=1;i<points.length;i++){
    const d = haversine(points[i-1].lat, points[i-1].lon, points[i].lat, points[i].lon)
    const dt = (new Date(points[i].t).getTime()-new Date(points[i-1].t).getTime())/1000
    if (dt<=0) continue
    out.push({ speed: d/dt, from:i-1, to:i }) // m s^-1
  }
  return out
}
export function colorForSpeed(ms:number){
  if (ms<5) return "#4CAF50"
  if (ms<15) return "#FFC107"
  if (ms<30) return "#FF9800"
  return "#F44336"
}
