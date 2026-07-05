// Current weather for the map's weather animations — Open-Meteo is free, needs
// no signup/API key, and has no meaningful rate limit for a personal app like
// this, so there's no subscription or key management to deal with.
const CODE_TO_CONDITION = {
  0: 'clear',
  1: 'partly-cloudy', 2: 'partly-cloudy',
  3: 'overcast',
  45: 'fog', 48: 'fog',
  51: 'rain', 53: 'rain', 55: 'rain', 56: 'rain', 57: 'rain',
  61: 'rain', 63: 'rain', 65: 'rain', 66: 'rain', 67: 'rain',
  80: 'rain', 81: 'rain', 82: 'rain',
  71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow', 85: 'snow', 86: 'snow',
  95: 'storm', 96: 'storm', 99: 'storm',
}

export default async function handler(req, res) {
  const { lat, lng } = req.query
  const latNum = parseFloat(lat)
  const lngNum = parseFloat(lng)
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return res.status(400).json({ error: 'lat and lng are required' })
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lngNum}&current_weather=true`
    const upstream = await fetch(url)
    if (!upstream.ok) return res.status(502).json({ error: 'lookup failed' })
    const data = await upstream.json()
    const code = data.current_weather?.weathercode
    const condition = CODE_TO_CONDITION[code] || 'clear'
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800')
    res.json({ condition, isDay: data.current_weather?.is_day === 1 })
  } catch {
    res.status(502).json({ error: 'lookup failed' })
  }
}
