# AGENTS.md

Vanilla JS Pac-Man (no build tool, no deps, no package.json, no tests).

## Run

Open `src/index.html` directly in a browser, or serve the `src/` dir:

```
python3 -m http.server -d src 8000   # then http://localhost:8000
```

## Architecture

- Script order in `index.html` matters: `maze.js -> game.js -> render.js -> main.js`. Scripts share state via `window` globals (no ES modules). Don't reorder, don't convert to modules without updating all files.
- Globals contract: `maze.js` exposes `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`; `game.js` exposes `createGame`, `update`, `DIRS`.
- `MAZE` (from `maze.js`) is pristine; `createGame()` copies it into `game.grid` per life. `render.js` reads `game.grid` so eaten dots disappear. Never mutate `MAZE`.
- Grid is 28x31, parsed from `MAZE_STR`. Tile legend: `#`=1 wall, `.`=2 dot, ` `=0 empty, `-`=3 pen door (blocks all actors).
- Tunnel is row 14 (`TUNNEL_ROW`); edges wrap via `wrapTunnel()` in `game.js`.
- Canvas is 560x620 = 28x31 tiles at `TILE = 20` (`render.js`). Changing maze dimensions or TILE breaks the canvas/overlay layout.

## Movement mechanics (easy to break)

- Speeds are fractional cells/frame: Pac-Man 0.125, ghosts 0.1 (`game.js`). Turning/dot-eating/ghost decisions only happen when position is `aligned()` (integer cell). Keep any speed change as a clean fraction or turning breaks silently.
- Pac-Man turns at most once per cell alignment (`nextDir`), stops at dead ends. Ghosts never reverse except in a dead end; `hunter` kind chases, `random` wanders.

## Conventions

- Code comments and UI strings are in Spanish — keep new text in Spanish.
