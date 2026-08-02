import { authenticate } from './_auth.js'
import { checkQuota } from './_rateLimit.js'
import { callAI, isAIConfigured, textOf, extractJson } from './_ai.js'

const SUBTASKS_SCHEMA = {
  name: 'subtasks',
  schema: {
    type: 'object',
    properties: { subtasks: { type: 'array', items: { type: 'string' } } },
    required: ['subtasks'],
    additionalProperties: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = await authenticate(req)
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message })
  }
  const quota = await checkQuota(auth.userId)
  if (!quota.allowed) {
    return res.status(429).json({ error: 'Daily AI usage cap reached' })
  }

  const { title, notes } = req.body || {}

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Missing title' })
  }

  if (!isAIConfigured()) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  const prompt = `An adventurer has a quest (task) they want to break into smaller, concrete side quests (subtasks).

Quest: "${title}"${notes ? `\nDetails: ${notes}` : ''}

Break this quest into 3 to 5 smaller, concrete, actionable steps. Each step should be a single clear action, written in plain everyday language (NOT fantasy-themed — keep them practical so the user knows exactly what to do). Each step should be short (under 10 words).

Only break it down if it genuinely has natural sub-steps. If the quest is already a single atomic action that can't meaningfully be split, return an empty array.

Return ONLY valid JSON in exactly this shape:
{ "subtasks": ["first step", "second step", "third step"] }`

  try {
    const data = await callAI({
      prompt,
      maxTokens: 400,
      openaiMaxTokens: 2048,
      jsonSchema: SUBTASKS_SCHEMA,
    })

    const text = textOf(data)
    const parsed = extractJson(text)
    const subtasks = Array.isArray(parsed?.subtasks)
      ? parsed.subtasks.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()).slice(0, 5)
      : []
    return res.status(200).json({ subtasks })
  } catch {
    return res.status(200).json({ subtasks: [] })
  }
}
