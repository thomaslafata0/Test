# Cinder Cell co-op: how it works and how to set it up

Two players, one cell. The **host** runs the game; the **friend** joins with a four-letter room code. You each have your own operative, gear, credits and Wanted level; Resolve, training and cell upgrades are shared. In town you each walk around on your own screen. The host picks the mission; the friend presses Ready at their freight terminal. In a fight you take turns (one move each), then the enemy acts and picks one of you. If either of you goes down, the raid ends for both: the survivor escapes with half the haul.

The friend's operative lives in the host's save while you play together. The friend's own solo save is untouched; leaving co-op returns them to it.

## Trying it on one computer (no server)

Leave the Relay URL empty in Settings > Co-op. Host in one tab, open the game in a second tab of the same browser and Join with the code. The tabs talk through the browser itself.

## Playing on two devices

One Cloudflare Worker (free plan) serves both the game and the relay, so there is one URL and no Relay URL to enter. The live site fills it in by itself.

1. From the repo root: `npx wrangler login` (once), then `npx wrangler deploy`. It prints `https://cinder-cell.<your-subdomain>.workers.dev`.
2. Both players open that URL. One presses Host in Settings > Co-op and reads out the code; the other enters it and presses Join.

Re-run `npx wrangler deploy` whenever the game or the relay changes. Files listed in `.assetsignore` (tests, sims, docs, tools) are not published. Nothing is stored on the server: the relay only forwards messages between the two connections for a room code. Saves stay in each player's browser.

## What's in the code

- `coop/worker.js`, `wrangler.toml`, `.assetsignore`: the relay (a Cloudflare Worker with one SQLite-class Durable Object per room code, which the free plan requires) and the static site.
- `net.js`: the client side. `WsTransport` for the relay, `LocalTransport` (BroadcastChannel) for two tabs.
- `engine.js`: `isCoop`, `withActor`, `setActor`, `forEachActor`, `livingActors`, `charAt`. The friend is `s.char2`; the engine always acts on `s.char`, so acting as the friend swaps the two (and the per-operative combat fields in `s.run`) for the duration of the call. Saves are always written unswapped.
- `index.html`: the host runs every action and broadcasts the whole state after each render; the friend mirrors it with the operatives swapped so their screen is "theirs". Game actions on the friend's screen are sent to the host; screen-only actions (menus, tabs) stay local.
- `sim-coop.mjs`: two bots raiding together. `SOLO=1` runs the same simple bot alone for comparison. Co-op knobs: `TUNE.coopHp` (1.5), `coopAtk` (1.0), `coopExtra` (the enemy gets a second action every 4th round). This is a first pass; it has not been tuned.
