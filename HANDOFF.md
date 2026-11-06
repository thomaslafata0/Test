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
| `tests/visual-check.cjs` | Measures every composited character for see-through gaps, faceless profiles, bald wedges, hair over faces and floating bits. |
| `tools/` | `bhair_build.py` (battle hair from PixelLab hair states of battle body_m1), `hair_pin.py` (one stable town hair shape per direction). |
| `sim-balance.mjs` (the main report), `sim.mjs`, `sim-builds.mjs`, `sim-gear.mjs`, `sim-coop.mjs` | Simulators (see **Balance**). |
| `tests/*.cjs` | Playwright browser tests (see **Testing**). Screenshots go to `tests/shots/` (ignored). |
| `docs/` | `COOP.md` (design, protocol, deploy), art briefs for town, characters and downtime. |
| `manifest.webmanifest`, `icon-*.png` | Add to home screen. |

## Game systems
- **Meta loop.** Operatives die permanently. Resolve buys training and cell upgrades (Heirloom keeps one piece of gear, worn or from that operative's Lockup, and it comes back at base level with rarity and bonuses intact; the best piece is locked in automatically on death and can be swapped on the death screen; stock issue never qualifies, and the heirloom replaces the cache piece in its slot). Feats, the leaderboard, the journal, shuttle fittings and ventures persist; Marks and gear die with the operative. Settings has save codes (move a cell between devices) and the run report.
- **Title and creation.** Title: Continue (with the operative's composited still), New cell, Leaderboard, Feats, Manual, Settings. Creation in three steps: body (four bodies with the pack's portraits), class (four backgrounds, each +2 to an attribute, a lasting perk, starting gear and skill), details (name, six hairstyles, six skin tones, six hair colours, attributes). Live preview is the composited figure.
- **The yard.** Walk with arrows/WASD or tap. Freight terminal opens Missions on entry; other shops open by talking to their NPC (Marrow: Black Market, Ilse: Clinic, Cass: Character & Resolve with a Gear tab). Noodles (+5% XP until next in town), tenement stim, vending terminal, poster and barracks lines. Attribute points spend from the yard. Escape closes any menu or leaves a room. Rails and door aprons are walkable.
- **Gear.** Six slots. Items `{ base, rarity, level, bonuses, trait, premium? }`, Common to Legendary plus boss Uniques, base tiers 0 to 6 (tier 6 Warden-pattern set and others added in v5). Black Market: six random pieces, restocks after each raid, Compare popup, nothing is ever sold. v5 scaling: `shopBand` reaches tier 6 at sector 15, `shopFloor` drops the bottom tiers as you go deeper, and from sector 5 most pieces arrive pre-upgraded (`shopLevel`: +1 per 5 sectors up to +3, priced at 85% of the bench cost via `premium`). Upgrades +1..+5 and rerolls on the Gear tab.
- **Combat.** Shoot (ranged, steady, 15% less damage taken that turn) vs Strike (melee, swingy, ignores cover, next hit +15%, some enemies hit back). Skills from weapons and attributes. Intents shown. Auto battle via `E.autoAction`. Battle sprites show the class outfit and the equipped weapons.
- **Raids.** Three rooms per sector via two doors, a boss every fifth sector, four maps with mechanics, 15 named sectors each (beating the sector-15 boss liberates a map; liberating all four plays the ending; past 15 the names loop as Sublevels). No optional veteran door in sector 1. v5: every sector after the first (bosses excepted) rolls a **condition** (`SECTOR_CONDS`: Blackout, Coolant Leak, Double Patrols, Supply Depot, Hunter Squad, Derelict Wing, Sealed Bulkheads) shown on the route screen, and six **rare doors** appear on every map (`EXTRA_ROOMS`: Marked Officer bounty fight, Strongroom INT crack, Field Medic Station, Weapons Locker gear drop, Machinist's Bench free +1, Smuggler's Stash contraband). 25 events (12 new, with new outcome keys `cash` and `next: 'weakened'`). Results strip on the door screen with feat progress bars; loot, contraband and sector clear are popups. Freed prisoners take several hits before going down (`TUNE.allyGrit`).
- **Difficulty tiers** (`HARD`, `hard(s)`, by current sector in a raid and deepest sector in the yard): enemy HP x1.18, prices x1.10; after sector 5: x1.21 / x1.12; after 10: x1.25 / x1.15. Consumables also scale with the operative's deepest sector (`itemCost`, `TUNE.itemScale` 0.3 per sector).
- **Securing a haul.** Credits and XP earned on a raid are unsecured; no levels mid-raid (`c.xpBank`, `c.safeCredits`). `settle()` pays out when a boss is beaten or on leaving, and leaves `c.payout` for the payout screen. Leaving costs a share by position in the five-sector stretch: 80 / 65 / 50 / 40 / 0% (`TUNE.extractRates`), Run or Smoke 90 / 85 / 75 / 65 / 60% (`escapeRates`). Money walked in with is never touched. The leaderboard haul still counts from raid start.
- **Contraband stacks.** No tiers and no pocket limit. Each piece has `per` (first copy), `r` (each further copy adds r times the last, default 0.85), optional `add` and `whole` in `D.PERKS`; `E.perkValue(id, n)`, `c.perkN`. Bosses always drop it, elites 30% (`ELITE_DROP`), other fights 12% (`FIGHT_DROP`). Offers favour what you already carry. Old tiers migrate to that many copies.
- **Leaderboard.** Global, one row per operative for their whole life (`Board` Durable Object in `coop/worker.js`; `POST /board`, `GET /board?limit=100`). Score is progress only (`groundWorth` in `engine.js`, repeated in the worker): for each district at each threat level, the deepest sector cleared (`mapProgress().best`) is worth 100 per sector + 400 per boss + 1000 for sector 15, times 1 + 0.5 per threat level. Re-clearing adds nothing. Rows are sent after every raid, marked alive or died; the server never lowers a score, treats a died row as final, and doesn't hand out operative ids (rows carry a `tag`). Numbers come from the browser, so a determined cheat is possible. Unsent rows wait in `meta.boardOut`; `meta.board` is this device's best 50 for when the board can't be reached. Dev cells stay off. Live only on `*.workers.dev` or port 8787.
- **Achievements** (called feats in the code). 20 general ones plus one per enemy type (`FEAT_DEFS`), six tiers each (enemy types 1/10/50/100/250/500, bosses 1/3/10/25/50/100). Each tier adds a permanent buff, shrinking by `FEAT_FALLOFF` (0.6, 0.5, 0.4, 0.35, 0.3, 0.25 of `per`); the big ones pay Resolve on top tiers. `featBuffs(meta)` feeds stats, damage (including per-enemy), credits, escape and XP. Unlock toasts, after-fight bars, a Feats screen, and totals on the Character tab.
- **After curfew** (second row of buttons in the yard, host only):
  - *The Lantern:* a bar. `D.BAR.menu`: seven drinks, one per raid (`c.drink` holds the id; `true` in old saves means the gin), each a small edge until you come home.
  - *The Wheel:* European roulette, ten bet types at real payouts, stakes 10 to 250, animated wheel that lands on the result.
  - *Orbit:* turn-based shuttle fights (Fire, Evade, Overcharge, Jump) at three tiers, **one run per stay in town** (`char.orbitFlown`, cleared when a raid ends). The cell's first flight is a shakedown (`ORBIT_SHAKEDOWN`: weaker cutter, losing tows you home). After that: low orbit needs 1 refit level, the blockade line 3 plus a low win, the Warden's watch 8 plus a blockade win (`orbitLock`). Permadeath warnings on the yard, each card and the fight; launching takes a confirm click; intent tips in the fight. Losing the shuttle kills the operative (an Ejection pod fitting gives a 50% save once). Wins pay credits and, on the two harder tiers, one of five permanent **Marks** per operative. Refits cost credits; three fittings cost Resolve and survive death. Each run card shows simulated odds for the current shuttle.
  - *Ventures:* three cell-owned investments that tick once per raid, with capped balances (growth stops at the cap): noodle stall +6% / 4% chance to lose 25%, cap 500, always open; Marrow's consignment +12% / 10% to lose 40%, cap 1,500, opens after sector 5; smuggler's bond +18% / 14% to lose 50%, cap 3,000, opens after sector 10. Expected value per raid: about +4.8%, +6.8%, +8.5%.
- **Co-op.** Host runs the game and broadcasts state; the friend's screen mirrors it with operatives swapped. Live at https://cinder-cell.thomaslafata0.workers.dev (one Worker serves the game and relay; `npx wrangler deploy` from the repo root). Shared yard, gifts and trades, a shared Lockup, door votes, own rewards, downed and revive, reconnects and invite links: see `docs/COOP.md`. Downtime is host only.

## Art
- **Town pack** (`town/`): complete, in use.
- **Character pack** (`chars2/`): four bodies (town 8 strips, battle 6), four class outfits, six hairstyles (town strips pinned to one shape per direction; battle hair for all four bodies in `hair/<id>/battle.png` atlases), eight weapons (battle idle/attack/charge with per-frame tips), four portraits. Battle hair was cut from PixelLab hair states of battle body m1 (north-east rotation) and pinned to the head in every frame by shape matching (`tools/bhair_build.py`); death-fall frames keep the hair upright.
- **Downtime pack:** ships delivered (PixelLab, `downtime/ships/`, also shown on the orbit run cards). Still missing: bar portraits and backgrounds (brief in `docs/DOWNTIME_ART_PROMPT_CHATGPT.md`). Portraits are picked up automatically; `bg:orbit` is already wired in `downtime.js`.

## Balance
`node sim-balance.mjs` is the main report. `SECTIONS=builds,styles,coop,maps,items,early,econ`, `CAMP=60`, `OPS=300`, `TUNE='{...}'` overrides. Bots spend like a player (mods, implants, drinks, upgrades), go home after bosses, and flee when low. Item tests use the `pusher` style, because a bot that leaves on low HP makes healing look harmful: it stops going home to spend. Older tools: `node sim-builds.mjs`, `node sim.mjs` (`ABLATE=` to remove loot), `node sim-coop.mjs`, `node tests/orbit-sim.mjs`.

Knobs in `TUNE`: `earlyCurve` (enemy strength sectors 1-10 until a district has been freed), `reinforce` (by districts already freed), `overFree`/`overStep`/`overMin` (pay drop when overlevelled), `bossRepeatXp`/`bossRepeatResolve`, `coopHp` 2.1, `coopAtk` 1.2, `coopExtra` 3, `coopCr` 1.

Median to the sector-15 boss on the Garrison (operatives / raids): strength 22/69, charisma 21/60, agility 28/89, intellect 25/111, glass 30/90 (88% finish), co-op strength + agility 19/66 per player with about 20% of raids wiping. Cautious 4/55, diver 20/57, greedy 34/43 (43% finish), farmer 6/44. First raid fatal: 20-49% by build. Whole game, solo strength: 67, 95, 116, 132 raids to free each district in turn. These are bots: tune from real sessions next. Careful play still loses far fewer operatives, and farming to level 8 first is still the most efficient route.

- **Menus:** messages raised inside a popup or modal float as toasts (`render`). Inline notices there pushed buttons away mid-click.
- **Sound:** the header button sets `prefs.muted`, which silences effects, ambience and music together.

- **Mods:** 14 in `D.UPGRADES`; each one bought multiplies the price of the rest by `D.MOD_STEP` (`E.modCost`).
- **Loot:** drops can go straight to the Lockup, or the replaced piece can (`E.stashLoot`, `E.takeLoot(..., stashOld)`).
- **iPhone:** `ios/` is a small WKWebView app loading the live site; see `ios/README.md`.

- **Phones:** landscape only (`@media (max-height: 500px) and (orientation: landscape)` in `index.html`). `tests/phone-landscape.cjs` fails if a play screen scrolls or its way forward is off screen; `tests/phone-audit.cjs` lists small tap targets and long menus. Creation has four steps (Body, Class, Look, Stats) and Randomize; Missions, Market and Character have sub-tabs.
- **Battle scenes:** `Stage.background` draws three scenes per map (sectors 1-5, 6-10, 11+); indoor scenes have no rain.
- **iPhone app:** `ios/` builds with Xcode for team `39BW6948KL` (`xcodebuild -scheme CinderCell -destination id=<udid> -allowProvisioningUpdates`, then `xcrun devicectl device install app`).
- **App bridge:** the app adds `CinderCellApp/<version>` to the user agent and three message handlers. The page posts `ready` after its first render (the app's splash fades then), `haptic` from `audio.js` `play()` via the `BUZZ` map (Settings, Vibration turns it off), and `share` from `shareOrCopy()` for co-op invites. Off the app all three fall back quietly. `tests/app-bridge.cjs` fakes the handlers.
- **Phone layout:** one `@media (max-height: 500px) and (orientation: landscape)` block at the end of the stylesheet in `index.html` holds every phone rule. Rules of thumb it keeps: no text under 11px, nothing you tap under 38px, play screens fill the display and never scroll, menus are full-screen sheets that scroll inside. The root font size scales with the usable width (14 to 16px), and an iPhone's notch and home bar leave about 750 x 370, so test with insets. `tests/phone-read.cjs` checks text size, tap size and empty screens (`SHEET=dir` writes contact sheets of every screen); `tests/phone-landscape.cjs` checks nothing scrolls. Both emulate the notch.
- **Invite links open the app:** the worker serves `/.well-known/apple-app-site-association` for `?join=CODE`, and the app has the Associated Domains entitlement (`ios/CinderCell/CinderCell.entitlements`). With the app installed, a tapped invite opens it in that room (`AppDelegate` passes the URL to `GameViewController.open`); without it, Safari joins the same room.
- **Co-op on phones:** `tests/coop-phone.cjs` plays host and friend side by side at iPhone size, checking every screen on both. Co-op enemies hit x1.3 (`TUNE.coopAtk`), up from 1.2: two players reached sector 15 with 25-40% fewer operatives than solo.
- **Patch up:** under 80% HP the Missions deploy column leads with a Patch up button, and the Clinic shortcut shows your HP in red.
- **Safehouse tabs:** Resolve, Operative, Record, Gear and Lockup are one row of tabs in the popup header (`townPopup`); a `popup` action with `data-k` picks the Character sub-tab.
- **Menu headers:** a town menu's first tab row is lifted into its header (`townPopup`); on narrow screens the tabs drop below the title. The downtime window's class is `dtm-<id>`, not `dt-<id>`, which is the inner layout.

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
node tests/board.cjs          # global board: run `npx wrangler dev --port 8787` first. API, career rows, two players, offline queue, dev cells
node tests/menu-clicks.cjs    # buying in a menu must not move the buttons under the cursor
node tests/coop-wipe.cjs      # friend bleeds out, host fights on and falls: both death screens
node tests/look-test.cjs      # composited looks grid and in-game screens
node tests/grid.cjs           # yard collision overlay to tests/shots/grid.png
node tests/monkey.cjs 600 71  # random play; args are steps and seed
node tests/orbit-sim.mjs      # orbit odds per tier and refit level
node tests/heirloom.mjs       # heirloom eligibility, auto-pick, Weapons Cache interplay
node tests/raid-rules.mjs     # banked XP, extract rates, Lockup and heirloom, contraband stacks, prices, allies
node tests/visual-check.cjs   # every composited character; prints flagged frames, writes tests/shots/visual-town.png
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

## Changes in v7
- **Character bodies:** the outfit files hold only what differs from body_m1, so `compose()` in `look.js` now builds every town and battle figure on body_m1 with the outfit, and swaps in the chosen body's head (body_m2's from the side, the only clean profile). Below the neck all four bodies look the same; truly different builds need per-body outfit art from PixelLab. `tests/visual-check.cjs` checks clothes match below the head.
- **Ventures** moved from the cell to the operative (`c.ventures`, `E.vent`) and die with them. Old cell-wide balances go to the current operative. Extraction payout is itemised: earned, bribe, what you keep.
- **Persistent operatives:** the friend's own save is the real home of their operative (`home` in `index.html`). The host borrows a copy (`E.joinPartner`, `char2`), and `syncHome` writes it back whenever the raid isn't in progress or a payout has just secured it, along with Resolve earned, best sector and achievement counts. Their own training and upgrades travel in `c.home`; buying training as a guest spends their own Resolve. Stats use the host's achievement buffs while in co-op. `c.uid` matches copies, and the newer `savedAt` wins. A friend who drops mid-raid and never returns keeps the operative as of their last secured point, including not dying if they would have.
- **Cloud saves:** `Vault` Durable Object in `coop/worker.js`, `/save/<12-char code>`, last 6 versions, 3 s write limit. Client in `index.html` under cloud saves: pushes at most twice a minute and on leaving the page; at start, the newer of local and cloud wins. Local copies are compared by `state.savedAt`, set only when the save body changes. Only on `*.workers.dev`.
- **Dev mode:** Settings, code 444481 (`DEV_CODE`, readable by anyone looking at the page source: a convenience, not security). Panel in `devView`, full-game autoplay in `dev.js`, Fast or Watch, using `sim-gear.mjs`, which is now published. Sets `meta.dev`, which keeps the cell off the leaderboard.
- **Title:** offers to go back to the last room (`getLastRoom`) rather than rejoining by itself, so playing solo stays one click away.
- **Tests:** none of the live two-browser checks are in the repo yet except `tests/coop-town.cjs`, which runs locally.

## Changes in v6
- **Character repairs** at compositing time in `look.js`: all bodies use body_m2's side strips (the only clean profile), hair fits to the forehead from the side and stops at the hairline from the front, `closeGaps` fills see-through gaps, `dropStrays` removes floating bits. Battle poses still have some large arm-and-weapon pockets, reported for information by the visual check.
- **Raid economy:** see **Securing a haul** and **Contraband stacks**. Elites +45% HP and +22% ATK (were 35% and 15%), contraband drop 30% (was 40%), Wanted removed, Lockup per operative and lost on death, feats renamed Achievements in the UI with six tiers.
- **Balance is mid-pass.** Median operative to boss 5 / 10 / 15, 40 campaigns each, before then after: strength 4/10/20 then 6/11/20, agility 4/15/28 then 6/15/28, intellect 9/12/25 then 11/15/25, charisma 6/18/25 then 7/16/23, glass 4/14/28 (85%) then 7/19/32 (78%), cautious 2/5/12 then 4/6/9, greedy 11/28/37 (20%) then 18/35/39 (3%). Bots ignore extract costs and hold 1,100 to 1,800 unspent credits at death.

## Changes in v5
- **Heirloom:** fixed orbit (and raid) deaths offering nothing when the operative only had upgraded starter gear; auto-pick on death; message when nothing qualifies; Weapons Cache interplay explained in the UI and on the new operative's arrival notice (`heirloomWorthy`, `heirloomChoices`, `autoHeirloom` in `engine.js`).
- **Orbit:** permadeath made unmissable, confirm-to-launch, shakedown first flight, refit/win gating, fight tips, one run per town stay, PixelLab ship art and a better backdrop.
- **Hair:** town flicker fixed (stable shapes, exact colour swap); battle hair added for every body.
- **Ventures:** unlocks at sectors 5 and 10, caps 500 / 1,500 / 3,000, the bond rebalanced from a coin flip into the best (still risky) option.
- **Items:** 8 new contraband (Adrenal Spike, Blood Tithe, Iron Lung, Tripwire Kit, Kevlar Padding, Coup de Gr\u00E2ce, Ghost Protocol, War Paint), 17 new gear bases including a tier-6 Warden-pattern set, all with icons.
- **Shop scaling:** higher tiers, a rising floor and pre-upgraded stock as the cell goes deeper.
- **Raid depth:** sector conditions, six rare doors on every map, 12 new events; Manual updated.
- Save stays `VERSION = 4`: new fields (`orbitTierWins`, `char.orbitFlown`, `run.cond`, item `premium`) default safely; older orbit wins count as low-orbit wins.
