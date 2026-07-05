// IP-based location fallback for when the browser/OS Geolocation API is
// unavailable or stuck (e.g. macOS's WiFi-based location daemon failing to
// produce a fresh fix). City-level accuracy only, but doesn't depend on any
// OS permission or location service being healthy.
export default async function handler(req, res) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()

  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,lat,lon,city`
    const upstream = await fetch(url)
    if (!upstream.ok) return res.status(502).json({ error: 'lookup failed' })
    const data = await upstream.json()
    if (data.status !== 'success') return res.status(404).json({ error: 'no location for this ip' })
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
    res.json({ lat: data.lat, lng: data.lon, city: data.city })
  } catch {
    res.status(502).json({ error: 'lookup failed' })
  }
}
