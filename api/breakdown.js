export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { title, notes } = req.body || {}

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Missing title' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  const prompt = `An adventurer has a quest (task) they want to break into smaller, concrete side quests (subtasks).

Quest: "${title}"${notes ? `\nDetails: ${notes}` : ''}

Break this quest into 3 to 5 smaller, concrete, actionable steps. Each step should be a single clear action, written in plain everyday language (NOT fantasy-themed — keep them practical so the user knows exactly what to do). Each step should be short (under 10 words).

Only break it down if it genuinely has natural sub-steps. If the quest is already a single atomic action that can't meaningfully be split, return an empty array.

Return ONLY valid JSON in exactly this shape:
{ "subtasks": ["first step", "second step", "third step"] }`

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!anthropicRes.ok) throw new Error('Anthropic error')

    const data = await anthropicRes.json()
    const text = data.content?.[0]?.text?.trim() || ''

    try {
      const match = text.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match?.[0] || text)
      const subtasks = Array.isArray(parsed.subtasks)
        ? parsed.subtasks.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()).slice(0, 5)
        : []
      return res.status(200).json({ subtasks })
    } catch {
      return res.status(200).json({ subtasks: [] })
    }
  } catch {
    return res.status(200).json({ subtasks: [] })
  }
}
