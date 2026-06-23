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
See the root README for guidelines.

**3D Upgrade:**
- Engine: Three.js (via CDN, no build).
- Prefabricated models: Recommended sources for GLTF/GLB (low-poly, CC0):
  - Kenney.nl (https://kenney.nl/assets/category:3D) — Blocky Characters, Fantasy Town, Nature kits. Download GLB and load with GLTFLoader.
  - Quaternius (https://quaternius.com/) — Hundreds of low-poly CC0 models.
- Current implementation uses **procedural generation** for ground (heightmap noise), trees (cylinders + cones), buildings (boxes + roofs), and character "prefabs" (grouped primitives for Alpha/Beta/etc.).
- To use real prefabs: Add GLTFLoader (via script or module), load models into scene for units/enemies/props.

MIT licensed (see root LICENSE).