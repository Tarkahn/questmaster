export const config = { maxDuration: 20 }

const BBOX_RE = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/

export default async function handler(req, res) {
  const { bbox } = req.query
  if (!bbox || !BBOX_RE.test(bbox)) {
    return res.status(400).json({ error: 'Invalid bbox' })
  }

  // Use a short Overpass timeout so we finish inside Vercel's function budget
  const query = `[out:json][timeout:12];way["building"](${bbox});out geom;`
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'QuestMaster/1.0 (questmaster-rouge.vercel.app)' },
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return res.status(502).json({
        error: `Overpass HTTP ${upstream.status}`,
        detail: text.slice(0, 300),
      })
    }

    const data = await upstream.json()
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
}
