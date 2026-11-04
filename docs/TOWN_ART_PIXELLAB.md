# Making the town art directly in PixelLab

Use this if you're working in PixelLab yourself instead of through ChatGPT. The file layout, sizes and manifest are the same as in `TOWN_ART_PROMPT_CHATGPT.md`, so the game can load either.

## Before you start
- Use the existing battle sprite `sprites/player/idle.png` as the style and character reference for the operative, and `sprites/patrol/idle.png` for the patrol.
- Keep a single palette for everything (night steel, sodium amber, regime red, ion blue, grey, olive, navy; hex values are in the ChatGPT prompt).
- Pick the **top-down / high top-down** camera option (not side view, not isometric) and keep it the same for every asset.
- Canvas sizes: characters 64x64, tiles 32x32, buildings and props at their listed sizes.

## 1. The operative's walk cycle
1. Create the character from the reference image at 64x64, top-down view. Describe it: *"resistance operative, rust-brown patched work jacket, olive scarf over face, knit cap with goggles pushed up, backpack, carbine slung on back, gritty night city"*.
2. Generate the 4 directions (down, up, left, right). Check that the jacket colour, scarf and backpack stay consistent between directions; regenerate any direction that drifts.
3. Use the animation tool to make a **walk** (6 frames) and an **idle** (4 frames, subtle breathing) for each direction.
4. Export each as a horizontal strip: `walk_down.png`, `walk_up.png`, `walk_left.png`, `walk_right.png`, `idle_down.png`, and so on.

## 2. NPCs
Same workflow, 64x64, top-down. Use the descriptions from the ChatGPT prompt (`marrow`, `ilse`, `handler`, `dispatcher`, `patrol`, `worker`, `kid`, `vendor`). Only `idle_down` (4 frames) is needed, except the patrol, which needs `walk` in 4 directions too.

## 3. Tiles
- If your plan has a tileset or map tool, generate a **32x32 top-down tileset** with the prompt *"wet cobblestone street at night, industrial occupied town, sodium lamp light, puddles, grime"*, then separate sets for concrete, metal grating, mud, brick and corrugated walls, rooftops, fences.
- Check the tiles repeat without visible seams (tile a 4x4 patch). AI tiles often need a few pixels fixed at the edges; Aseprite is the easiest place to do that.
- **Shortcut worth considering:** buy a dark industrial or sci-fi pixel tileset on itch.io (check the licence allows commercial use), recolour it to the palette, and use PixelLab only for the unique buildings, props and characters. This is usually faster and cleaner than generating a whole tileset.

## 4. Buildings
Generate each building front as its own image at the listed size, top-down 3/4 view, transparent background: *"[description], building front seen from slightly above, pixel art, night, sodium lamp light, gritty industrial town"*. Make sure the door is clearly visible at the bottom; note its position in pixels for the manifest.
- `market` 192x160, `clinic` 160x160, `safehouse` 160x160, `terminal` 256x192, `barracks` 192x160, `tenement_a` / `tenement_b` 160x160. Descriptions are in the ChatGPT prompt.

## 5. Props
Small objects at their natural size (streetlamp 32x96, crates 32x32, burning barrel 32x48 with 4 frames, notice board 64x64, and so on). The list is in the ChatGPT prompt.

## 6. Putting the map together (Tiled)
1. Install **Tiled** (free, mapeditor.org). New map: orthogonal, 40x30 tiles, 32x32.
2. Add the tileset image as an embedded tileset.
3. Create the layers with the exact names from the ChatGPT prompt: `ground`, `decor`, `above`, `buildings`, `props`, `collision`, `doors`, `npcs`, `spawn`.
4. Paint the ground, place buildings and props as image objects, draw collision rectangles, draw a door rectangle in front of each door with a custom property `target`, and place NPC points with a custom property `id`.
5. Save as **JSON (.tmj)** with the tileset embedded.

## Delivery
Zip the `town/` folder (with `manifest.json`) and upload it to the Claude session. Anything missing keeps placeholder art, so partial deliveries are fine.
