# Cinder Cell co-op: how it works and how to set it up

Two players, one cell. The **host** runs the game; the **friend** opens an invite link or enters a room code. You each have your own operative, gear, credits and Wanted level; Resolve, training, cell upgrades and the Lockup are shared.

**In town** you share the yard: you see each other walk around, with a name tag, an arrow when your partner is out of view, where they are, and quick phrases. Walk up to your partner and press E to give credits or gear or to offer a trade. The host picks the mission and the friend marks Ready.

**The Lockup** is a shelf at the safehouse for spare gear, 4 pieces plus two cell upgrades of 2 each, reachable only in town. It outlives operatives, in solo play too. Choose **Buy and keep the old one** when comparing at the Black Market. Operatives have no bag, so a received piece goes on and whatever it replaces goes to the Lockup; a trade that would overflow the shelf is refused with the reason.

**On a raid** you vote on doors (a split vote goes to a coin) and must agree on pushing deeper or extracting. Each player rolls and chooses their own loot and contraband; the raid waits for both. In a fight you take turns, then the enemy acts and picks one of you. At 0 HP you go down: your partner has 3 rounds to spend a turn getting you up (2 the second time), and winning the fight gets you up anyway. A third down in a raid is fatal. If you bleed out you die and the survivor escapes with the escape penalty. If your partner falls while you're down, you die and they get out at 1 HP, so one raid never kills both.

**If a connection drops** it retries on its own, a reload rejoins the room, and a raid waits. The host can play the friend's turn on auto, skip their reward, or carry on without them.

The friend's operative lives in the host's save while you play together. The friend's own solo save is untouched; leaving co-op returns them to it.

## Trying it on one computer (no server)

Away from the live site, leave the Relay URL empty in Settings > Co-op. Host in one tab, open the game in a second tab of the same browser and Join with the code or `?join=CODE`. The tabs talk through the browser itself.

## Playing on two devices

One Cloudflare Worker (free plan) serves both the game and the relay, so there is one URL and no Relay URL to enter. The live site fills it in by itself.

1. From the repo root: `npx wrangler login` (once), then `npx wrangler deploy`. It prints `https://cinder-cell.<your-subdomain>.workers.dev`.
2. One player opens that URL, presses Host in Settings > Co-op and sends the invite link. The other just opens the link. (A code typed into Join works too.)

Re-run `npx wrangler deploy` whenever the game or the relay changes. Files listed in `.assetsignore` (tests, sims, docs, tools) are not published. Nothing is stored on the server: the relay only forwards messages between the two connections for a room code. Saves stay in each player's browser.

## What's in the code

- `coop/worker.js`, `wrangler.toml`, `.assetsignore`: the relay (a Cloudflare Worker with one SQLite-class Durable Object per room code, which the free plan requires) and the static site.
- `net.js`: the client side. `WsTransport` for the relay, `LocalTransport` (BroadcastChannel) for two tabs.
- `engine.js`: `isCoop`, `withActor`, `setActor`, `forEachActor`, `livingActors`, `charAt`. The friend is `s.char2`; the engine always acts on `s.char`, so acting as the friend swaps the two (and the per-operative combat fields in `s.run`) for the duration of the call. Saves are always written unswapped.
- `engine.js` also holds the Lockup and trading (`lockup*`, `trade*`, `give*`), votes (`voteDoor`, `voteExit`), downs (`die`, `reallyDie`, `bleedTick`, TUNE `reviveHp`, `reviveAfter`, `downsPerRaid`, `bleedRounds`). `lootOffer` and `perkOffer` are in the per-operative bag, so offers swap with the actor.
- `index.html`: the host runs every action and broadcasts the whole state after each render, plus an `fx` message so moves animate on both screens at once. The friend mirrors it with the operatives swapped and processes host messages in order. `GUEST_LOCAL` and `GUEST_VIEW` keep each player's menus and notices separate; `queueGuest` holds the friend's actions while the host animates. Walking uses small `pos` messages that skip the state (`town.js`: `setPartner`, `onMove`, `onPartner`). Game actions on the friend's screen are sent to the host; screen-only actions stay local.
- `sim-coop.mjs`: two bots raiding together. `SOLO=1` runs the same simple bot alone for comparison. `LOCKUP=1` makes bots use the Lockup, `NO_REVIVE=1` stops them reviving. Co-op knobs: `TUNE.coopHp` (1.5), `coopAtk` (1.0), `coopExtra` (the enemy gets a second action every 4th round), and the revive knobs above. Revives were tuned so the simple bot pair reaches the sector-15 boss about as often as the same bot alone (32% vs 30% of 60 campaigns within 30 operatives); nothing has been tuned against real co-op play yet.
