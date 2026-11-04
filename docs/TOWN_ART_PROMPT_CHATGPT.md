# Role
You are the art lead for "Cinder Cell", a turn-based roguelite. You already delivered the battle sprites (26 characters) and they are in the game. Now make the art for a **walkable top-down town hub** using PixelLab. If you can call PixelLab directly, generate the assets yourself. If not, write one ready-to-paste PixelLab prompt per asset with exact settings (size, view, direction, frame count), and I will run them.

Work in phases and stop for my approval after Phase 1.

# The game (context)
- Battles happen elsewhere (side-on, already done). Between raids the player walks their operative around **Kessa Yard**, an occupied industrial mining town at night under curfew, and walks into buildings to use them.
- Mood: grounded, gritty, spy-thriller. Wet cobbles, sodium streetlights, steam, rain, cables, ration queues, Directorate propaganda posters. Not cartoonish.
- Original IP. Nothing may resemble Star Wars or any other franchise (no stormtrooper-style armour, no franchise insignia, ships or droid silhouettes).

# Style (match the existing pack)
- I've attached sheets from the existing battle pack (player, patrol, officer, halvek). Match their outline weight, shading, palette and level of detail, scaled down for a top-down view.
- 1px dark outline (#07080a), 3-step shading lit from the top-left, limited palette, no anti-aliasing, no blur.
- Palette anchors: night steel #121518 / #222930, sodium amber #e8973a (lamps, warm light), regime red #d4483a (Directorate signs, alarms), ion blue #73b6d4 (screens, holo-signs), grey #59616a, olive #565c43, navy #2d3a50.

# Technical spec (follow exactly; the game code is written against it)
- **View:** top-down 3/4 ("JRPG"/Stardew-style): we see the tops of heads and the fronts of buildings.
- **Tile size:** 32x32 px. All tiles, building footprints and prop sizes are multiples of 32 where possible.
- **Characters:** 64x64 px frames, transparent background. Character about 44-50 px tall, horizontally centred, feet 4 px above the bottom edge in every frame. No drift between frames.
- **Directions:** down, up, left, right. Draw all four (do not mirror left into right; gear sits on one side).
- **Export:** one PNG per animation per direction, a horizontal strip of equal-width frames, no gaps. Transparent background.

# Deliverables and file layout
```
town/
  manifest.json            (describes everything below)
  chars/<id>/<anim>_<dir>.png     e.g. chars/player/walk_left.png
  tiles/town.png           (tileset, 32x32 grid)
  buildings/<id>.png       (building fronts, transparent around the shape)
  props/<id>.png
  map.tmj                  (Tiled map, JSON format; optional, see Phase 4)
  CHECKLIST.md
```

## 1. The operative (player): `chars/player/`
Same character as the battle sprite: rust-brown patched work jacket, olive scarf over the face, knit cap with goggles pushed up, backpack, salvaged carbine slung on the back while walking.
| anim | frames | fps | loop | directions |
|---|---|---|---|---|
| idle | 4 | 5 | yes | down, up, left, right |
| walk | 6 | 10 | yes | down, up, left, right |

## 2. NPCs: `chars/<id>/`
All NPCs need `idle_down` (4 frames, 5 fps, loop). The patrol also needs `walk_<dir>` in all 4 directions (6 frames, 10 fps).
- `marrow`: Old Marrow, the fence. Elderly, hunched, long coat full of pockets, fingerless gloves, a jeweller's loupe on one eye. Runs the Black Market stall.
- `ilse`: Doc Ilse, back-room medic. Middle-aged woman, sleeves rolled up, stained apron over a laundry worker's uniform, headlamp, medical satchel.
- `handler`: Cass, the cell's handler at the safehouse. Wiry, dark hooded jacket, scarf, leaning on the wall, smoking.
- `dispatcher`: freight-terminal dispatcher. Hi-vis vest, ear defenders around the neck, clipboard, tired.
- `patrol`: Directorate patrol trooper walking a beat. Same design as the battle `patrol` (grey brimmed helmet, blue visor band, olive breathing mask, grey armour, rifle). Needs idle_down + walk in 4 directions.
- `worker`: foundry worker queuing for rations. Soot-stained coveralls, hard hat under the arm.
- `kid`: street kid. Oversized jacket, scarf, carrying a bundle of pamphlets.
- `vendor`: noodle vendor behind a small steaming cart (the cart is part of the sprite; 64x64 is fine).

## 3. Tileset: `tiles/town.png`
One PNG on a 32x32 grid. Seamless where tiles repeat. Include:
- Ground: wet cobblestone (4 variants), cracked concrete (2), metal grating (2), mud (2), puddle (2, with a faint amber reflection), drain grate.
- Edges and transitions between cobble, concrete and mud.
- Walls: brick and corrugated metal wall faces (top, middle, bottom pieces), wall tops/rooftops seen from above, corners.
- Fences: chain-link with posts, Directorate barrier with red and white stripes.
- Kerbs, steps, railway track pieces (straight, end) for the freight terminal.

## 4. Building fronts: `buildings/<id>.png`
Seen from the front, top-down 3/4. Each has an obvious door at the bottom. Sizes are suggestions; keep them multiples of 32.
- `market`, 192x160: Old Marrow's stall. A rusted shipping-container shopfront with a pulled-up shutter, scrap scales, hanging lamps, crates of salvage, a hand-painted sign with no readable text.
- `clinic`, 160x160: a laundromat whose back room is the clinic. Steamed-up window, washing machines visible inside, a small red cross chalked by the side door.
- `safehouse`, 160x160: a boarded tenement with an unmarked steel door, a chalk mark on the frame, one lit window upstairs.
- `terminal`, 256x192: Kessa Freight Terminal, where the player picks a mission and rides out to the districts. Big sliding cargo door, departure board glowing blue, Directorate checkpoint booth beside it, rail track leading inside.
- `barracks`, 192x160: a Directorate guard post (scenery only, not enterable). Red regime signage, floodlight, barred windows.
- `tenement_a`, `tenement_b`, 160x160 each: generic housing blocks for filler. Laundry lines, AC units, broken windows.

## 5. Props: `props/<id>.png`
Transparent background, natural sizes (32x32, 32x64, 64x64…):
streetlamp (sodium, tall, 32x96), lamp light pool (a soft amber glow ellipse, semi-transparent is OK for this one only, 96x64), crate, crate stack, barrel, burning barrel (4-frame strip, 32x48 frames), steam vent (4-frame strip), propaganda poster wall (64x64), holo-sign (2-frame flicker), notice board with contract papers (64x64; it will open the contracts list), bench, ration queue barrier, cable bundle, pallet of foundry slag, trash pile, parked cargo crawler (96x64), rubble.

## 6. Map (optional but helpful): `map.tmj`
Lay the town out in **Tiled** (free map editor), saved as JSON (.tmj) with the tileset embedded. Size about 40x30 tiles. Required layers (exact names):
- `ground` (tile layer), `decor` (tile layer, drawn under characters), `above` (tile layer, drawn over characters: roof edges, lamp tops)
- `buildings` (object layer: image objects using the building PNGs)
- `props` (object layer: image objects using the prop PNGs)
- `collision` (object layer: rectangles where the player can't walk)
- `doors` (object layer: rectangles in front of each door with a custom property `target` = `market` | `clinic` | `safehouse` | `terminal` | `contracts`)
- `npcs` (object layer: points with custom property `id` = an NPC id; for the patrol add `path` = a comma-separated list of x,y tile points)
- `spawn` (object layer: one point where the player starts, in front of the safehouse)
Layout idea: the safehouse and clinic in a side alley to the west, the market in a central square with the noodle vendor and ration queue, the freight terminal to the north with rail tracks, the barracks to the east with the patrol walking a loop through the square.

## manifest.json format
```json
{
  "tileSize": 32,
  "frame": 64,
  "chars": {
    "player": { "anims": { "idle": { "frames": 4, "fps": 5, "loop": true, "dirs": ["down","up","left","right"] },
                           "walk": { "frames": 6, "fps": 10, "loop": true, "dirs": ["down","up","left","right"] } } },
    "marrow": { "anims": { "idle": { "frames": 4, "fps": 5, "loop": true, "dirs": ["down"] } } }
  },
  "buildings": { "market": { "w": 192, "h": 160, "door": { "x": 80, "y": 128, "w": 32, "h": 32 } } },
  "props": { "streetlamp": { "w": 32, "h": 96 }, "barrel_fire": { "w": 32, "h": 48, "frames": 4, "fps": 8 } }
}
```
`door` is the door rectangle in pixels inside the building image.

# Phases
1. **Style check:** the player `walk_down` and `walk_right`, the `market` building, and 6 ground tiles. Show them together on a mock-up and stop for my approval.
2. All player animations and all NPCs.
3. Full tileset, all buildings and props.
4. The Tiled map (optional; I can lay it out instead if you only deliver the art).

# Quality bar
Before delivering, check every file: frame count, frame size, transparent background, feet on the baseline, no drift, tiles seamless. Write the results in `CHECKLIST.md`. Fix or regenerate anything that fails rather than delivering it.
