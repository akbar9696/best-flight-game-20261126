[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/akbar9696/best-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/akbar9696/best-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

# Meridian Sky Courier

An original flight game for make.fun's **best-flight-game-20261126-0057** bounty.
Fly the M-27 courier down Meridian Valley, thread the sky rings, watch your fuel,
and land on Strip 27.

## Play

Open `game/index.html` in desktop Chrome (or `node serve.ts`, then
http://localhost:8080). No network request, no build step, no libraries.

- **Steer:** arrow keys / WASD, or move the mouse
- **Throttle:** Shift / Ctrl, or the mouse wheel
- **Gear:** G · **Pause:** P · **Restart:** R · **Sound:** M
- **Missions:** press 1, 2 or 3 on the title screen, or click a card

Three missions: **Ring Run** (8 rings, calm air), **Ridge Courier**
(12 rings, gusting crosswind, tight fuel), **Night Mail** (10 rings at dusk,
lit runway). Rings score 100 (50 extra dead centre); a landing scores 400,
plus 200 for beating par. Running out of fuel means gliding to the strip.
Terrain, ridges and the river end a sortie if you hit them.

## Layout

- `game/index.html` — the page
- `game/src/config.js` — tuning, missions, runway, palette
- `game/src/world.js` — flight model, terrain, rings, landings, score
- `game/src/render.js` — chase-view scene: sky, ridges, fields, river, runway, rings, aircraft
- `game/src/instruments.js` — HUD (ALT / SPD / HDG), lit instrument panel, screens
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — synthesised engine, wind and chimes (WebAudio, no files)
- `game/src/shots.js` — staged screenshot scenes (`?shot=cover|valley|landing|title`)
- `game/src/main.js` — boot and the fixed-step loop
- `game/src/random.js` — deterministic generator for the valley

Screenshots are real renders of the game's own code, staged with
`?shot=…&seed=N` and captured in headless Chromium at 1280×720.

## Hand-in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with `vendor/makefun-game.ts`.

## License

MIT — see `LICENSE`.
