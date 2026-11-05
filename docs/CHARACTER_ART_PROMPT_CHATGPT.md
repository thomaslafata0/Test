# Cinder Cell: character customisation art brief (for ChatGPT + PixelLab)

Paste everything below the line into ChatGPT. It already knows the earlier Cinder Cell sprite work; this brief extends it.

---

We're adding character customisation to Cinder Cell: the player picks one of four bodies (two men, two women), one of four classes (which changes the outfit), a hairstyle, and skin/hair colours, and their equipped weapon shows in their hands. To keep PixelLab credits low we are **not** generating one sprite per combination. We generate **layers** on the same frame grid and the game stacks them: body, then outfit, then hair, then weapon. Everything is original art in the existing Cinder Cell style (dusty frontier spaceport, no franchise designs).

## Conventions that must not change

The game already loads these; any deviation breaks it.

**Town sheets** (walking around the yard), one PNG strip per animation and direction, `idle_<dir>.png` and `walk_<dir>.png`:
- 64x64 frames, transparent background, alpha strictly 0 or 255.
- idle: 4 frames, 5 fps. walk: 6 frames, 10 fps. Directions: down, up, left, right.
- Character 39 to 43 px tall; the lowest opaque pixel of every frame is on row 59 (feet 4 px above the bottom). The head and shoulders stay within 3 px of the same spot across a strip.

**Battle sheets** (the fight scene), one PNG strip per animation, side view facing right, seen slightly from behind:
- 96x96 frames, transparent background, alpha 0 or 255.
- idle 4f @6, attack 4f @10, charge 2f @6, hit 2f @10, defend 2f @6, death 6f @8 (same as the current `sprites/player`).

**Layers must line up frame for frame.** Use PixelLab's "animate from a template / reference skeleton" with the body's finished animation as the template for every overlay, so an outfit or weapon generated later sits exactly on the body in every frame. Never generate a combined character; never let the tool re-pose a layer.

## What to make, in order (stop after each batch and send it; we check before the next)

### Batch 1: bodies (4)
Two men, two women, about 40 px tall in the town frames, plain grey underlayer (sleeveless vest and plain trousers, bare arms, simple boots), **neutral mid-grey skin with a 3-tone ramp** and **no hair** (bald cap). The game recolours skin, so keep skin pixels to exactly three greys (#6f6f6f, #9a9a9a, #c8c8c8) and use no other greys in the skin. Each body needs the full town set (8 strips) and the full battle set (6 strips). Ids: `body_m1`, `body_m2`, `body_f1`, `body_f2`. Make them read as different builds (one broad, one lean of each) so classes look different on them.

### Batch 2: class outfits (4), drawn as overlays on body_m1
Transparent everywhere except the clothing. Same 14 strips each (town + battle), generated from body_m1's animations as the template.
- `cls_foundry`: Foundry Hand. Leather apron, heavy gloves, rolled sleeves, tool belt.
- `cls_runner`: Market Runner. Hooded jacket, satchel across the chest, light boots.
- `cls_clerk`: Defector Clerk. Long Directorate greatcoat with the insignia torn off, collar up.
- `cls_preacher`: Street Preacher. Long patched coat, scarf, a hand-painted sign on the back.
We'll fit these to the other three bodies in-game by offsetting; only if a body is much wider do we order a second version of an outfit for it. Don't make those yet.

### Batch 3: hair (6), overlays on body_m1, **town idle + walk only** (8 strips each)
`hair_short`, `hair_cropped`, `hair_long_tied`, `hair_shaved` (stubble only), `hair_mohawk`, `hair_bob`. Three-tone ramp of exactly #4a2c1a, #7a4a2a, #b07a4a so the game can recolour. Battle frames don't need hair strips: we reuse the idle head position.

### Batch 4: weapons (8), overlays, **battle set only** (idle 4f + attack 4f + charge 2f; 3 strips each)
Held in the right hand, matching the attack frames of body_m1: `wpn_pistol`, `wpn_carbine`, `wpn_scattergun`, `wpn_rifle`, `wpn_cannon` (shoulder-fired), `wpn_knife`, `wpn_baton`, `wpn_maul`. Muzzle or blade tip ends at a consistent point so the game can place muzzle flashes; tell us the pixel of the muzzle/tip in frame 1 of each.

### Batch 5 (optional, later): portraits
One 64x64 head-and-shoulders portrait per body, bald, neutral skin ramp, for the creation screen. Hair portraits as overlays (6). Static images, no animation.

## Delivery

```
chars2/
  body/<id>/{idle,walk}_{down,up,left,right}.png     (town)
  body/<id>/battle/{idle,attack,charge,hit,defend,death}.png
  outfit/<id>/...  (same layout)
  hair/<id>/{idle,walk}_{down,up,left,right}.png
  weapon/<id>/battle/{idle,attack,charge}.png
  manifest.json
```

`manifest.json` lists, for every layer: frame size, animations with frame counts and fps, the layer order (`body, outfit, hair, weapon`), the skin and hair ramp colours used, and for weapons the muzzle/tip pixel. Run the same checks as the town pack on every strip: frame size, frame count, alpha strictly 0/255, feet-on-row-59 for town strips, and a **layer alignment check**: overlay the outfit on the body for every frame and confirm no outfit pixel sits more than 1 px outside the body's silhouette except sleeves, coat tails and satchels, which are allowed. Report the results as a table like last time.

## Credit control

- Bodies are the only expensive batch (14 strips x 4). Check them before ordering anything else.
- Outfits and hair are generated from the body template, which is cheaper than fresh animation. Hair is town-only.
- Weapons are battle-only and three short strips each.
- Do not generate variations "to choose from"; one of each, we'll ask for a redo if needed.
- If PixelLab ignores an outfit description (as it did with the clinic building), stop and say so rather than spending credits on retries.
