# Cinder Cell

A turn-based roguelite. Raid four occupied districts, lose operatives, keep the Resolve they earned, and liberate the yard.

## Files

| File | What it holds |
|---|---|
| `index.html` | Every screen, the styles, and input handling |
| `engine.js` | Game rules: combat, statuses, rooms, events, contracts, saving. No DOM, so the simulator can run it |
| `data.js` | All content: enemies, signature moves, bosses, maps, gear, implants, perks, events, contracts. Rename things here to re-theme |
| `stage.js` | The animated battle scene, boss intros, and the sprite-sheet loader |
| `audio.js` | Synthesised sound effects and ambience (Web Audio, no sound files) |
| `portraits.js` | Code-drawn fallback sprites for characters without a PixelLab sheet |
| `sprites/` | PixelLab sheets plus `manifest.json`. A character with a sheet uses it automatically |
| `sim.mjs` | Balance simulator: a bot plays many full campaigns and reports the progression curve |

## Balance

Difficulty knobs live in `TUNE` at the top of `engine.js`. After changing them, run:

```bash
node sim.mjs 100 30
MAP=port node sim.mjs 50 40
```

Current targets for the careful bot: the first boss falls around operative 2–3, sector 10 around operative 6, and the sector-15 finales between operative 11 and 22 depending on the map. Human players are slower.

## Adding sprites

Drop `sprites/<id>/<animation>.png` strips in and add the character to `sprites/manifest.json` (see the existing entries). Animations used: idle, attack, charge, hit, defend, repair, death.
