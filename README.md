# 🥍 LaxFoo Racing

**Boomerang Foo × lacrosse × Mario Kart.** A free-for-all arena brawler where four drivers
in 4WD SUVs tear through the biggest house match ever thrown, plunking each other with
lacrosse balls to climb the ladder of **50 sticks**.

## How to play

Open `index.html` in any modern browser. Fully client-side — three.js is vendored, so it
works offline and from `file://`.

```sh
# or serve it locally:
python3 -m http.server 8000   # then visit http://localhost:8000
```

Real-time 3D: chase camera, PBR materials with environment reflections, soft sun shadows,
procedurally modeled vehicles and players, rotating 3D previews in the select screens.
On weak hardware, add `?fast` to the URL for a low-fx mode.

## The rules

- Every driver starts at **Stick 1** of 50. Hit somebody with a lacrosse ball and you're
  handed the next, better stick — faster throws, longer range, bigger balls, more balls in
  the pocket, and eventually multishot.
- Get plunked and you drop a stick level (and cough up a ball).
- Balls fly **boomerang-style**: they curve back to your crosse for the catch. Miss it and
  it's a **ground ball** — drive over loose balls to reload. Ground balls win games.
- First to run the rack to **Stick 50** wins instantly. Otherwise, best stick at full
  time (3:00) takes it.

## The arena

Somebody's house. Living room, kitchen, garage, bedroom, bath — plus a backyard with a
pool (swampy), a trampoline (bouncy), and boost pads through the hallways for full
send-it Mario Kart energy.

## The garage

Every rig is a 4WD SUV, rarity-tiered from Common to Legendary:

| Rarity | Rigs |
|---|---|
| Common | '96 Ford Bronco XLT · Jeep Wrangler TJ · Toyota 4Runner TRD Pro · Land Rover Discovery II |
| Uncommon | Jeep Cherokee XJ · '21 Bronco Badlands · '97 4Runner Limited |
| Rare | Land Rover Defender 90 · Willys CJ-5 |
| Epic | '66 Bronco Half-Cab · Range Rover Classic |
| **Legendary** | **'85 Toyota 4Runner SR5 Soft Top** — tan, open-top, and the only one in existence. Starts the match at Stick 3. |

Rarer rigs run hotter stats. CPUs can never take the '85 — if you don't drive it, nobody does.

## The crosse-players

Eight players, each with a perk: rifle-arm throw speed, ground-ball vacuum, stun
resistance, top-speed motor, throw range, heavy hits, quick-stick reload, or late-apex
handling.

## Controls

| Input | Action |
|---|---|
| `WASD` / arrows | Drive |
| `Space` / `X` | Throw (with gentle aim assist) |
| Mouse click | Aimed throw at the cursor |
| `Shift` | Drift |
| `P` / `Esc` | Pause |
