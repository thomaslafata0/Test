# Cinder Cell: character customisation layers (chars2)

Layer order (bottom to top): **body → outfit → hair → weapon**.
Skin ramp (bodies, portraits, weapon hands): `#6f6f6f #9a9a9a #c8c8c8` (only skin uses these three colours).
Hair ramp: `#4a2c1a #7a4a2a #b07a4a`.
Town frames 64×64 (feet on row 59). Battle frames 96×96, facing right (feet on row 87). Alpha is strictly 0/255 everywhere.

## Contents
- **Bodies:** body_f1, body_f2, body_m1, body_m2. Each has 8 town strips and 6 battle strips.
- **Outfits:** cls_clerk, cls_foundry, cls_preacher, cls_runner. Overlays drawn on body_m1, each with 8 town strips and 6 battle strips.
- **Hair:** hair_bob, hair_cropped, hair_long_tied, hair_mohawk, hair_shaved, hair_short. Overlays drawn on body_m1, town only (8 strips each).
- **Weapons:** wpn_baton, wpn_cannon, wpn_carbine, wpn_knife, wpn_maul, wpn_pistol, wpn_rifle, wpn_scattergun. Battle only (idle, attack, charge).
- **Portraits:** body_f1, body_f2, body_m1, body_m2. 64×64, bald, skin ramp applied.

## Weapon muzzle / tip, attack frame 1 (x, y inside the 96×96 frame)
| weapon | tip | sprite length |
|---|---|---|
| wpn_baton | [78, 42] | 19 px |
| wpn_cannon | [82, 33] | 29 px |
| wpn_carbine | [70, 37] | 23 px |
| wpn_knife | [77, 41] | 18 px |
| wpn_maul | [87, 42] | 28 px |
| wpn_pistol | [74, 34] | 17 px |
| wpn_rifle | [83, 38] | 30 px |
| wpn_scattergun | [77, 39] | 21 px |
Tips for every frame are in `manifest.json → layers.<id>.battle.<anim>.tip`.

## Check results
Checks on every strip:
- frame size and frame count
- alpha strictly 0 or 255
- bodies: lowest pixel on row 59 (town) or row 87 (battle) in every frame
- town bodies: head within 3 px across each strip

**Layer alignment:** each overlay frame was laid over body_m1's matching frame, counting pixels more than 1 px outside the body's silhouette. Sleeves, coat tails, satchels, the preacher's back sign, hair volume and weapons are allowed outside, so the count is reported, not failed.

| strip | checks | layer pixels outside body silhouette (+1px) |
|---|---|---|
| body/body_f1/idle_down | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f1/idle_up | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f1/idle_left | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f1/idle_right | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f1/walk_down | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f1/walk_up | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f1/walk_left | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f1/walk_right | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f1/battle/idle | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_f1/battle/attack | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_f1/battle/charge | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_f1/battle/hit | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_f1/battle/defend | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_f1/battle/death | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_f2/idle_down | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f2/idle_up | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f2/idle_left | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f2/idle_right | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f2/walk_down | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f2/walk_up | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f2/walk_left | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f2/walk_right | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_f2/battle/idle | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_f2/battle/attack | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_f2/battle/charge | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_f2/battle/hit | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_f2/battle/defend | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_f2/battle/death | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_m1/idle_down | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m1/idle_up | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m1/idle_left | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m1/idle_right | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m1/walk_down | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m1/walk_up | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m1/walk_left | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m1/walk_right | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m1/battle/idle | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_m1/battle/attack | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_m1/battle/charge | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_m1/battle/hit | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_m1/battle/defend | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_m1/battle/death | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_m2/idle_down | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m2/idle_up | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m2/idle_left | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m2/idle_right | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m2/walk_down | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m2/walk_up | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m2/walk_left | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m2/walk_right | size:✓ count:✓ alpha:✓ feet59:✓ drift<=3:✓ | — |
| body/body_m2/battle/idle | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_m2/battle/attack | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_m2/battle/charge | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_m2/battle/hit | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_m2/battle/defend | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| body/body_m2/battle/death | size:✓ count:✓ alpha:✓ feet87:✓ | — |
| outfit/cls_clerk/idle_down | size:✓ count:✓ alpha:✓ | 53 |
| outfit/cls_clerk/idle_up | size:✓ count:✓ alpha:✓ | 20 |
| outfit/cls_clerk/idle_left | size:✓ count:✓ alpha:✓ | 69 |
| outfit/cls_clerk/idle_right | size:✓ count:✓ alpha:✓ | 114 |
| outfit/cls_clerk/walk_down | size:✓ count:✓ alpha:✓ | 96 |
| outfit/cls_clerk/walk_up | size:✓ count:✓ alpha:✓ | 19 |
| outfit/cls_clerk/walk_left | size:✓ count:✓ alpha:✓ | 83 |
| outfit/cls_clerk/walk_right | size:✓ count:✓ alpha:✓ | 75 |
| outfit/cls_clerk/battle/idle | size:✓ count:✓ alpha:✓ | 22 |
| outfit/cls_clerk/battle/attack | size:✓ count:✓ alpha:✓ | 5 |
| outfit/cls_clerk/battle/charge | size:✓ count:✓ alpha:✓ | 65 |
| outfit/cls_clerk/battle/hit | size:✓ count:✓ alpha:✓ | 224 |
| outfit/cls_clerk/battle/defend | size:✓ count:✓ alpha:✓ | 34 |
| outfit/cls_clerk/battle/death | size:✓ count:✓ alpha:✓ | 231 |
| outfit/cls_foundry/idle_down | size:✓ count:✓ alpha:✓ | 38 |
| outfit/cls_foundry/idle_up | size:✓ count:✓ alpha:✓ | 12 |
| outfit/cls_foundry/idle_left | size:✓ count:✓ alpha:✓ | 20 |
| outfit/cls_foundry/idle_right | size:✓ count:✓ alpha:✓ | 43 |
| outfit/cls_foundry/walk_down | size:✓ count:✓ alpha:✓ | 53 |
| outfit/cls_foundry/walk_up | size:✓ count:✓ alpha:✓ | 8 |
| outfit/cls_foundry/walk_left | size:✓ count:✓ alpha:✓ | 41 |
| outfit/cls_foundry/walk_right | size:✓ count:✓ alpha:✓ | 52 |
| outfit/cls_foundry/battle/idle | size:✓ count:✓ alpha:✓ | 0 |
| outfit/cls_foundry/battle/attack | size:✓ count:✓ alpha:✓ | 2 |
| outfit/cls_foundry/battle/charge | size:✓ count:✓ alpha:✓ | 3 |
| outfit/cls_foundry/battle/hit | size:✓ count:✓ alpha:✓ | 43 |
| outfit/cls_foundry/battle/defend | size:✓ count:✓ alpha:✓ | 20 |
| outfit/cls_foundry/battle/death | size:✓ count:✓ alpha:✓ | 209 |
| outfit/cls_preacher/idle_down | size:✓ count:✓ alpha:✓ | 66 |
| outfit/cls_preacher/idle_up | size:✓ count:✓ alpha:✓ | 24 |
| outfit/cls_preacher/idle_left | size:✓ count:✓ alpha:✓ | 173 |
| outfit/cls_preacher/idle_right | size:✓ count:✓ alpha:✓ | 240 |
| outfit/cls_preacher/walk_down | size:✓ count:✓ alpha:✓ | 80 |
| outfit/cls_preacher/walk_up | size:✓ count:✓ alpha:✓ | 21 |
| outfit/cls_preacher/walk_left | size:✓ count:✓ alpha:✓ | 207 |
| outfit/cls_preacher/walk_right | size:✓ count:✓ alpha:✓ | 177 |
| outfit/cls_preacher/battle/idle | size:✓ count:✓ alpha:✓ | 802 |
| outfit/cls_preacher/battle/attack | size:✓ count:✓ alpha:✓ | 308 |
| outfit/cls_preacher/battle/charge | size:✓ count:✓ alpha:✓ | 210 |
| outfit/cls_preacher/battle/hit | size:✓ count:✓ alpha:✓ | 431 |
| outfit/cls_preacher/battle/defend | size:✓ count:✓ alpha:✓ | 128 |
| outfit/cls_preacher/battle/death | size:✓ count:✓ alpha:✓ | 374 |
| outfit/cls_runner/idle_down | size:✓ count:✓ alpha:✓ | 81 |
| outfit/cls_runner/idle_up | size:✓ count:✓ alpha:✓ | 14 |
| outfit/cls_runner/idle_left | size:✓ count:✓ alpha:✓ | 101 |
| outfit/cls_runner/idle_right | size:✓ count:✓ alpha:✓ | 192 |
| outfit/cls_runner/walk_down | size:✓ count:✓ alpha:✓ | 89 |
| outfit/cls_runner/walk_up | size:✓ count:✓ alpha:✓ | 46 |
| outfit/cls_runner/walk_left | size:✓ count:✓ alpha:✓ | 157 |
| outfit/cls_runner/walk_right | size:✓ count:✓ alpha:✓ | 169 |
| outfit/cls_runner/battle/idle | size:✓ count:✓ alpha:✓ | 55 |
| outfit/cls_runner/battle/attack | size:✓ count:✓ alpha:✓ | 54 |
| outfit/cls_runner/battle/charge | size:✓ count:✓ alpha:✓ | 6 |
| outfit/cls_runner/battle/hit | size:✓ count:✓ alpha:✓ | 94 |
| outfit/cls_runner/battle/defend | size:✓ count:✓ alpha:✓ | 38 |
| outfit/cls_runner/battle/death | size:✓ count:✓ alpha:✓ | 185 |
| hair/hair_bob/idle_down | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_bob/idle_up | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_bob/idle_left | size:✓ count:✓ alpha:✓ | 5 |
| hair/hair_bob/idle_right | size:✓ count:✓ alpha:✓ | 5 |
| hair/hair_bob/walk_down | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_bob/walk_up | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_bob/walk_left | size:✓ count:✓ alpha:✓ | 9 |
| hair/hair_bob/walk_right | size:✓ count:✓ alpha:✓ | 32 |
| hair/hair_cropped/idle_down | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_cropped/idle_up | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_cropped/idle_left | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_cropped/idle_right | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_cropped/walk_down | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_cropped/walk_up | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_cropped/walk_left | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_cropped/walk_right | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_long_tied/idle_down | size:✓ count:✓ alpha:✓ | 1 |
| hair/hair_long_tied/idle_up | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_long_tied/idle_left | size:✓ count:✓ alpha:✓ | 59 |
| hair/hair_long_tied/idle_right | size:✓ count:✓ alpha:✓ | 157 |
| hair/hair_long_tied/walk_down | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_long_tied/walk_up | size:✓ count:✓ alpha:✓ | 21 |
| hair/hair_long_tied/walk_left | size:✓ count:✓ alpha:✓ | 160 |
| hair/hair_long_tied/walk_right | size:✓ count:✓ alpha:✓ | 278 |
| hair/hair_mohawk/idle_down | size:✓ count:✓ alpha:✓ | 46 |
| hair/hair_mohawk/idle_up | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_mohawk/idle_left | size:✓ count:✓ alpha:✓ | 12 |
| hair/hair_mohawk/idle_right | size:✓ count:✓ alpha:✓ | 8 |
| hair/hair_mohawk/walk_down | size:✓ count:✓ alpha:✓ | 78 |
| hair/hair_mohawk/walk_up | size:✓ count:✓ alpha:✓ | 44 |
| hair/hair_mohawk/walk_left | size:✓ count:✓ alpha:✓ | 22 |
| hair/hair_mohawk/walk_right | size:✓ count:✓ alpha:✓ | 31 |
| hair/hair_shaved/idle_down | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_shaved/idle_up | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_shaved/idle_left | size:✓ count:✓ alpha:✓ | 1 |
| hair/hair_shaved/idle_right | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_shaved/walk_down | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_shaved/walk_up | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_shaved/walk_left | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_shaved/walk_right | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_short/idle_down | size:✓ count:✓ alpha:✓ | 8 |
| hair/hair_short/idle_up | size:✓ count:✓ alpha:✓ | 0 |
| hair/hair_short/idle_left | size:✓ count:✓ alpha:✓ | 4 |
| hair/hair_short/idle_right | size:✓ count:✓ alpha:✓ | 10 |
| hair/hair_short/walk_down | size:✓ count:✓ alpha:✓ | 16 |
| hair/hair_short/walk_up | size:✓ count:✓ alpha:✓ | 2 |
| hair/hair_short/walk_left | size:✓ count:✓ alpha:✓ | 24 |
| hair/hair_short/walk_right | size:✓ count:✓ alpha:✓ | 55 |
| weapon/wpn_baton/battle/idle | size:✓ count:✓ alpha:✓ | 216 |
| weapon/wpn_baton/battle/attack | size:✓ count:✓ alpha:✓ | 217 |
| weapon/wpn_baton/battle/charge | size:✓ count:✓ alpha:✓ | 108 |
| weapon/wpn_cannon/battle/idle | size:✓ count:✓ alpha:✓ | 947 |
| weapon/wpn_cannon/battle/attack | size:✓ count:✓ alpha:✓ | 888 |
| weapon/wpn_cannon/battle/charge | size:✓ count:✓ alpha:✓ | 507 |
| weapon/wpn_carbine/battle/idle | size:✓ count:✓ alpha:✓ | 206 |
| weapon/wpn_carbine/battle/attack | size:✓ count:✓ alpha:✓ | 193 |
| weapon/wpn_carbine/battle/charge | size:✓ count:✓ alpha:✓ | 118 |
| weapon/wpn_knife/battle/idle | size:✓ count:✓ alpha:✓ | 224 |
| weapon/wpn_knife/battle/attack | size:✓ count:✓ alpha:✓ | 223 |
| weapon/wpn_knife/battle/charge | size:✓ count:✓ alpha:✓ | 112 |
| weapon/wpn_maul/battle/idle | size:✓ count:✓ alpha:✓ | 592 |
| weapon/wpn_maul/battle/attack | size:✓ count:✓ alpha:✓ | 570 |
| weapon/wpn_maul/battle/charge | size:✓ count:✓ alpha:✓ | 296 |
| weapon/wpn_pistol/battle/idle | size:✓ count:✓ alpha:✓ | 452 |
| weapon/wpn_pistol/battle/attack | size:✓ count:✓ alpha:✓ | 386 |
| weapon/wpn_pistol/battle/charge | size:✓ count:✓ alpha:✓ | 224 |
| weapon/wpn_rifle/battle/idle | size:✓ count:✓ alpha:✓ | 380 |
| weapon/wpn_rifle/battle/attack | size:✓ count:✓ alpha:✓ | 374 |
| weapon/wpn_rifle/battle/charge | size:✓ count:✓ alpha:✓ | 193 |
| weapon/wpn_scattergun/battle/idle | size:✓ count:✓ alpha:✓ | 268 |
| weapon/wpn_scattergun/battle/attack | size:✓ count:✓ alpha:✓ | 260 |
| weapon/wpn_scattergun/battle/charge | size:✓ count:✓ alpha:✓ | 133 |
| portrait/body_f1 | size:✓ alpha:✓ | — |
| portrait/body_f2 | size:✓ alpha:✓ | — |
| portrait/body_m1 | size:✓ alpha:✓ | — |
| portrait/body_m2 | size:✓ alpha:✓ | — |

## How the layers were made, and their limits
- **Alignment.** Every overlay comes from a PixelLab state of body_m1: the same figure redrawn wearing the outfit or hair. It was animated with the same template motion as the body, and only the pixels that differ from the plain body were kept. So outfits and hair follow body_m1 frame for frame.
- **Skin colour.** PixelLab drew pink skin despite the grey-mannequin prompt. Skin was converted to the three-grey ramp afterwards.
- **Charge.** Charge uses frames 0–1 of the wind-up template (a tense ready stance). The later wind-up frames drift when a weapon is held.
- **Weapons.** PixelLab's motion templates don't carry held props. Each weapon is a clean side-view sprite, generated separately and pinned by its grip to body_m1's right fist in every frame. The weapon stays in the hand, and the muzzle sits at a fixed offset from the fist.
- **Breath puffs.** The "Breathing Idle" template draws a breath puff in side views. It was removed from all left/right idle strips.
- **Other bodies.** Outfits and hair are drawn on body_m1. Fit them to m2, f1 and f2 in-game by offset, as your brief planned.
- **Hair portraits** weren't made. PixelLab redraws the face for every portrait, so hair cut from one won't fit the bald body portraits.
