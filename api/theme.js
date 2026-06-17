const BASE_SYSTEM_PROMPT = `You are the official scribe of QuestMaster, a Dungeons & Dragons 5th Edition adventure chronicle. Convert modern tasks and calendar events into authentic D&D language, and classify each item's difficulty.

TONE: Classic D&D 5e campaign setting — guilds, keeps, taverns, clerics, paladins, rogues, arcane magic, gold pieces, potions. Do NOT use Tolkien language. Do NOT use Game of Thrones language. Strictly D&D adventure style.

DIFFICULTY CLASSIFICATION:
- "normal"    → Routine tasks, quick errands, social events, easy meetings
- "hard"      → Mentally demanding work, stressful obligations, complex admin, things requiring focus
- "legendary" → Major projects, things you dread, high-stakes deliverables, intense physical or mental effort

RULES:
1. Keep each themed title under 10 words.
2. Preserve the core meaning — the adventurer must still know what the real task is.
3. Capitalize D&D proper nouns: the Apothecary, the Guild Hall, the Grand Academy.
4. Apply the Vocabulary Glossary exactly. Do not invent synonyms for defined terms.
5. NAME RULE: Keep first name, add D&D epithet by role. "call John (architect)" → "commune with John the Grand Builder". No role known → add "the Bold", "the Wise", or "the Swift".
6. NOTES: Some items include a "(notes: ...)" line beneath the title — use it as context to inform a more accurate theming (specific role, apothecary, type of meeting). NEVER include the notes verbatim in the themed title; the title stays a short headline.
7. Return only valid JSON — no explanation, no preamble.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { items, glossary } = req.body || {}
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    const themes = {}
    const difficulties = {}
    items.forEach(item => { themes[item.id] = item.title; difficulties[item.id] = 'normal' })
    return res.status(200).json({ themes, difficulties })
  }

  const systemPrompt = glossary
    ? `${BASE_SYSTEM_PROMPT}\n\nVOCABULARY GLOSSARY (use these exact translations):\n${glossary}`
    : BASE_SYSTEM_PROMPT

  const numbered = items.map((item, i) => {
    let line = `${i + 1}. ${item.title}`
    if (item.notes && typeof item.notes === 'string') {
      const trimmed = item.notes.trim().slice(0, 240)
      if (trimmed) line += `\n   (notes: ${trimmed})`
    }
    return line
  }).join('\n')

  let anthropicRes
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        temperature: 0,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Convert each item and classify its difficulty. Return ONLY a JSON object with two arrays of the same length:

${numbered}

Reply with only this JSON:
{
  "themes": ["D&D title 1", "D&D title 2", ...],
  "difficulties": ["normal|hard|legendary", ...]
}`,
        }],
      }),
    })
  } catch {
    const themes = {}
    const difficulties = {}
    items.forEach(item => { themes[item.id] = item.title; difficulties[item.id] = 'normal' })
    return res.status(200).json({ themes, difficulties })
  }

  if (!anthropicRes.ok) {
    const themes = {}
    const difficulties = {}
    items.forEach(item => { themes[item.id] = item.title; difficulties[item.id] = 'normal' })
    return res.status(200).json({ themes, difficulties })
  }

  const data = await anthropicRes.json()
  const text = data.content?.[0]?.text?.trim() || '{}'

  let parsed = { themes: [], difficulties: [] }
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) parsed = JSON.parse(match[0])
  } catch {}

  const themes = {}
  const difficulties = {}
  items.forEach((item, i) => {
    themes[item.id] = (parsed.themes?.[i] && parsed.themes[i].trim()) || item.title
    const d = parsed.difficulties?.[i]
    difficulties[item.id] = ['normal', 'hard', 'legendary'].includes(d) ? d : 'normal'
  })

  return res.status(200).json({ themes, difficulties })
}
