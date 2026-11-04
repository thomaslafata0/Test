# Cinder Cell: project handoff

Read this first in a new session. It summarises everything built so far, how it fits together, and what's next.

## What it is
A browser roguelite (HTML + JS modules, no build step) about a resistance cell raiding an occupied industrial town's four Directorate districts. Original IP **inspired by the tone of Andor; it must not use Star Wars names, characters, logos or iconic designs** (the owner asked for an Andor game; we deliberately made it original and kept all names in `data.js` so a licence holder could swap them).

- **Live build:** https://claude.ai/artifact/6yZfDr97V6KXSHJs3fx9Pw (private artifact; publishing republishes to this URL).
- **Owner preferences learned so far:** wants it challenging ("make it harder", "Resolve harder to get"); likes humour and run-to-run randomness; wants clear explanations on every button; plays on desktop and phone; uses ChatGPT + PixelLab for art, Claude for code.

## Where the code lives (important)
- The project is a git repo at `/home/user/cinder-cell` in the original cloud container. **It has never been pushed anywhere.** It survives only as: (1) the zip `cinder-cell-project.zip` sent to the owner (includes `.git` history), and (2) the source files published to the artifact above (an Artifact `read` with `path` can fetch each one).
- First job in a new session: get the files (owner uploads the zip, or fetch from the artifact), then push to a GitHub repo the owner provides.

## Files
| File | Purpose |
|---|---|
| `index.html` | All screens, CSS, input, rendering glue. One `<script type="module">`. |
| `engine.js` | All rules. Pure (no DOM), so the simulators import it. Save version `VERSION = 3`, `migrate()` upgrades old saves. |
| `data.js` | All content: maps, enemies, signature moves, bosses, quirks, bulletins, gear, implants, perks (contraband), events, contracts, threat levels, training. |
| `stage.js` | Animated battle canvas (384x216, pixelated), event playback, effects, boss intro cinematic, sprite-sheet loader (`sprites/manifest.json`). |
| `audio.js` | Synthesised Web Audio SFX + ambience (no files). Prefs in localStorage `cinder-cell-audio`. |
| `icons.js` | ~95 code-drawn 24x24 pixel icons (`weapon:`, `armor:`, `item:`, `implant:`, `upgrade:`, `perk:`, `cell:`, `train:`, `skill:`, `room:` keys). |
| `portraits.js` | Code-drawn 40x40 fallback portraits + shared pixel grid helpers (`makeGrid`, `outline`, `RAMPS`). |
| `sprites/` | PixelLab battle sheets for **all 26 characters** + `manifest.json` (96x96 frames, 128x128 bosses; anims idle/attack/charge/hit/defend/repair/death). |
| `sim.mjs` | Progression simulator (`node sim.mjs 100 30`, `MAP=port node sim.mjs 50 40`). |
| `sim-builds.mjs` | Build/play-style outlier harness (`node sim-builds.mjs 200 25`, ~10 s). |
| `docs/TOWN_ART_PROMPT_CHATGPT.md`, `docs/TOWN_ART_PIXELLAB.md` | Art briefs for the upcoming walkable town. |
| `README.md` | Short project overview. |

Conventions: keep JS/HTML-script source ASCII-only (non-ASCII written as `\uXXXX` escapes); 2-space indent; data-driven content; every new mechanic gets a simulator check.

## Game systems (all implemented)
- **Meta loop:** operatives die permanently; **Resolve** (permanent currency) buys training (HP/ATK/DEF/SPD, 20 ranks each, cost 2+rank) and cell upgrades. Resolve is scarce: new sectors +1 (repeat clears pay every other time), bosses +3, events/contracts small amounts.
- **Character creation:** name, background (Foundry Hand / Market Runner / Defector Clerk / Street Preacher, each with a perk), 4 points across STR/AGI/INT/CHA (cap 5 at creation, 10 max). +1 attribute point per level. Event choices can change attributes (logged as "choices that changed you").
- **Four maps** (Garrison, Foundry, Detention [unlock sector 5], Orbital Lift Port [unlock sector 10]), 15 named sectors each, 3 rooms per sector chosen via two doors (min 2 fights), boss every 5th sector. Map mechanics: Alarm, Furnace vents, Prisoner allies, Tower snipers.
- **Combat:** intents shown in advance (attack, heavy, signature move, cover, repair). Defend halves damage, blocks statuses, +50% next shot. Skills from weapon type and attributes (Aimed, Burst, Blast, Power Strike [STR 6 or melee], Overload [INT 4 or tech], Suppress [AGI 4], Intimidate [CHA 4]); cooldowns persist per sector and **a skill used last fight starts the next fight with at least 2 turns of cooldown**. Items: stim, thermal, ion, smoke (smoke needs a confirming second tap).
- **Statuses:** bleed, burn, shaken, exposed. Every enemy has a signature move.
- **Variety:** elite affixes (6), boss enrage at 50%, **21 enemy quirks** (Drunk, Corrupt, Glitchy, Pampered…), **7 per-raid bulletins** (Payday, Staff Party…).
- **Contraband:** run perks (16). Bosses always drop, elites 40%. **4 pockets max**; taking a fifth means dropping one.
- **Contracts:** 3 standing jobs paying Resolve + credits (fixed per type; the haul contract pays 25% of its target; a bug that paid ~10x was fixed).
- **Wanted level:** +1 per raid survived; enemies +2.5% HP/ATK per level, credits +2.5%. Escaping via Run/Smoke drops half the credits picked up that raid.
- **Endgame:** beating a map's sector-15 boss liberates it; all four = ending screen; liberations unlock Threat levels I-IV.
- **Presentation:** animated battle stage with PixelLab sprites, boss intro cinematic, synthesised sound + ambience, field manual, one-time tips, settings modal, icons everywhere, short descriptions on every combat button.

## Balance (from simulators; bots play near-optimally, humans are slower)
- Knobs: `TUNE` at the top of `engine.js` (enemy HP/ATK multipliers, boss multipliers, STR/AGI/INT/CHA scaling, Wanted, escape loss).
- Main bot: first boss ~operative 2-3, sector-10 boss ~9, Garrison finale ~21, Port finale ~33 (84% within 40 operatives).
- Builds to the sector-15 finale: Strength 18, Intellect 20, Agility 26, Charisma 26, balanced 21. Known gap: pure Charisma has a slow mid-game (~18 operatives to sector 10).
- Cautious play needs fewer operatives but ~35% more raids; greedy play is fast but unreliable. Considered acceptable.

## Testing and publishing workflow
- Local server: `python3 -m http.server 8765` in the project; Playwright (pre-installed; `require('playwright')`) scripts drive the UI, take screenshots, and check for page errors and horizontal overflow at 1200px and 390px widths.
- Publish with the Artifact tool using `file_path: index.html` and `files` listing every JS module plus `sprites/manifest.json` and every sprite PNG (~158 paths). Unlisted files already published are kept on update.
- Commit messages end with the attribution lines from the session's system reminder.

## Next up: walkable top-down town (agreed design)
Replace the town tabs with a top-down 2D hub you walk around (Stardew/Pokémon-style), keeping a shortcut menu.
- Code plan: canvas town scene with camera follow, arrow/WASD + tap-to-walk, collisions, depth sorting (`above` layer), door zones opening the existing Market / Clinic / Safehouse / Targets (freight terminal) / Contracts (notice board) screens as overlays, NPCs with one-liners, a patrolling guard, rain/lamp ambience, footstep sounds. Build it first with placeholder art, then drop in the delivered art.
- Art spec (sent to the owner): 32x32 tiles, 64x64 character frames (feet 4 px above bottom), 4 directions, player idle(4)/walk(6), NPC idle_down(4) (+ patrol walk), buildings `market` `clinic` `safehouse` `terminal` `barracks` `tenement_a/b`, props list, `town/manifest.json`, optional Tiled map `town/map.tmj` with layers `ground decor above buildings props collision doors npcs spawn` (doors carry property `target`). Full spec in `docs/TOWN_ART_PROMPT_CHATGPT.md`.

## Other ideas discussed but not built
- iPhone app via Capacitor (bundle fonts, native storage for saves, touch hold-for-info, haptics, needs a Mac/Xcode + Apple developer account). A free "Add to Home Screen" web build is the cheaper first step.
- "Copy run report" button so the owner can paste their save/log into a session for debugging.

## Proposed next feature: randomised loot (design agreed in principle, not built)
Goal: more run-to-run variety, a credit sink, and exciting drops.
1. **Rarity tiers for weapons and armour:** Common (grey, main stat x1.0), Rare (blue, x1.2, 1 random bonus), Elite (purple, x1.45, 2 bonuses), Legendary (gold, x1.75, 2 bonuses + a special trait), and **Unique** boss items (fixed, signature effect).
2. **Bonus pool:** +crit, +SPD, +DEF, bleed-on-hit chance, +damage vs droids/humans, heal on kill, shorter skill cooldowns, status resistance, +credits.
3. **Wider base gaps** between item tiers so rarity creates overlap (a Legendary Carbine can beat a Common Repeater).
4. **Rotating Black Market:** 4-6 random pieces restocked after each raid; rarity odds improve with the cell's best sector. No more buying the whole catalogue.
5. **Upgrades (credit sink):** pay to raise an item +1..+5 (about +8% main stat each, escalating cost) or reroll one bonus.
6. **Drops:** elites ~30% chance of gear; bosses always drop their Unique (ideas: Halvek's Service Pistol: crits refund a skill cooldown; Crucible Core Plate: burning enemies take extra damage; Kell's Cell Key: Intimidate works on bosses; Vane's Ornate Pistol: Aimed Shot always crits; plus Brask, Crawler, Ostrane). After a drop: take it (side-by-side comparison) or sell it.
7. **Death still loses gear;** optional Resolve cell upgrade "Heirloom" keeps one piece for the next operative.
8. **UI:** rarity-coloured names and icon frames, item cards with +/- comparison against equipped gear, a loot screen after drops.
Implementation notes: gear becomes item instances (`{ base, rarity, level, bonuses[] }`) instead of ids; bump save `VERSION` to 4 and migrate equipped ids to Common instances; update `statsOf`, the market/victory/safehouse screens, `icons.js` (rarity frames), and both simulators (shop RNG, upgrades, drop rates); re-run `sim.mjs` and `sim-builds.mjs` to retune prices and drop rates.

## Proposed next feature: gear slots and a character gear screen (build together with the loot system)
Replace the single weapon + armour with a paper-doll gear screen. Every slot uses the loot system above (rarity, bonuses, upgrades, boss Uniques).

**Slots**
| Slot | Main stat | Notes |
|---|---|---|
| Ranged weapon | ATK (ranged) | pistols, carbines, scatterguns, rifles, heavy, tech (Arc Projector) |
| Melee weapon | ATK (melee) | baton, maul, knives, prods; new bases needed (e.g. combat knife, shock prod, breaching axe) |
| Helmet | DEF | bonuses lean to crit resistance, status resistance, Shaken immunity |
| Chest armour | DEF (largest share) | current armour list becomes chest pieces |
| Leg armour | DEF + SPD | heavy legs cost SPD, light legs add it |
| Gadget (optional, 1 slot) | utility | e.g. grenade belt (+1 item carry), scanner (see enemy's next 2 intents), stim injector (stims heal more) |
Implants stay as they are (separate slots in the Clinic).

**Combat changes**
- Two basic attacks instead of one: **Shoot** (ranged weapon ATK) and **Strike** (melee weapon ATK). Keys: A = Shoot, F = Strike.
- Each skill uses the weapon of its type: Aimed Shot, Burst Fire, Scatter Blast and Suppressing Fire use the **ranged** weapon; Power Strike uses the **melee** weapon; Overload uses a tech weapon or gadget. A strong rifle with a basic knife makes your melee skills weak, and vice versa.
- Give each a reason to exist: **melee** ignores the enemy's cover penalty and is boosted by STR (+1 ATK per STR point, as now); **ranged** gets AGI-based crit and is the only way to hit without risking melee-specific counters (optional: some enemies like the Riot Enforcer punish melee).
- Defence = sum of helmet + chest + legs DEF; SPD modifiers from legs (and heavy chest) apply.
- Stat requirements stay per item (STR for heavy melee and heavy armour, AGI for rifles and light legs, INT for tech, CHA for officer gear).

**UI**
- New **Gear** screen (tab in town, and viewable from the Safehouse): a paper-doll layout with the slots around the operative's portrait, each slot showing the item icon in its rarity frame, name, main stat and bonuses; tap a slot to see an item card and compare.
- Market and loot screens show which slot an item goes in and a +/- comparison against what's equipped in that slot.
- Combat buttons: Shoot and Strike each show the weapon name underneath, like Attack does now.
- Needs new icons in `icons.js` for helmets, leg armour, melee weapons and gadgets (same 24x24 style), with rarity-coloured frames.

**Save migration:** existing `weapon` becomes the ranged slot (or melee if its type is melee/heavy melee), existing `armor` becomes chest; other slots start empty (or with Common starter pieces: work cap, trousers, kitchen knife).

## Required balance check after building loot + gear slots
1. **Before changing anything,** run and save the baseline:
   ```bash
   node sim.mjs 100 30
   MAP=port node sim.mjs 50 40
   node sim-builds.mjs 200 25
   ```
2. Update both simulators' bots to the new systems: buy and equip per slot (prefer items meeting their build's requirements; ranged-focused bots for AGI, melee-focused for STR), use market upgrades with spare credits, take loot drops when they're better, choose Shoot vs Strike sensibly (Strike against enemies in cover, otherwise the stronger one). Add bot profiles for **melee-only**, **ranged-only** and **hybrid** builds.
3. Re-run all three commands and report a before/after table.
4. **Targets** (adjust `TUNE`, item stats, rarity odds, drop rates and upgrade costs until they hold):
   - main bot: first boss around operative 2-3; sector-10 boss around 7-10; Garrison finale 18-25 operatives; Port finale 25-35 with at least 80% of campaigns finishing within 40.
   - builds: every pure build (STR, AGI, INT, CHA) and melee-only / ranged-only / hybrid finishes in 100% of campaigns; slowest build within about 1.5x of the fastest at the sector-15 finale.
   - economy: credits shouldn't let one operative max every slot early. Check average credits per raid by source (fights, rooms, events, contracts, selling loot) with an instrumented run, and make sure upgrades remain a meaningful sink.
   - flag any single item, bonus or Unique whose presence changes the bot's finale time by more than about 20% as an outlier and tone it down.
5. Play-test the new screens in a browser (desktop 1200px and phone 390px, no page errors, no horizontal overflow), then publish to the artifact and commit.
