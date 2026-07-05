export default async function handler(req, res) {
  const { q } = req.query
  if (!q || q.trim().length < 3) return res.status(400).json([])

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'QuestMaster/1.0 (questmaster-rouge.vercel.app)' },
    })
    if (!upstream.ok) return res.status(502).json([])
    const data = await upstream.json()
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.json(data.map(r => ({ lat: r.lat, lon: r.lon, display_name: r.display_name })))
  } catch {
    res.status(502).json([])
  }
}
