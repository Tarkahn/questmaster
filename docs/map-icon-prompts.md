# QuestMaster — Map Building Icon Prompts

Working reference for generating the 16 building pin icons used on the World Map
(`src/components/WorldMap.jsx`). Edit this file as prompts get refined or as new
building types are added.

## Asset target

- Path pattern: `public/buildings/{type}-{size}.png`
- Sizes: `sm` (64×64 in-app), `md`, `lg` — generate at **896×896 (1:1, Small)** in
  Leonardo and downscale/export per size as needed.
- ✅ = asset exists, ⬜ = still a placeholder/emoji in the app.

## Leonardo.ai settings (locked for consistency)

| Setting | Value |
|---|---|
| Model | Phoenix 1.0 |
| Reference mode | **Style Reference** → `tavern-sm.png` |
| Prompt Enhance | **Off** (avoid drift across a 16-icon set) |
| Style | Dynamic *(re-check against tavern on first test batch — see note below)* |
| Contrast | Medium |
| Generation Mode | Fast (switch to Quality for final keepers) |
| Dimensions | 1:1, Small (896×896) |
| Generations per prompt | 4 |

> Note: confirm "Dynamic" actually matches the tavern's look before running the
> full batch — if the tavern reads flatter/more illustrative, try "Illustration"
> or no style preset and let the Style Reference carry it.

## Building prompts

Each prompt below is ready to paste directly into Leonardo.ai — no suffix needed.

| Type | Status | Display Name | Full prompt (copy/paste ready) |
|---|---|---|---|
| `tavern` | ✅ done (reference) · 🎬 animated `.webp` (256px v2 pipeline, 2026-07-04) | Tavern | Viewed from a slight bird's eye overhead angle, a cozy two-story wooden tavern with a thatched roof, warm glowing windows, a hanging wooden sign, and a stone chimney with smoke curling up, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `keep` | ✅ done | Keep | Viewed from a slight bird's eye overhead angle, a small stone keep with a single squat tower, an arched wooden door, narrow windows, and a fluttering banner, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `temple` | ✅ done | Temple | Viewed from a slight bird's eye overhead angle, a small stone temple with a domed roof, carved pillars at the entrance, a stained glass window, and a glowing sigil above the door, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `market` | ✅ done | Market | Viewed from a slight bird's eye overhead angle, a bustling open-air market stall with a striped canvas awning, wooden crates and baskets of goods, and hanging lanterns, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `scriptorium` | ✅ done | Scriptorium | Viewed from a slight bird's eye overhead angle, a tall narrow stone building with arched windows full of bookshelves, a round tower with a spiral staircase visible through glass, ivy climbing the walls, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `tower` | ✅ done | Mage Tower | Viewed from a slight bird's eye overhead angle, a tall slender wizard's tower with a conical purple-roofed top, glowing arcane runes etched into the stone, a single round window glowing with magical light, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `barracks` | ✅ done | Barracks | Viewed from a slight bird's eye overhead angle, a sturdy wooden barracks with a low sloped roof, crossed swords mounted above the entrance, training dummies outside, stone foundation, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `grove` | ✅ done | Grove | Viewed from a slight bird's eye overhead angle, a small fantasy grove with a massive ancient tree at its center, glowing fireflies, a mossy stone path, and a wooden archway entrance, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `docks` | ✅ done | Docks | Viewed from a slight bird's eye overhead angle, a wooden dock building with a small pier extending into water, coiled rope, lanterns on posts, and a moored rowboat, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `waypoint` | ✅ done | Waypoint | Viewed from a slight bird's eye overhead angle, a stone waypoint shrine with a carved obelisk, glowing runes, a signpost with carved directional arrows, and a small flickering torch, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `forge` | ✅ done | Forge | Viewed from a slight bird's eye overhead angle, a sturdy stone and timber blacksmith's forge with a tall chimney billowing smoke and sparks, an anvil and tools outside, warm orange glow from within, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `apothecary` | ✅ done | Apothecary | Viewed from a slight bird's eye overhead angle, a small crooked timber-framed apothecary shop with shelves of glowing potion bottles visible through the window, dried herbs hanging outside, a single chimney, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `guildhall` | ✅ done | Guild Hall | Viewed from a slight bird's eye overhead angle, a grand timber and stone guild hall with a large double door, a hanging emblem banner, multiple chimneys, two stories with balconies, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `citadel` | ✅ done | Citadel | Viewed from a slight bird's eye overhead angle, an imposing stone citadel with high crenellated walls, twin flanking towers, a large iron-banded gate, and fluttering flags atop each tower, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `inn` | ✅ done | Wayfarer's Inn | Viewed from a slight bird's eye overhead angle, a welcoming multi-story inn with a wraparound wooden porch, warm lantern light in every window, a swinging wooden sign, and smoke from the chimney, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |
| `stables` | ✅ done | Stables | Viewed from a slight bird's eye overhead angle, a long low wooden stable with a hayloft, an open stable door showing a horse stall, a wooden fence, and a hay bale outside, painted fantasy RPG game icon, single isolated building, slight bird's eye overhead angle, three-quarter top-down view, transparent background, soft directional lighting, rich warm color palette, clean detailed linework, no text, no watermark, no UI elements |

## Workflow

1. Copy the full prompt from the row you want — paste directly into Leonardo.ai.
2. Generate 4 with Style Reference pointed at `tavern-sm.png`.
3. Pick the best match, save to `public/buildings/{type}-sm.png` via `/add-building-icon`.
4. Flip the status to ✅ in this table.
5. If a prompt needs tweaking after seeing results, edit its row directly —
   this file is the source of truth.
