# Cinder Cell co-op: how it works and how to set it up

Two players, one cell. The **host** runs the game; the **friend** joins with a four-letter room code. You each have your own operative, gear, credits and Wanted level; Resolve, training and cell upgrades are shared. In town you each walk around on your own screen. The host picks the mission; the friend presses Ready at their freight terminal. In a fight you take turns (one move each), then the enemy acts and picks one of you. If either of you goes down, the raid ends for both: the survivor escapes with half the haul.

The friend's operative lives in the host's save while you play together. The friend's own solo save is untouched; leaving co-op returns them to it.

## Trying it on one computer (no server)

Leave the Relay URL empty in Settings > Co-op. Host in one tab, open the game in a second tab of the same browser and Join with the code. The tabs talk through the browser itself.

## Playing on two devices

You need two things on Cloudflare (free tier is enough): the relay server, and somewhere to host the game page that your friend can open. Both are done from the project folder on your computer with Node installed.

1. Install the tool once: `npm install -g wrangler`, then `wrangler login` (opens a browser; sign in to your Cloudflare account).
2. Deploy the relay: `cd coop` then `wrangler deploy`. It prints a URL like `https://cinder-cell-coop.<your-subdomain>.workers.dev`. That URL goes into Settings > Co-op > Relay URL on both devices (it's remembered).
3. Host the game page: from the project folder, `wrangler pages deploy . --project-name cinder-cell`. It prints a URL like `https://cinder-cell.pages.dev`. Your friend opens that. (The claude.ai artifact link is private, so it won't work for them.)
4. One of you presses Host, reads out the code, the other presses Join.

Re-run step 2 or 3 whenever the game or the relay changes. Nothing is stored on the server: the relay only forwards messages between the two connections for a room code and forgets the room when both leave.

## What's in the code

- `coop/worker.js`, `coop/wrangler.toml`: the relay (a Cloudflare Worker with one Durable Object per room code).
- `net.js`: the client side. `WsTransport` for the relay, `LocalTransport` (BroadcastChannel) for two tabs.
- `engine.js`: `isCoop`, `withActor`, `setActor`, `forEachActor`, `livingActors`, `charAt`. The friend is `s.char2`; the engine always acts on `s.char`, so acting as the friend swaps the two (and the per-operative combat fields in `s.run`) for the duration of the call. Saves are always written unswapped.
- `index.html`: the host runs every action and broadcasts the whole state after each render; the friend mirrors it with the operatives swapped so their screen is "theirs". Game actions on the friend's screen are sent to the host; screen-only actions (menus, tabs) stay local.
- `sim-coop.mjs`: two bots raiding together. `SOLO=1` runs the same simple bot alone for comparison. Co-op knobs: `TUNE.coopHp` (1.5), `coopAtk` (1.0), `coopExtra` (the enemy gets a second action every 4th round). This is a first pass; it has not been tuned.
