# Cinder Cell: project handoff

Read this first in a new session. It covers what the game is, how the code fits together, every system, the balance numbers, how to test and publish, and what is left. Last updated for the v5 round (heirloom fix, orbit stakes and gating, battle hair, ship art, ventures caps, one orbit run per town stay, new items, deeper shop, sector conditions and rare rooms). See **Changes in v5** at the end for the summary.

## Start here
1. Clone `https://github.com/thomaslafata0/Test`, branch **`loot-and-gear`** (everything is here; `master` is the old single-weapon game, merge only when the owner says so).
2. `python3 -m http.server 8765` in the repo, open `http://localhost:8765/index.html`.
3. Run the checks in **Testing** before and after any change.
4. Publish to the live artifact (see **Publishing**) and push. The owner plays the live link on desktop and phone.

- **Live build:** https://claude.ai/artifact/6yZfDr97V6KXSHJs3fx9Pw (private to the owner; republishing keeps the URL).
- **Owner:** wants it challenging, funny and varied; makes art with ChatGPT + PixelLab from briefs in `docs/`; pastes run reports (Settings > Copy run report) as feedback; will play co-op with a friend. Prefers you act autonomously and report plainly.

## What it is
A browser roguelite in plain HTML + JS modules, no build step. A resistance cell raids four districts of an occupied industrial town, Kessa Yard, held by the Directorate. Operatives die permanently; the cell keeps Resolve, training, feats and records. Original IP **inspired by the tone of Andor: no Star Wars names, characters, logos, ship silhouettes or designs**. All names live in `data.js`.

## Conventions
- ASCII-only JS and HTML: write non-ASCII as `\uXXXX`. Check with `python3 -I -c "import sys; [print(f, sum(1 for l in open(f,encoding='utf-8') if any(ord(c)>127 for c in l))) for f in sys.argv[1:]]" index.html engine.js data.js`.
- 2-space indent, data-driven content in `data.js`, rules in `engine.js` (pure, no DOM), UI in `index.html`.
- Every mechanic that changes difficulty gets a simulator check before it ships.
- Save is `VERSION = 4` in `localStorage['cinder-cell-save-v1']`. New fields must default with `||` or in `migrate()` (the `s.v === VERSION` branch already backfills `board`, `ship`, `ventures`, `feats`).
- Commits end with the session's attribution lines.

## Files
| File | Purpose |
|---|---|
| `index.html` | Every screen, all CSS, input, render loop (`render()` rebuilds `#app`; same-view renders keep scroll and focus), co-op client. One `<script type="module">`. |
| `engine.js` | All rules. `TUNE` and `HARD` are the balance knobs. Sections: gear, stats, combat, raids, leaderboard, co-op actors, downtime, feats. |
| `data.js` | Content: maps, enemies, bosses, quirks, bulletins, gear, rarities, bonuses, traits, uniques, implants, perks, events, contracts, backgrounds, Marks, shuttle parts, orbit tiers, ventures, the bar, feats. |
| `stage.js` | Battle canvas (384x216): sprite sheets, effects, boss intro, co-op partner, Manual / Auto 1x / Auto 2x. `setLookSheets` takes composited player sheets. |
| `town.js` | The walkable yard: layout, outline collision from building alpha, doors and interiors, NPCs, hotspots, tap-to-walk. `setPlayerSheets` takes composited strips. |
| `look.js` | Character compositor over `chars2/`: `townSheets`, `battleSheet` (ranged weapon in idle/charge/attack, melee weapon in `attackM`), `lookStill`, `lookBattleStill`, `lookPortrait`, `weaponLayer(base)`. Skin and hair swap their exact three-shade ramps. Town overlays drawn on body_m1 are shifted per frame onto other bodies; battle hair is pre-fitted per body (`<hair>@<body>` layers cut from one atlas per hairstyle via the manifest's `y`/`w`/`h`). |
| `downtime.js` | Code-drawn roulette `Wheel` and `OrbitScene` (smog planet, lift cable, station drawn in code unless `bg:orbit` is supplied); ship art from `downtime/manifest.json`, enemies mirrored. |
| `net.js`, `coop/` | Co-op transports (WebSocket relay, BroadcastChannel) and the Cloudflare Worker + Durable Object relay (not deployed). |
| `audio.js` | Synth SFX, optional drone/rain, music (`music/town.mp3`, `music/raid.mp3`), default music volume 0.2. |
| `icons.js`, `portraits.js` | Code-drawn icons (gear, skills, rooms, marks, shuttle, ventures) and fallback portraits. |
| `sprites/` | PixelLab battle sheets for enemies, bosses, prisoner and the stock player. |
| `town/` | Town art pack + `manifest.json`. |
| `chars2/` | Character art pack (see **Art**). |
| `downtime/` | `manifest.json` + `ships/` (shuttle, cutter, corvette, frigate: PixelLab side views facing right). Bar portraits and backgrounds not yet delivered. |
| `tools/` | `bhair_build.py` (battle hair from PixelLab hair states of battle body_m1), `hair_pin.py` (one stable town hair shape per direction). |
| `sim.mjs`, `sim-builds.mjs`, `sim-gear.mjs`, `sim-coop.mjs`, `sim-board.mjs` | Simulators (see **Balance**). `board.json` is the seeded leaderboard. |
| `tests/*.cjs` | Playwright browser tests (see **Testing**). Screenshots go to `tests/shots/` (ignored). |
| `docs/` | `COOP.md` (design, protocol, deploy), art briefs for town, characters and downtime. |
| `manifest.webmanifest`, `icon-*.png` | Add to home screen. |

## Game systems
- **Meta loop.** Operatives die permanently. Resolve buys training and cell upgrades (Heirloom keeps one piece of gear: anything upgraded, rerolled, non-common or bought qualifies; the best piece is locked in automatically on death and can be swapped on the death screen; stock Weapons Cache issue never qualifies, and the heirloom replaces the cache piece in its slot). Feats, the leaderboard, the journal, shuttle fittings and ventures persist; Marks and gear die with the operative. Settings has save codes (move a cell between devices) and the run report.
- **Title and creation.** Title: Continue (with the operative's composited still), New cell, Leaderboard, Feats, Manual, Settings. Creation in three steps: body (four bodies with the pack's portraits), class (four backgrounds, each +2 to an attribute, a lasting perk, starting gear and skill), details (name, six hairstyles, six skin tones, six hair colours, attributes). Live preview is the composited figure.
- **The yard.** Walk with arrows/WASD or tap. Freight terminal opens Missions on entry; other shops open by talking to their NPC (Marrow: Black Market, Ilse: Clinic, Cass: Character & Resolve with a Gear tab). Noodles (+5% XP until next in town), tenement stim, vending terminal, poster and barracks lines. Attribute points spend from the yard. Escape closes any menu or leaves a room. Rails and door aprons are walkable.
- **Gear.** Six slots. Items `{ base, rarity, level, bonuses, trait, premium? }`, Common to Legendary plus boss Uniques, base tiers 0 to 6 (tier 6 Warden-pattern set and others added in v5). Black Market: six random pieces, restocks after each raid, Compare popup, nothing is ever sold. v5 scaling: `shopBand` reaches tier 6 at sector 15, `shopFloor` drops the bottom tiers as you go deeper, and from sector 5 most pieces arrive pre-upgraded (`shopLevel`: +1 per 5 sectors up to +3, priced at 85% of the bench cost via `premium`). Upgrades +1..+5 and rerolls on the Gear tab.
- **Combat.** Shoot (ranged, steady, 15% less damage taken that turn) vs Strike (melee, swingy, ignores cover, next hit +15%, some enemies hit back). Skills from weapons and attributes. Intents shown. Auto battle via `E.autoAction`. Battle sprites show the class outfit and the equipped weapons.
- **Raids.** Three rooms per sector via two doors, a boss every fifth sector, four maps with mechanics, 15 named sectors each (beating the sector-15 boss liberates a map; liberating all four plays the ending; past 15 the names loop as Sublevels). No optional veteran door in sector 1. v5: every sector after the first (bosses excepted) rolls a **condition** (`SECTOR_CONDS`: Blackout, Coolant Leak, Double Patrols, Supply Depot, Hunter Squad, Derelict Wing, Sealed Bulkheads) shown on the route screen, and six **rare doors** appear on every map (`EXTRA_ROOMS`: Marked Officer bounty fight, Strongroom INT crack, Field Medic Station, Weapons Locker gear drop, Machinist's Bench free +1, Smuggler's Stash contraband). 25 events (12 new, with new outcome keys `cash` and `next: 'weakened'`). Results strip on the door screen with feat progress bars; loot, contraband and sector clear are popups. Wanted +1 per raid; lie low at the safehouse.
- **Difficulty tiers** (`HARD`, `hard(s)`, by current sector in a raid and deepest sector in the yard): through sector 5, extracting between bosses loses 45% of the haul, Run/Smoke 65%, enemy HP x1.18, prices x1.10; after 5: 50% / 70% / x1.21 / x1.12; after 10: 55% / 75% / x1.25 / x1.15. Enemy HP includes +8% per tier offsetting Feats. Extracting right after a boss is free.
- **Leaderboard.** `raidScore`: haul brought home + 150 per sector cleared + 25 per kill + 75 per veteran + 500 per boss + 100 per prisoner; dying zeroes the haul. Top 50 in `meta.board`, per device (survives New cell and Reset). Seeded once from `board.json` as Bot #1 to #50, a ladder from about 15,000 down to 1,600. Rank or gap shows after every raid and on the death screen.
- **Feats.** 21 general feats plus one per enemy type (`FEAT_DEFS`), four tiers each (enemy types 1/10/50/100, bosses 1/3/10/25). Each tier adds a small permanent buff, shrinking by `FEAT_FALLOFF` (0.5, 0.4, 0.3, 0.2 of `per`); the big ones pay Resolve on top tiers. `featBuffs(meta)` feeds stats, damage (including per-enemy), credits, escape and XP. Unlock toasts, after-fight bars, a Feats screen, and totals on the Character tab.
- **After curfew** (second row of buttons in the yard, host only):
  - *The Lantern:* KEG-7 the droid bartender tells jokes; a round (+1 ATK, +4% crit next raid); regulars Vess, Juno and Sable with flirty lines and tips.
  - *The Wheel:* European roulette, ten bet types at real payouts, stakes 10 to 250, animated wheel that lands on the result.
  - *Orbit:* turn-based shuttle fights (Fire, Evade, Overcharge, Jump) at three tiers, **one run per stay in town** (`char.orbitFlown`, cleared when a raid ends). The cell's first flight is a shakedown (`ORBIT_SHAKEDOWN`: weaker cutter, losing tows you home). After that: low orbit needs 1 refit level, the blockade line 3 plus a low win, the Warden's watch 8 plus a blockade win (`orbitLock`). Permadeath warnings on the yard, each card and the fight; launching takes a confirm click; intent tips in the fight. Losing the shuttle kills the operative (an Ejection pod fitting gives a 50% save once). Wins pay credits and, on the two harder tiers, one of five permanent **Marks** per operative. Refits cost credits; three fittings cost Resolve and survive death. Each run card shows simulated odds for the current shuttle.
  - *Ventures:* three cell-owned investments that tick once per raid, with capped balances (growth stops at the cap): noodle stall +6% / 4% chance to lose 25%, cap 500, always open; Marrow's consignment +12% / 10% to lose 40%, cap 1,500, opens after sector 5; smuggler's bond +18% / 14% to lose 50%, cap 3,000, opens after sector 10. Expected value per raid: about +4.8%, +6.8%, +8.5%.
- **Co-op.** Host runs the game and broadcasts state; the friend's screen mirrors it with operatives swapped. Live at https://cinder-cell.thomaslafata0.workers.dev (one Worker serves the game and relay; `npx wrangler deploy` from the repo root). Shared yard, gifts and trades, a shared Lockup, door votes, own rewards, downed and revive, reconnects and invite links: see `docs/COOP.md`. Downtime is host only.

## Art
- **Town pack** (`town/`): complete, in use.
- **Character pack** (`chars2/`): four bodies (town 8 strips, battle 6), four class outfits, six hairstyles (town strips pinned to one shape per direction; battle hair for all four bodies in `hair/<id>/battle.png` atlases), eight weapons (battle idle/attack/charge with per-frame tips), four portraits. Battle hair was cut from PixelLab hair states of battle body m1 (north-east rotation) and pinned to the head in every frame by shape matching (`tools/bhair_build.py`); death-fall frames keep the hair upright.
- **Downtime pack:** ships delivered (PixelLab, `downtime/ships/`, also shown on the orbit run cards). Still missing: bar portraits and backgrounds (brief in `docs/DOWNTIME_ART_PROMPT_CHATGPT.md`). Portraits are picked up automatically; `bg:orbit` is already wired in `downtime.js`.

## Balance
Commands: `node sim.mjs 100 30`, `MAP=port node sim.mjs 100 40`, `node sim-builds.mjs 60 60` (or `ONLY=a,b`), `ECON=1` for the economy, `ABLATE=perk:x|unique:x|trait:x|bonus:x|loot` for outliers, `TUNE='{...}'` overrides, `node sim-coop.mjs` / `SOLO=1 node sim-coop.mjs`, `node sim-board.mjs 40 25 > board.json` to rebuild the seed board. Sims count boss progress by cleared sectors (`bestByMap`), not `bestSector`, which counts entry.

Current numbers (median operative to reach each boss, main bot):
| Boss | Operative |
|---|---|
| Garrison sector 5 | 3 |
| Garrison sector 10 | 10 |
| Garrison sector 15 | 21 (93% within 30) |

Builds at 60 campaigns, operatives to the sector-15 boss: strength 20, balanced 20, tank 20, intellect 22, strAgi 22, hybrid 22, dotBuild 22, charisma 23, meleeOnly 24, critStack 25, rangedOnly 26, agility 28, glass 31 (92%). Cautious play 11, greedy 37 (15% finish). Orbit (`node tests/orbit-sim.mjs`, sensible pilot / fire-spammer): shakedown 100/100%; low orbit with 1 refit 98/77%; blockade line at 3 refits 68/10%, at 4 79/19%; Warden's watch at 9 refits 41/70%, maxed 84/85%. v5 rooms, conditions, items and shop scaling left the campaign curve where it was (`node sim.mjs`: bosses at sectors 5/10/15 reached at operative 4/10/19 vs 3/11/20 before). Co-op knobs (`coopHp` 1.5, `coopAtk` 1, `coopExtra` 4) are a first guess.

## Testing
Start the server, then from the repo root:
```bash
node tests/ui-test.cjs        # every main screen at 1200 and 390 px, overflow and console errors
node tests/flow.cjs 390       # fresh save through creation, yard menus, a raid, to death; screenshots each screen
node tests/title-test.cjs     # title, creation, save-code round trip
node tests/town2.cjs          # yard: shops on talk, lie low, noodles, tenement, terminal, walls
node tests/coop-test.cjs      # two tabs over BroadcastChannel, alternating turns
node tests/dt.cjs             # Lantern, Wheel, Ventures, an orbit fight
node tests/feats.cjs          # feat unlock toast, after-fight bars, Feats screen
node tests/board.cjs          # leaderboard seeding, ranks on extract and death, survives New cell
node tests/look-test.cjs      # composited looks grid and in-game screens
node tests/grid.cjs           # yard collision overlay to tests/shots/grid.png
node tests/monkey.cjs 600 71  # random play; args are steps and seed
node tests/orbit-sim.mjs      # orbit odds per tier and refit level
node tests/heirloom.mjs       # heirloom eligibility, auto-pick, Weapons Cache interplay
node tests/coop-revive.mjs    # co-op rules: downs, revives, last stand, votes, separate rewards
node tests/coop-town.cjs      # two tabs: shared yard, gifts, trades, the Lockup
```
Each prints `no errors` per width when clean. Look at the screenshots in `tests/shots/` after UI changes, at both widths. The monkey can loiter in the Gear popup clicking hidden header buttons; that is the test, not a bug.

## Publishing
Artifact tool, publish `index.html` with `url` set to the live link, `root` set to the repo, and `files` listing changed modules (for example `{"engine.js": "engine.js"}`). Unlisted files already published are kept, so art only goes up once. The artifact holds at most 511 files: pack new art into atlases rather than adding many small files. If a publish is refused because files changed since this session last saw them, list the artifact's files (`scope: files`) or read them, compare with `git show <previous commit>:<file>`, and republish. Push with `git push -u origin loot-and-gear`.

## Next
1. **Owner feedback.** Ask for a run report after a few sessions; tune from it.
2. **Hair on portraits** (battle and town hair are done).
3. **Downtime art:** bar portraits and backgrounds.
4. **Co-op:** tune from real sessions (`sim-coop.mjs`). Next ideas: team moves in combat (set-ups, cover, passing a stim), the friend's after-curfew activities, spectating for a fallen player, per-player events, co-op feats and a duo board.
5. **Smaller polish:** furniture collision inside interiors (only the floor rectangle is used), a Tiled map for the yard if the artist makes one, and merging `loot-and-gear` into `master` when the owner agrees.

## Changes in v5
- **Heirloom:** fixed orbit (and raid) deaths offering nothing when the operative only had upgraded starter gear; auto-pick on death; message when nothing qualifies; Weapons Cache interplay explained in the UI and on the new operative's arrival notice (`heirloomWorthy`, `heirloomChoices`, `autoHeirloom` in `engine.js`).
- **Orbit:** permadeath made unmissable, confirm-to-launch, shakedown first flight, refit/win gating, fight tips, one run per town stay, PixelLab ship art and a better backdrop.
- **Hair:** town flicker fixed (stable shapes, exact colour swap); battle hair added for every body.
- **Ventures:** unlocks at sectors 5 and 10, caps 500 / 1,500 / 3,000, the bond rebalanced from a coin flip into the best (still risky) option.
- **Items:** 8 new contraband (Adrenal Spike, Blood Tithe, Iron Lung, Tripwire Kit, Kevlar Padding, Coup de Grâce, Ghost Protocol, War Paint), 17 new gear bases including a tier-6 Warden-pattern set, all with icons.
- **Shop scaling:** higher tiers, a rising floor and pre-upgraded stock as the cell goes deeper.
- **Raid depth:** sector conditions, six rare doors on every map, 12 new events; Manual updated.
- Save stays `VERSION = 4`: new fields (`orbitTierWins`, `char.orbitFlown`, `run.cond`, item `premium`) default safely; older orbit wins count as low-orbit wins.
