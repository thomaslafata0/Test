# Cinder Cell: story bible

The working reference for all story text. The lines themselves are in `lore.js`. Existing names in `data.js`, `town.js` and `index.html` take priority over anything here.

## The short version

Kessa Yard's quota was never about steel. The furnaces are throttled from a booth so the town always falls short, and every ton short is paid with a name on the transfer roster. Those people are alive, waiting in Detention and going up the Lift as "confiscated goods". Everyone the cell recruits is already on that roster. Ostrane's books also count a dead raider as a head paid, so each name on the wall spared someone in the yard, and Cass has known that from the first year. The only way to stop paying is to stop the lift.

## Kessa Yard

A freight and foundry town at the foot of the orbital lift, on a smog-brown world. It cast the anchor plates that hold the cable down. For sixty years a shift bell ran everyone's day. People say "before" and don't need to finish the sentence.

## How the Directorate took it

Three years ago, with paper first: a supervision order over an unpaid debt on the lift contract. Halvek brought it to the gate. The casting floor shut its doors and held for eleven days. On the twelfth the siege crawlers came through, and by morning the bell was ringing again. Since then the quota has doubled, the curfew has moved to dusk, and people stop coming to work.

## The machine (what is really happening)

Lower-case words on purpose: the quota, the roster, the book, the ledger. No new proper nouns are needed.

1. The Control Booth holds every furnace below a third of output. The yard cannot make its number.
2. Each ton short puts a name in the overseer's book. The shift chooses the name, and most shifts do.
3. Names go onto Ostrane's roster. Notice is ninety days (the tally on the shift locker in the yard stops at ninety). Arrest orders for collection are signed in bundles with the names left blank.
4. Detention keeps those collected fit to travel. Nobody there is marked dead. Kell is proud of this.
5. The Lift carries them in containers with air holes, forty bunks and a water line. The manifest calls them "Confiscated goods, Kessa Yard". They are sold on arrival as labour, alive, and Vane is paid per unit.
6. Accounting quirk: a raider killed on Directorate ground comes off the yard's number for the quarter.

## The cell

Named for the brick chamber under a furnace where ash is raked to cool: too hot to search, too filthy to bother with. Six people met there. Cass is the only one still in the yard.

**Why it keeps sending people to die.** The surface answer is the one in the intro: each operative leaves Resolve, meaning training, routes and nerve. The first deep answer is that Cass only recruits from the roster, people with a date coming up. "You were already gone. I only change where." Hence "maybe you will be the one to make it out": out of a sentence they already have. The second deep answer is the sum: each operative who dies keeps one name in the yard from being collected. Cass found that line in a stolen audit and told nobody. The wall is a memorial and a receipt.

## Why bosses come back

Operatives can't stay to check. Every defeat line ends with the boss dragged off, never confirmed dead. Directorate surgeons patch up nearly anything (the `surgeon` event: "I patch up whoever comes through that door"). Bosses mention it: Halvek's stitches, Brask docked a day's pay, Ostrane recorded dead on a Tuesday. Crawlers are many units, so each map's crawler is a different machine with a different person inside. Boss uniques can drop every time: Halvek has more pistols, and Ostrane has a drawer of datapads.

## What lies at the end of each district

Boss order comes from `D.MAPS[..].bosses` at sectors 5, 10 and 15.

| District | 5 | 10 | 15 and last sector | What is there | Piece of the through-line |
|---|---|---|---|---|---|
| Directorate Garrison | Halvek | Crawler (Siege Hangar) | Ostrane, Supervisor's Spire | Her office and the whole roster | Your name has a date. Cass recruits from this list. |
| Foundry Works | Brask | Crucible (Furnace Core) | Crawler, Control Booth | One chair, one dial per furnace | The shortfall is set on purpose. |
| Detention Complex | Kell | Crawler (Interrogation Suite) | Ostrane, Warden's Tower | The block laid out below, the sum | A dead raider counts as a head paid. Cass knows. |
| Orbital Lift Port | Vane | Crawler (Control Tower) | Ostrane, The Lift | The paper ledger, the cable | Everyone taken is alive. Your dead are in a column headed Paid. |

The existing ending ("The yard rises": gate open, furnaces cold, cells empty, lift stopped) already fits. What it leaves open is the people still up the cable, which gives the threat levels their reason: the Directorate sends more, and the cell has a ledger of where everyone went. The `dawn` codex entry says this. The ending screen itself is unchanged, and could take one more line later: "The ledger is open on the safehouse table. There are a lot of people still up there."

## People in the yard

| Name | Who | Under the surface |
|---|---|---|
| Cass (no pronoun used so far) | Handler at the safehouse, wiry, smoking. Keeps the wall. | Recruits from the roster, knows the sum, paints every name the same night. |
| Doc Ilse | Back-room medic in the laundry. | Trained one of the Directorate surgeons who keep the bosses working. Won't say which. |
| Old Marrow (he) | Fence with a shipping-container stall. "No receipts. No refunds." | His stock is what the lifted leave behind. He knows whose it was. |
| The dispatcher | Freight terminal, hi-vis, tired. | Reads the manifests and passes collection dates to Cass. |
| The kid | Runs messages by the fire. Dad worked the casting floor, "before". | Dad is on the ledger. May be the only person left who knows every name. |
| Noodle vendor, the worker | Yard colour. | The worker's "they fine us for it" is the quota in small. Leave them ordinary. |
| KEG-7 | Loader droid behind the bar at the Lantern. Says nothing. | Came off the port. Its old cargo log has weights that never matched steel. |
| Juno (brief only) | Grounded lift pilot, patch torn off her jacket. | Asked why a load of steel needed a water line. Marks routes in the ledger at the end. |
| Sable (tug in `data.js`, bookkeeper in brief) | Marrow's cousin. Owns the tug, keeps the books. | Knows what a sold head is worth. Unused in `lore.js`. |
| Vess, Ratchet (brief only) | Floor at the Lantern, fixer at the Wheel. | Unused in `lore.js`. |

Juno, Sable's bookkeeping, Vess and Ratchet come from `docs/DOWNTIME_ART_PROMPT_CHATGPT.md`; that art has not been delivered and they aren't in play yet. Only Juno appears in `lore.js` (two codex entries).

## Reveal order

Each piece stands alone, because players can clear maps in any order: Garrison and Foundry are open from the start, Detention opens at sector 5 and the Port at sector 10. Scenes play per operative, so the cell will see them more than once. They should always be skippable, and after the cell has seen a scene the UI could play only its last beat.

| Stage | When | What the player learns | Where |
|---|---|---|---|
| 1. Ambient | First raids | Quotas, ninety scratched days, things feel off | Existing yard lines, `MAP_INTROS` first bands, `FALLEN` |
| 2. Numbers | Sector 5 bosses | Orders signed before names. Shortfall paid in people. The missing are alive and kept healthy. They leave as freight. | Halvek, Brask, Kell, Vane scenes |
| 3. People inside | Sector 10 bosses | A yard worker is welded into each crawler. The Crucible reads the transfer list, and your name is on the reel. | Crawler (Garrison, Detention, Port), Crucible |
| 4. Design | Foundry sector 15 | The shortfall is deliberate. | Crawler at the Control Booth |
| 5. Betrayal | Garrison sector 15 | The cell recruits from Ostrane's roster. Cass's own words follow in the codex. | Ostrane at the Spire |
| 6. The sum | Detention sector 15 | Each death pays for someone. Cass knows. | Ostrane in the Tower |
| 7. The ledger | Port sector 15 | They are all alive. The dead are in a column headed Paid. | Ostrane at the Lift |
| 8. After | Ending, threat levels | Lift stopped. Many still up there. | `dawn` codex entry |

`FALLEN` stays neutral until 100+, where one line hints at the sum: "Someone in the yard is alive tonight because of them." Keep it there.

## Writing rules

Short lines for a phone's name-card: aim under 90 characters, never over 120. Menacing and human. Nothing sexual, no graphic torture, interrogation stays implied. Each boss has one voice:

- **Halvek:** tired gate clerk. Forms, logs, shifts. Short sentences.
- **Crawler:** recorded loudspeaker in capitals, with a frightened person underneath it.
- **Ostrane:** auditor. Full sentences, no contractions, never raises her voice.
- **Brask:** loud foreman, shift slang, tonnage, a laugh that goes bad.
- **Crucible:** no will of its own. An old shift caller on a spliced tape, gentle, plus narration.
- **Kell:** bedside manner. Care and courtesy, always sincere.
- **Vane:** courteous officer. Longer sentences, ship and freight terms, "one does".

# Boss fight design

**Built.** The table below is the original proposal. What runs is `D.BOSS_KIT` in `data.js` and the boss section of `engine.js`, and the tips in `lore.js` state its true numbers; where they differ, those win. Current rules this builds on: `D.SPECIALS` (one special per boss, Defend halves it and blocks its status), `checkPhase` (one phase at 50%: ATK +20%, more heavy and special, no more guarding), intents shown before they happen. New moves should telegraph the same way, one intent turn or more. The `phase[50]` first line in `lore.js` is the existing `BOSS_INFO.phase2` text word for word, and `firstIntro[0]` is the existing `line`.

The crawler and Ostrane fight on more than one map, so `lore.js` gives them `byMap` overrides, which `bossLine` and `bossLines` apply when passed `{ map }`. The crawler's fall back to the base script (written for the Garrison), and Ostrane's Garrison lines are the base too. Move mechanics stay the same on every map.

## Personalities and phases

| Boss | Personality | 75% | 50% | 25% |
|---|---|---|---|---|
| halvek | Bored gate official. Violence is admin. | Starts using Gatehouse Shutter. | Gloves off (existing). Stops Confiscation, fights with fists and pistol. | Execution order every third turn. Shutter stays down for good, so no Run. |
| crawler | Machine on a loop, a terrified person on the key. | Hull breach: DEF -1, Anchor Stomp unlocked. | Redlines (existing). Siege Round unlocked. Stops self-repair. | Key-holder panics: fires every turn, 25% of shots go wide. |
| ostrane | Auditor. Knows the average and where you sit against it. | Starts Redact. Still reading, one hand busy. | Datapad down (existing). SPD +2, Final Audit unlocked. | Short fuse on the audit: 1-turn count instead of 2, every third turn. |
| brask | Worker who took the coat. Loud, ashamed underneath. | Overtime unlocked. | Wades in (existing). Shift in Front stops; he wants this himself. | Overtime every other turn, no longer winded afterwards. He takes 3% max HP per use. |
| crucible | A furnace with a roll-call tape. | Glowing: Strikes against it burn you for 1 turn. | White-hot (existing). Slag Floor lasts 4 turns. | Tape calls your name. Roll Call every other turn, no self-repair, takes +15% damage. |
| kell | Sincere nurse-warden. Believes she saves lives. | Count Time unlocked, 3 turns on prisoners. | Glasses off (existing). Lights Out unlocked. | Throws away her keys: no Run for the rest of the fight. Solitary twice as often. |
| vane | Polished officer who sees cargo. | Officer's Salute unlocked. | Tower guns (existing): sniper chance on this fight goes 20% to 40%. | Coat off. No more Salute. Container Drop every third turn, plain fire twice in a row. |

## New signature moves

| Boss | Move (`id`) | Effect | How to counter | Animation brief |
|---|---|---|---|---|
| halvek | Gatehouse Shutter (`shutter`) | 2 turns: Shoot deals 50%, Run is blocked. | Strike goes through the bars at full damage. | Rear arm reaches up, grabs an overhead chain and hauls it down; knees dip on the pull; lead hand stays at the holster. |
| halvek | Confiscation (`confiscate`) | 1-turn telegraph, then takes one stim (or another item if none) until the fight ends. Returned when he goes down. | Strike during the telegraph cancels it, or use the stim first. | Lead arm shoots forward palm open, closes on air, pulls back; rear hand tucks it inside the coat. |
| crawler | Anchor Stomp (`anchor`) | 1-turn telegraph, x1.6, then pinned 2 turns (no Run). | Defend on impact blocks the pin. A Strike during the rear-up hits the belly for +30%. | NO ARMS on this sprite: hull tips back on rear legs, front pair lifts high and slams down; turret stays level; dust at the feet. |
| crawler | Siege Round (`siege`) | 2-turn charge, then x2.8. | An ion pulse, or dealing 10% of its max HP during the charge, jams it. Otherwise Defend on the last turn. | NO ARMS: turret locks and dips, hull sinks on its legs, barrel glows through the charge, then big recoil shoves the hull right. |
| crucible | Roll Call (`roll`) | 1 turn open: takes +50%. Next turn heat blast x2. Dealing 12% of its max HP while open chokes the blast and staggers it. | Burst it while open, or Defend through the blast. | Both arms swing back and out, chest plate opens on a hinge, core flares; arms close forward in one pulse as the blast goes. |
| crucible | Slag Floor (`floor`) | 3 turns: each Strike you make costs 5% max HP and sets Burning 1. Shoot is safe. | Stay at range until it cools. Crawler Tread Greaves already stop Burning. | Lead forearm tips down like a ladle, a bright stream pours to the floor; rear hand braced on the hip; torso leans forward. |
| brask | Overtime (`overtime`) | Next turn two hits at x0.7, then he is Exposed 2 turns. | Defend that turn, then hit him while he is winded. | Lead hammer fist jabs, rear fist crosses, then both arms drop and the shoulders heave. |
| brask | Shift in Front (`front`) | 2 turns: forced workers stand in the way, Shoot deals 50%. Holding fire both turns pays +1 Resolve on the kill. | Strike around them, or Intimidate sends them off at once. | Lead hand raises a whistle to the mouth; rear arm sweeps forward, waving others past; he steps back half a pace. Workers drawn as background silhouettes. |
| kell | Count Time (`count`) | Freed prisoners do nothing for 2 turns. With no prisoners, you are Shaken 2. | Defend blocks Shaken. Intimidate breaks the count at once. | Lead arm lifts a key ring and shakes it twice; rear arm folded behind the back; posture dead straight. |
| kell | Lights Out (`lights`) | 2 turns: her intent is hidden, Shoot has a 25% miss chance. | Scanning gear (Directorate Datapad, Ostrane's Datapad) still shows her move. Strike can't miss. Defend on a guess. | Rear hand snaps down a wall breaker at shoulder height; figure drops to silhouette with one lens glint; lead hand moves to the baton. |
| vane | Container Drop (`crane`) | 2-turn telegraph with a shadow on the floor, then x2.5. Defend only halves it. | Smoke avoids it completely. The wreck also blocks tower snipers for 2 turns. | Lead arm rises straight up with one finger raised, holds, then drops like a flag; rear arm behind the back; no step. |
| vane | Officer's Salute (`salute`) | His next shot is a certain crit. If you Shoot on that turn, your shot is a certain crit too. A Strike is parried for 50%. | Trade shots if you have the HP. Otherwise Defend. | Shoulders turn fully side-on, lead arm extends the pistol to full length, rear arm folds behind the back; holds; flash and small recoil. |
| ostrane | Redact (`redact`) | 2 turns: the action type you used last deals 50%, or locks if it was a skill. The intent names which. | Switch: Shoot to Strike, or the other way, or a different skill. | Lead hand holds the datapad at chest height; rear hand flicks a stylus in one hard diagonal stroke. |
| ostrane | Final Audit (`audit`) | 2-turn count, then x1 plus 0.4 per stim or item you used this fight, up to x3. | Spend less in this fight. Defend when the count ends. | Lead arm turns the datapad out toward the player, screen flares white; rear hand draws a sidearm from under the coat and fires once. |

## Notes for integration

- **Fallen count.** `fallenLine(n)` wants deaths. Use `meta.feats.counters.fallen`, falling back to `meta.operatives` minus the living operative for old saves. `meta.fallen.length` stops at 12 (`reallyDie` slices it). Old "retired" operatives from migrated saves are counted in `meta.operatives`, so the fallback can read a little high.
- **Crawler art.** The sprite is a turret on six legs with no arms, so its briefs describe the hull. All other bosses are two-armed figures in side view facing left. The crawler, Halvek and Ostrane have 256-scale HD sheets with 9-frame anims; Brask, Kell, Vane and the Crucible are still 128px. In the 128px sheets the Crucible and crawler have `repair` where the others have `defend`; the crawler's HD sheet has neither.
- **New intents.** The existing `D.INTENTS` set is attack, heavy, guard, repair. Moves here need a telegraph shown in the same place. `BOSS_MOVES[boss][move].tip` in `lore.js` is written for it.
- **New states in the engine.** Pinned, no-Run, per-action damage reduction, hidden intent and item-count tracking don't exist yet. Sim the Strike-forcing moves carefully: Shutter and Shift in Front both push ranged builds into melee.
- **Co-op.** Lines address one operative. `{name}` in a co-op raid should be whoever is acting. Confiscation and Redact need a rule about which player they target.
- **Line ownership.** `taunt` is the boss talking. `playerLow` is the operative's own head, so show it as narration.
