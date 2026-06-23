# Delta Tactics

**Day 003** - 1 Game Per Day project by Eric Canales.

Turn-based tactics game. Control four characters (Alpha, Beta, Gamma, Delta) in sequence.

## Basics
- 25x25 grid (250x250 units) with 8-directional (octagonal) movement.
- Each unit can MOVE up to 10 spaces per turn (avoid buildings, trees, cliffs).
- Or SHOOT at enemies within range (simple line-of-sight).
- Obstacles block movement and shots.
- Goal: move any unit onto the guarded building (highlighted).
- Enemies are static for now (no AI).

## Controls
Click the MOVE or SHOOT buttons on the right, then click a valid target on the map.
Units act in fixed order. After all four, enemies "phase" (nothing yet) and it repeats.

## Project
See the root README for guidelines. Pure Canvas implementation for quick basics.

MIT licensed (see root LICENSE).