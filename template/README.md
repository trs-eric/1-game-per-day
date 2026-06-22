# Game Template

This is the recommended starting point for a new "1 Game Per Day" entry.

## Files

- `index.html` - Self-contained game page with header and canvas
- `game.js` - All game logic here

## Steps to create a new game

1. Copy this folder:
   ```bash
   cp -r template ../games/day-002-my-awesome-game
   ```
2. Edit `index.html`:
   - Change title and day number
   - Adjust canvas size if needed
3. Rewrite `game.js` with your game.
4. Add your game to the main `index.html` gallery list.
5. Add a screenshot to `assets/thumbnails/` (optional but recommended).

Keep games fun and polished. There are no size limits.

## Development Notes

- Extract pure logic (e.g. game rules, scoring) into functions and add unit tests where possible to verify behavior.
- Follow the main project guidelines in the root README.
- Games are not restricted to a single screen.

## Tips

- Use requestAnimationFrame + delta time
- Make the first interaction obvious
- Add a short instruction line
- Target high quality code over arbitrary line limits

Have fun!