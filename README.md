# GhostSprint

A multiplayer parkour race game built on the HYTOPIA SDK. Race through checkpoints, set personal bests, compete on the leaderboard, and customize with cosmetics.

## How to Run

```bash
# Install dependencies
npm install

# Update SDK and assets
npm update hytopia @hytopia.com/assets

# Start the server
npx hytopia start
```

Then connect via the HYTOPIA client.

## Game Overview

- **Round-based**: Lobby → Countdown → Freeze → Race → Results → Lobby
- **8 ordered checkpoints**: Must hit them in sequence 1→8
- **Timer**: Personal race timer starts at the start pad
- **Respawn**: Fall out-of-bounds → respawn at last checkpoint
- **1 modifier per round**: Low Gravity, Ice Floor, Speed Boost, Double Jump, Blink Pads, or Dark Mode
- **Ghost replay**: Your personal best run replays as a translucent ghost
- **Leaderboard**: Global top 10 best times
- **XP & Leveling**: Earn XP for finishing, placing top 3, and setting PBs
- **Cosmetic shop**: Buy trails and finish effects with earned coins

## Commands

- `/stats` — View your stats
- `/lb` — View the leaderboard

## Project Structure

```
/src
  /config
    gameConfig.ts      ← All tunable values (timers, positions, XP, etc.)
    courseConfig.ts     ← Re-exports course layout values
  /systems
    StateMachine.ts    ← Round state machine (LOBBY_IDLE → ROUND_RESULTS)
    CheckpointSystem.ts← Ordered checkpoint tracking, start/finish triggers
    TimerSystem.ts     ← Per-player race timer
    ModifierSystem.ts  ← Random round modifiers
    GhostSystem.ts     ← Personal best ghost recording/replay
    PersistenceSystem.ts← Per-player data save/load
    LeaderboardSystem.ts← Global best times leaderboard
    XPSystem.ts        ← XP awards and leveling
  /data
    cosmeticsData.ts   ← Data-driven cosmetic definitions
  main.ts              ← Game orchestrator (wires all systems)
/assets
  /ui
    index.html         ← Complete game UI (HUD, lobby, results, shop)
  /textures            ← Texture assets
  map.json             ← World map (build at https://build.hytopia.com)
index.ts               ← Entry point
```

## Where to Edit Course Positions

All course positions are defined in `src/config/gameConfig.ts`:

```typescript
export const START_PAD_POSITION: Vector3Like = { x: 0, y: 5, z: -20 };
export const FINISH_GATE_POSITION: Vector3Like = { x: 0, y: 5, z: -200 };
export const CHECKPOINT_POSITIONS: Vector3Like[] = [
  { x: 10, y: 8, z: -40 },
  // ... 8 checkpoints total
];
export const OUT_OF_BOUNDS_Y = -10;
```

Edit these positions to match your map layout. You'll want to build a matching map at [build.hytopia.com](https://build.hytopia.com) and export as `assets/map.json`.

## How to Add a Modifier

1. Add the modifier definition to `MODIFIERS` in `src/config/gameConfig.ts`:
   ```typescript
   { id: 'my_modifier', label: 'My Modifier', weight: 1 },
   ```

2. Add the apply/reset logic in `src/systems/ModifierSystem.ts`:
   - In `apply()`: Add a case for your modifier ID
   - In `reset()`: Undo any world changes your modifier made

3. For per-tick modifiers, add a method like `tryMyModifier()` and call it from the tick loop in `src/main.ts`.

## How to Change XP Values

Edit `XP_VALUES` in `src/config/gameConfig.ts`:

```typescript
export const XP_VALUES = {
  finish: 30,   // Completing a race
  top1: 20,     // 1st place bonus
  top2: 10,     // 2nd place bonus
  top3: 5,      // 3rd place bonus
  newPB: 25,    // Setting a new personal best
  dnf: 10,      // Did not finish
};
export const XP_PER_LEVEL = 100;     // XP needed per level
export const COINS_PER_LEVEL_UP = 25; // Coins awarded on level up
```

## How to Add Cosmetics

Add entries to `COSMETICS` array in `src/data/cosmeticsData.ts`:

```typescript
{
  id: 'trail_my_trail',
  name: 'My Trail',
  type: 'trail',
  price: 50,
  color: { r: 255, g: 0, b: 128 },
  description: 'A cool custom trail.',
}
```

No switch statements needed — cosmetics are fully data-driven.

## SDK Limitations Encountered

- **No per-player entity visibility**: Ghost entities are visible to all players, not just the owner. A proper implementation would need per-player worlds or SDK-level visibility control.
- **No block-level friction control**: The "Ice Floor" modifier simulates low friction by adjusting player velocity rather than actual physics material properties.
- **UI is HTML-based**: All game UI must be implemented in a single HTML file with inline JS/CSS. No framework support. Communication is via `sendData`/`onData` message passing.
- **Persistence is shallow merge**: `player.setPersistedData()` does a shallow merge, requiring careful key namespacing to avoid data collision.
- **No built-in leaderboard**: Global leaderboard must be manually managed via `PersistenceManager.getGlobalData/setGlobalData`.

## Next 3 Improvements

1. **Per-player ghost visibility** — Use separate worlds or SDK visibility features (when available) to ensure ghost entities are only visible to their owning player.
2. **Proper course platforms** — Build a full 3D parkour course map with platforms, walls, jumps, and visual theming using the HYTOPIA map builder instead of the default flat world.
3. **Multiple courses** — Add support for additional courses with their own checkpoint layouts, leaderboards, and ghost data, selectable from the lobby.
