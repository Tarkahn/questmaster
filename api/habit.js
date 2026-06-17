export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, habit, boss, hpRemaining } = req.body || {}

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  let prompt

  if (action === 'create') {
    prompt = `The adventurer wants to build this daily habit: "${habit}"

Create a D&D-themed version of this habit. Return ONLY valid JSON with exactly these fields:
{
  "themedTitle": "D&D name for the habit quest (under 7 words)",
  "bossName": "name of the boss that embodies resistance to this habit (2-5 words, menacing)",
  "bossDescription": "2 sentences. Describe the boss's nature and how it embodies the obstacle to this habit. Dramatic, D&D-flavored."
}

Examples:
- "exercise every morning" → {"themedTitle": "Train at the Iron Keep", "bossName": "The Sloth Colossus", "bossDescription": "..."}
- "meditate daily" → {"themedTitle": "Commune with the Inner Sanctum", "bossName": "The Mind Wraith", "bossDescription": "..."}
- "read before bed" → {"themedTitle": "Study the Ancient Tomes", "bossName": "Baron Von Distraction", "bossDescription": "..."}`

  } else if (action === 'progress') {
    const hpPercent = Math.round((hpRemaining / 66) * 100)
    let phase
    if (hpPercent > 75) phase = 'The boss is dominant and barely notices your strikes. It mocks your efforts.'
    else if (hpPercent > 50) phase = 'The boss is strong but beginning to show signs of strain. Your persistence is making an impact.'
    else if (hpPercent > 25) phase = 'The boss is visibly weakened and desperate. Victory is within reach.'
    else phase = 'The boss is on the brink of defeat, its power almost entirely broken by your discipline.'

    prompt = `The adventurer just completed their daily habit: "${habit}"
Boss: ${boss} — ${hpRemaining}/66 HP remaining
Situation: ${phase}

Write exactly 2 sentences of D&D battle narrative for this moment. Reference the boss weakening. Be vivid and specific. Return ONLY the narrative text.`

  } else if (action === 'defeat') {
    prompt = `The adventurer has finally defeated ${boss} after 66 days of disciplined effort on their habit: "${habit}"

Write 3 triumphant sentences of D&D victory narrative. The boss is vanquished. The habit is formed. Return ONLY the narrative text.`

  } else {
    return res.status(400).json({ error: 'Invalid action' })
  }

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
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!anthropicRes.ok) throw new Error('Anthropic error')

    const data = await anthropicRes.json()
    const text = data.content?.[0]?.text?.trim() || ''

    if (action === 'create') {
      try {
        const match = text.match(/\{[\s\S]*\}/)
        const parsed = JSON.parse(match?.[0] || text)
        return res.status(200).json(parsed)
      } catch {
        return res.status(200).json({
          themedTitle: habit,
          bossName: 'The Ancient Nemesis',
          bossDescription: 'A primordial force of resistance born from years of inaction. Only daily discipline can bring it low.',
        })
      }
    }

    return res.status(200).json({ narrative: text })

  } catch {
    if (action === 'create') {
      return res.status(200).json({
        themedTitle: habit,
        bossName: 'The Ancient Nemesis',
        bossDescription: 'A primordial force of resistance born from years of inaction. Only daily discipline can bring it low.',
      })
    }
    return res.status(200).json({ narrative: 'You press onward. The boss weakens with every step.' })
  }
}
