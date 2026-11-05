# Kessa Yard town art: checklist

Style: an original dusty frontier spaceport, built to match the container shop (`buildings/market.png`). Nothing here uses franchise designs.

## Characters (`chars/<id>/<anim>_<dir>.png`)
Frames are 64×64 with a transparent background. Characters are 39–43 px tall (the kid is 30). The lowest pixel of every frame is on row 59, which leaves the feet 4 px above the bottom. The centre of the head and shoulders stays within 3 px across each strip.

| char | anims | result |
|---|---|---|
| player | idle (4f) and walk (6f) in down/up/left/right | ✓ all 8 strips pass |
| patrol | idle_down (4f), walk (6f) in 4 directions | ✓ |
| marrow, ilse, handler, dispatcher, worker, kid, vendor | idle_down (4f) | ✓ |

Checks run on every strip: frame size, frame count, alpha strictly 0/255, 4 px baseline, drift. Result: **ALL OK** (20 strips).

## Tiles (`tiles/town.png`, 384×128, 32 px grid, 12 columns)
There are three complete corner-matching (Wang) sets of 16 tiles each, so every one of the 16 corner combinations is present:
- `deck_sand`: riveted metal deck ↔ pale sand
- `sand_plaza`: sand ↔ sandstone plaza paving
- `deck_pad`: metal deck ↔ landing pad

The corners of each tile are listed in `manifest.json → tilesets`. The solid tiles were checked for wrap seams, and `preview_town.png` was auto-tiled from the manifest data. ✓

## Buildings (`buildings/`)
Sizes are multiples of 32, the background is transparent and alpha is 0/255. Door rectangles are in the manifest.

| id | size | enterable |
|---|---|---|
| market | 192×160 | yes → `interiors/market.png` |
| clinic | 160×160 | yes → `interiors/clinic.png` |
| safehouse | 160×160 | yes → `interiors/safehouse.png` |
| terminal | 256×256 (taller than the brief's 192 so the roof isn't cut off) | yes → `interiors/terminal.png` |
| barracks | 192×160 | scenery |
| tenement_a, tenement_b | 160×160 | scenery |

## Interiors (`interiors/`, new)
Each interior is 192×224 (6×7 tiles). The exit doorway is at x 80–112 in the bottom wall. Each room has an NPC spot, and talking to the NPC opens that building's screen:
- market → Marrow → market screen
- clinic → Ilse → clinic screen
- safehouse → Cass → safehouse screen
- terminal → dispatcher → contracts screen

✓ Checked in `preview_interiors.png`.

## Props (`props/`)
There are 27 props, sized to match the characters. The larger generated props were scaled down 2× or 3× on whole pixels, so they stay crisp. All have alpha 0/255, except `lamp_light_pool`, which is semi-transparent as the brief allows.

The animated strips are:
- `barrel_fire` (4f, 8 fps)
- `steam_vent` (4f, 6 fps)
- `holosign` (2f, 4 fps)

## Known gaps and deviations
- **Buildings and props are drawn at an angle**, like the container shop, not straight-on. This was chosen on purpose so they all match.
- **Clinic and safehouse are generic prefab units.** The red cross and boarded windows didn't come through, because the tool ignored the per-building descriptions.
- **Sand colours don't match across sets.** The sand in `deck_sand` is pale and the sand in `sand_plaza` is orange, so don't place those two sets side by side.
- **Some props from the brief are missing:** bench, cable bundle, slag pallet and rubble. In their place there are extras: consoles, lockers, a water tower, a satellite dish and a cargo pile.
- **Animated props were animated by hand**, not by PixelLab: flame flicker, rising steam and holo scanlines.
- **The player redesign has no carbine** on his back at this size.
- **No `map.tmj` yet.** `preview_town.png` shows one possible layout.
- **Interior furniture collision isn't marked.** Only the floor area and the exit are in the manifest.
