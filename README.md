# EMBERFALL

[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/sugarrush1932/emberfall/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/sugarrush1932/emberfall/reward.svg)](https://make.fun/bounty/best-game-01)

Emberfall is an original arcade game about a lone ember orbiting a dying star. Slingshot and thrust around the star's gravity well, gather 24 light shards before the star collapses, chain pickups into combos and fever, and dodge the dark debris spiralling in with you. Every run is a race between the light you feed the star and the collapse closing in.

## How to play

- WASD or arrow keys: thrust
- Drag the mouse and release: slingshot launch
- SPACE or Shift: dash
- P or Esc: pause
- Enter or click: start / confirm
- Gather 24 shards to win. Debris hits damage your hull, and touching the star singes you. Eight shard pickups in a row (within the combo window) lights FEVER.

## Run it locally

```
node serve.ts
```

Then open http://localhost:8080 in a browser. No build step and no dependencies: the game is plain ES modules.

## Hand in

```
MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `game/`, `screenshots/` and `dossier.json` into the output directory.

## License

MIT
