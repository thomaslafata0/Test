# Cinder Cell: project handoff

Read this first in a new session. It describes the whole project as it stands, how the pieces fit, how to test and publish, and what is next.

## What it is
A browser roguelite (HTML + JS modules, no build step) about a resistance cell raiding an occupied industrial town's four Directorate districts. Original IP **inspired by the tone of Andor; it must not use Star Wars names, characters, logos or designs**. All names live in `data.js`.

- **Live build:** https://claude.ai/artifact/6yZfDr97V6KXSHJs3fx9Pw (private; publishing republishes to this URL).
- **GitHub:** https://github.com/thomaslafata0/Test. Branch `loot-and-gear` holds everything below; `master` is the old single-weapon game. Merge when the owner says so.
- **Owner:** plays on desktop and phone; wants it challenging, funny, varied; uses ChatGPT + PixelLab for art, Claude for code; sends "run reports" (Settings) and a friend will play co-op with them.

## Files
| File | Purpose |
|---|---|
| `index.html` | All screens, CSS, input, rendering glue, co-op client logic. One `<script type="module">`. |
| `engine.js` | All rules, pure (no DOM). `VERSION = 4` saves; `migrate()` upgrades old ones. `TUNE` holds the balance knobs. |
| `data.js` | Content: maps, enemies, bosses, quirks, bulletins, gear (`GEAR`, `RARITY`, `BONUSES`, `TRAITS`, `BOSS_UNIQUE`), implants, perks, events, contracts, backgrounds. |
| `stage.js` | Animated battle canvas (384x216): sprites, effects, boss intro, partner sprite in co-op, Manual/Auto 1x/Auto 2x buttons. |
| `town.js` | The walkable yard: layout, outline collision, doors to interiors, NPCs, hotspots, tap-to-walk. Art in `town/`. |
| `downtime.js` | Code-drawn roulette wheel (`Wheel`) and orbit fight scene (`OrbitScene`); loads `downtime/manifest.json` art when delivered. |
| `look.js` | Character looks (body, class, hair, colours). Composites layered sheets from `chars2/` when the pack exists; falls back to the single player sprite. |
| `net.js` | Co-op transports (WebSocket relay, BroadcastChannel for two tabs) and the `Net` session. |
| `coop/worker.js`, `coop/wrangler.toml` | The Cloudflare relay (Durable Object per room code). Not yet deployed. |
| `audio.js` | Synthesised SFX, optional drone/rain, and music (`music/town.mp3`, `music/raid.mp3`, crossfaded). |
| `icons.js`, `portraits.js` | Code-drawn pixel icons and fallback portraits. `gearIconKey()` maps gear ids to icons. |
| `sprites/` | PixelLab battle sheets for all characters + `manifest.json`. |
| `town/` | Town art pack (tiles, buildings, interiors, props, chars) + `manifest.json`, `CHECKLIST.md`. |
| `chars2/manifest.json` | Placeholder (`pending: true`). Replace with the character pack when delivered. |
| `sim.mjs`, `sim-builds.mjs`, `sim-gear.mjs`, `sim-coop.mjs` | Simulators (see Balance). |
| `sim-board.mjs`, `board.json` | Builds the seed leaderboard: 50 simulator raids labelled Bot #n, spread from a sector-20 run down to a sector-4 one. Rebuild with `node sim-board.mjs 40 25 > board.json` after balance changes. |
| `docs/COOP.md` | Co-op design, protocol, Cloudflare deploy steps. |
| `docs/CHARACTER_ART_PROMPT_CHATGPT.md` | The art brief for the character customisation pack. |
| `docs/TOWN_ART_*.md` | The earlier town art briefs. |
| `manifest.webmanifest`, `icon-*.png` | Add-to-home-screen support. |

Conventions: ASCII-only JS/HTML (non-ASCII as `\uXXXX`); 2-space indent; data-driven content; every mechanic gets a simulator check; commits end with the session's attribution lines.

## Game systems
- **Meta loop:** operatives die permanently; Resolve (permanent) buys training and cell upgrades (incl. Heirloom: keep one piece of gear on death). Journal of every event in `meta.journal`; Settings > "Copy run report" exports it with the full state. Settings > save codes move a cell between devices.
- **Title screen** on load (Continue / New cell / Manual / Settings & co-op). **Creation** in three steps: body (4 placeholders until the art lands), class (the four backgrounds, each with +2 to an attribute, a lasting perk, starting gear and a starting skill), details (name, hair, skin and hair colour, attributes). Looks are stored in `c.look`.
- **Town (Kessa Yard):** walk with arrows/WASD or tap; buildings use outline collision; freight terminal opens Missions on entry, the other shops open when you talk to their NPC (Marrow = Black Market, Ilse = Clinic, Cass = Character & Resolve with a Gear tab). Noodle vendor (+5% XP until next in town), tenement stim (once per operative), vending terminal, poster, barracks lines. Attribute points can be spent from the town screen. Escape closes any menu or leaves a room. Shortcut bar under the yard opens any menu.
- **Gear:** six slots (ranged, melee, head, chest, legs, gadget). Items are `{ base, rarity, level, bonuses, trait }`; Common/Rare/Elite/Legendary plus boss Uniques. Black Market: six random pieces, restocks after each raid, Compare popup; nothing is ever sold (buying replaces, drops are take-or-leave). Upgrades +1..+5 and rerolls on the Gear tab.
- **Combat:** Shoot (ranged, steady, take 15% less damage that turn) vs Strike (melee, swingy, ignores cover, next hit +15%, some enemies hit back). Skills from weapons/attributes (every class starts with one). Intents shown ahead; scanner gadgets show the next one too. Auto battle uses `E.autoAction`.
- **Raids:** 3 rooms per sector via two doors (no optional veteran door in sector 1), boss every 5th sector, four maps with mechanics; results show as a strip on the door screen; loot, contraband and sector-clear are popups. Extracting between bosses costs 45% to 55% of the raid's haul by tier; after a boss it's free; Run/Smoke cost 65% to 75%. Wanted +1 per raid survived; lower it at the safehouse (Lie low).
- **Leaderboard:** every raid is scored when it ends (`raidScore`: haul brought home + 150/sector cleared + 25/kill + 75/veteran + 500/boss + 100/prisoner; dying zeroes the haul). `recordScore` keeps the top `BOARD_SIZE` (50) in `meta.board`; the rank shows in the after-raid notice and on the death screen. The board is per device: `keepBoard` in `index.html` carries it across New cell and Reset, and `seedBoard` fills it once from `board.json` (bot rows, `bot: true`). Title screen > Leaderboard.
- **Feats (achievements):** `D.FEATS` plus one per enemy type (`FEAT_DEFS` in `engine.js`, built at import). `feat(s, key, n)` counts and unlocks tiers (Resolve on top tiers, `s.featUnlocks` for the toast, `r.featTouched` for the after-action bars via `featProgress`). `featBuffs(meta)` (cached per `meta.feats.v`) feeds `statsOf` (hp, crit, dodge, stim), `hitMult` (atk / ranged / melee / per-enemy), `creditMult`, `runChance`, `gainXp`. `FEAT_FALLOFF` halves the listed `per` values; enemy HP in `HARD` carries +8% per tier to offset them (sim: finale 21 with Feats vs 22 without). Feats screen: header > Feats.
- **After curfew (downtime):** second tool row in the yard, host only, `modal` = bar / wheel / orbit / ventures (`downtimeView` in `index.html`; engine section "Downtime"). The Lantern: `buyDrink` (c.drink, +1 ATK +4% crit, cleared in `endRun`), `barLine` cycles jokes/lines per operative. The Wheel: `spinWheel` (European roulette, `BETS`, `STAKES`, stats in `meta.wheel`). Orbit: `s.orbit` fight state, `orbitStart/orbitAct/orbitClose`; losing the shuttle calls `die` (death screen says lost in orbit); `MARKS` (5, `c.marks`, applied in `statsOf`, `creditMult`, `runChance`); shuttle levels in `meta.ship` (`SHIP_PARTS`, credits) and cell fittings (`SHIP_CELL`, Resolve). Enemy stats in `ORBIT_TIERS` were tuned so low orbit is ~85% with a stock shuttle, mid needs level 1, high needs level 3 (~86% win, ~9% death); the UI simulates odds for the current shuttle (`orbitOdds`). Ventures: `meta.ventures` by id, `invest/withdraw`, `tickVentures` once per raid in `endRun`. Art brief: `docs/DOWNTIME_ART_PROMPT_CHATGPT.md`; placeholder `downtime/manifest.json`.
- **Co-op:** see `docs/COOP.md`. Host runs the game and broadcasts state; the friend's screen mirrors it with the operatives swapped (`E.setActor`). Turn-taking fights, enemy targets whoever hurt it most, second enemy action every 4th round; a death ends the raid for both. Tested in two tabs; the WebSocket path needs the owner to deploy the Worker (`cd coop && wrangler deploy`) and host the page on Cloudflare Pages so the friend can open it.

## Balance (final solo pass, owner asked to stop here)
Knobs in `engine.js` `TUNE`. Commands: `node sim.mjs 100 30`, `MAP=port node sim.mjs 100 40`, `node sim-builds.mjs 200 100` (or `ONLY=a,b`), `ECON=1 node sim.mjs ...` for the economy, `ABLATE=perk:x|unique:x|trait:x|bonus:x|loot` for outliers, `TUNE='{...}'` overrides, `node sim-coop.mjs` / `SOLO=1 node sim-coop.mjs`.
- **Difficulty tiers** (`HARD` in `engine.js`, owner's request): through sector 5 extracting between bosses loses 45% of the haul, Run/Smoke 65%, enemy HP x1.18 (x1.10 plus the Feats offset), every credit price x1.10; after sector 5: 50% / 70% / x1.21 / x1.12; after sector 10: 55% / 75% / x1.25 / x1.15. In a raid the current sector sets the tier; in the yard the cell's deepest sector does (`hard(s)`).
- Main bot after the tiers: first boss at operative 3, sector 10 at 11, Garrison finale 22 (94% within 30 lives), Port finale 32 (78% within 40). Before the tiers it was 3 / 9 / 20 / 27.
- Builds at 100 campaigns (operatives to the sector-15 boss): strength 17, balanced 16, tank 17, intellect 19, strAgi/hybrid/dotBuild 19, meleeOnly 22, charisma 24, critStack 25, rangedOnly 25, agility 27, glass 30 (88%). Spread 1.6x; all finish.
- No single perk, Unique, trait or bonus moves the finale by more than one operative.
- Co-op knobs (`coopHp` 1.5, `coopAtk` 1, `coopExtra` 4) are a first guess.

## Testing and publishing
- Local: `python3 -m http.server 8765` in the project; Playwright is pre-installed. Test scripts lived in the session scratchpad (title/creation, town flows, screens at 1200 and 390 px, compare popup, run report, random-play "monkey", two-tab co-op). Recreate as needed: they drive buttons by `data-a` attributes and read the save from `localStorage['cinder-cell-save-v1']`. The title screen must be dismissed first (`button[data-a="continue-title"]`).
- Publish with the Artifact tool: `file_path: index.html` plus `files` for changed modules; unlisted files already published are kept. All art (`sprites/`, `town/`, `music/`) is already published.
- Save version 4; any new per-operative field must default via `||` or be set in `migrate()`.

## Next
1. **Downtime art pack** (`docs/DOWNTIME_ART_PROMPT_CHATGPT.md`): drop into `downtime/`, write the manifest; ships and bar portraits are picked up automatically. Backgrounds need a few lines in `downtime.js` and `barView`.
2. **Character art pack** (`docs/CHARACTER_ART_PROMPT_CHATGPT.md`): drop into `chars2/`, replace the placeholder manifest. Then: make `look.js` composite town walk strips and battle strips (today it only builds the idle_down still), draw the composite in `town.js` and `stage.js` instead of the `player` sheet, show the equipped weapon layer, and add portraits to the creation screen.
2. **Co-op:** deploy the Worker, bake its URL into `net.js` as the default, test over the internet, then balance with `sim-coop.mjs`. Door votes, each player's own contraband pick, a "spectate" state when the host is building a new operative.
3. **Furniture collision** indoors (only the floor rectangle is used), and a Tiled map for the yard if the artist makes one.
4. Owner feedback from run reports.
