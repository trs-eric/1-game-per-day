# 1 Game Per Day

A clean GitHub Pages skeleton for building and publishing one small web game per day.

**By Eric Canales** - [eric@canales.me](mailto:eric@canales.me)

**Live site:** https://trs-eric.github.io/1-game-per-day/

> **Note:** All games are AI-generated and worked on for only a few hours until they seem to plateau in playability.

> **Configured for:** GitHub user `trs-eric`. Name and email already set in the LICENSE file.

## What This Is

This repo contains the skeleton for Eric's "1 Game Per Day" project along with completed games.

Games live in `games/`. The root `index.html` is the public gallery.

Currently includes: **Grand Turbo Racing** (day-001).

## Goals

- Daily bite-sized games in the browser
- Pure client-side (no build step)
- Support for Canvas, WebGL, and WebAssembly
- Easy to host on GitHub Pages
- Simple to add a new game every day
- Games can have multiple screens and more complex layouts (no strict one-screen rule)

## Development Guidelines

- No size limits - focus on making the best possible games.
- When programming game logic, extract pure functions where practical and include unit tests (simple assertions, Node, or browser tests) to verify correctness.

## Quick Start (local)

```bash
# Serve the site locally
python3 -m http.server 8000
# or
npx serve .
```

Open http://localhost:8000

## How to Add a Game

1. Copy the template:
   ```bash
   cp -r template games/day-002-your-game-name
   ```

2. Customize the new folder:
   - Edit `index.html` (title, layout)
   - Write your game in `game.js`
   - Optional: add a `style.css`

3. Register the game in the gallery:
   - Open the root `index.html`
   - Add an entry to the `games` array in the JavaScript section

4. (Recommended) Add a thumbnail:
   - Take a screenshot
   - Save it to `assets/thumbnails/day-002-xxx.png`
   - Reference it in the game entry

5. For any pure logic (e.g., physics, scoring, AI), add unit tests (simple assertions or a dedicated test file) where practical.

6. Commit and push.

## Template

The `template/` folder gives you:
- Clean responsive canvas
- `requestAnimationFrame` game loop
- Basic keyboard + mouse + touch input
- Simple UI controls

## Tech Guidelines

| Tech     | How to use it                     | Tip |
|----------|-----------------------------------|-----|
| Canvas   | 2D context                        | Great for most 2D games |
| WebGL    | WebGL2                            | Good for particles & effects |
| WASM     | Rust (wasm-pack) or C (emcc)      | Drop .wasm + loader in the game folder |

## Publishing to GitHub (GitHub Pages)

1. Create a new repository on GitHub called `1-game-per-day` (or any name you like).

2. Push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Initial skeleton for 1 Game Per Day"
   git remote add origin https://github.com/trs-eric/1-game-per-day.git
   git branch -M main
   git push -u origin main
   ```

3. Go to the repo on GitHub → **Settings → Pages**

4. Under "Build and deployment":
   - Source: **Deploy from a branch**
   - Branch: `main`
   - Folder: `/ (root)`
   - Click **Save**

5. Your site will be available at:
   `https://trs-eric.github.io/1-game-per-day/`

After the first push it may take a minute or two to appear.

## Adding More Games Later

Just repeat the "How to Add a Game" steps. Each new folder under `games/` + an entry in the array on the main page = new card in the gallery.

## License

MIT License - see [LICENSE](LICENSE) for details.

Copyright © 2026 Eric Canales

---

Made with ❤️ and way too much `requestAnimationFrame`.
