# Cinder Cell: downtime art pack (brief for ChatGPT + PixelLab)

Paste the **Context** block into the chat first, then one **Asset** block at a time. Everything is original IP: no Star Wars names, logos, ship silhouettes or characters. The game already has a code-drawn placeholder for every item below, so deliver in any order.

## Context (paste first)
> I am making pixel art for a browser roguelite called Cinder Cell: an occupied industrial town (Kessa Yard) under a regime called the Directorate, tone like a gritty, grounded resistance drama. Existing art: 64x64 character sprites, 128x128 portraits, 32px top-down town tiles, muted palette (soot greys, rust, sodium-orange highlights #d9a53a, ion blue #9fd3ff, danger red #b53a2f), 1px dark outlines, no anti-aliasing, transparent PNG backgrounds. Keep every asset to that style and palette. No text baked into images. I will ask for one asset at a time; for each, give me the PixelLab prompt and the exact export size and filename.

## Delivery
A folder `downtime/` with the files below and a `manifest.json`:
```json
{ "images": { "ship:shuttle": "ships/shuttle.png", "ship:cutter": "ships/cutter.png", "ship:corvette": "ships/corvette.png", "ship:frigate": "ships/frigate.png",
  "bar:keg7": "bar/keg7.png", "bar:vess": "bar/vess.png", "bar:juno": "bar/juno.png", "bar:sable": "bar/sable.png", "bar:ratchet": "bar/ratchet.png",
  "bg:orbit": "bg/orbit.png", "bg:bar": "bg/bar.png", "bg:wheel": "bg/wheel.png" } }
```
Keys the game reads today: the four `ship:*` (drawn on the orbit canvas, facing **right** for the shuttle and **left** for enemies, centred, transparent) and the four `bar:*` portraits (56px boxes, so 96x96 or 128x128 is fine). Backgrounds and the dealer are for the next pass; include them if cheap.

## Assets

### Ships (side view, transparent, facing right; the game mirrors enemies)
1. **Shuttle** `ships/shuttle.png`, 96x48. The cell's salvaged orbital shuttle: a boxy cargo lifter with mismatched hull plates, a welded-on rail cannon under the nose, one engine glowing ion blue, a sodium-orange stripe. Looks like it should not fly.
2. **Patrol Cutter** `ships/cutter.png`, 96x48. Directorate customs cutter: sleek, grey-green, a single forward gun, a searchlight pod, clean regime markings (geometric chevron, no real-world insignia).
3. **Customs Corvette** `ships/corvette.png`, 128x56. Heavier, blue-grey, twin cannons, a sensor mast with a red target-lock lens, armoured prow.
4. **Blockade Frigate** `ships/frigate.png`, 176x72. The Warden's frigate: long, rust-red and black, broadside gun ports along the flank, a command tower, docking clamps that look like they crush things.

### Bar portraits (128x128, bust, dark background or transparent, 1px outline, sodium-lit from one side)
5. **KEG-7** `bar/keg7.png`. A repurposed loader droid behind a bar: squat industrial chassis, one big optic and one small, a bar towel over a hydraulic shoulder, a cocktail shaker held in a cargo clamp. Deadpan.
6. **Vess** `bar/vess.png`. Dancer who runs the floor. Sharp bob, dark lipstick, a cropped jacket over a sequinned top that catches the sodium light, hoop earrings made from washers, knowing half-smile. Confident and adult, nothing explicit.
7. **Juno** `bar/juno.png`. Grounded lift pilot. Flight jacket with the patch torn off, goggles pushed up into short bleached hair, a burn scar on the jaw, a grin. Ozone-blue highlights.
8. **Sable** `bar/sable.png`. Marrow's cousin, keeps the books. Long coat that is too good for the yard, slicked hair, a data-slate under one arm, violet accent lighting, an appraising look.
9. **Ratchet** `bar/ratchet.png` (optional, the Wheel's fixer). A thin man in a stained waistcoat, visor with one cracked lens, a croupier's rake made from rebar.

### Backgrounds (optional this pass)
10. **Orbit** `bg/orbit.png`, 384x180. Starfield over the curve of a smog-brown planet, a dark orbital lift cable rising on the right, distant Directorate station lights. No ships.
11. **The Lantern** `bg/bar.png`, 384x180. Tenement-basement bar: low pipes, a bar built from a cargo door, string lights, bottles, a dancer's stage with one spotlight, booths in shadow.
12. **The Wheel room** `bg/wheel.png`, 384x180. Back room: a roulette table under a single lamp, chips, a curtain, a bouncer's silhouette by the door.

## Checklist for the artist
- Transparent PNGs, exact sizes above, 1px dark outline, no anti-aliasing, no text.
- Ships centred in the canvas with 4px clear margin; shuttle faces right, enemies face right too (the game flips them).
- Portraits: bust framing, head about 60% of the height, lit from the upper right in sodium orange.
- Keep faces and bodies stylised and clothed; the bar reads as charismatic, not explicit.
