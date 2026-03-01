# Ghost-Sprint Enhancement Ideas

Research findings from the Hytopia SDK, open-source projects, asset library, and type definitions. Use this document as a reference when planning new features.

---

## Tier 1 — Quick Wins (1-2 hours each)

### Sound Effects
Add SFX at key gameplay moments using the Hytopia `Audio` API. Over 100 sound effects are available in the built-in asset library.

| Event | Suggested SFX |
|---|---|
| Checkpoint reached | `audio/sfx/ui/ui-click-confirm.mp3` or similar UI confirm sound |
| Finish line crossed | `audio/sfx/ui/success-fanfare.mp3` or victory jingle |
| Respawn / Out-of-bounds | `audio/sfx/damage/fall-damage.mp3` |
| Countdown tick (3-2-1) | `audio/sfx/ui/ui-click.mp3` |
| Modifier activated | `audio/sfx/entity/power-up.mp3` |
| Lobby music | Already implemented (music rotation) |

**SDK API**: `new Audio({ uri, loop, volume, attachedToEntity })` — can attach to player entities or play globally.

---

### Particle Effects
Add visual flair with particle emitters. 3 particle textures are available in the asset library.

| Effect | Where |
|---|---|
| Runner trail | Emit particles behind the player while sprinting |
| Checkpoint burst | Burst of particles when hitting a checkpoint |
| Finish celebration | Large particle explosion at finish line |
| Modifier ambient | Floating particles during active modifiers (e.g., ice sparkles for ice_floor) |
| Respawn poof | Smoke/cloud on respawn |

**SDK API**: `new ParticleEmitter({ attachedToEntity, position, particleCount, particleLifetime, velocity, acceleration, startSize, endSize, startColor, endColor, startOpacity, endOpacity })` with particle texture URIs like `textures/particles/star.png`.

**Available Particle Textures**:
- `textures/particles/star.png`
- `textures/particles/circle.png`
- `textures/particles/smoke.png`

---

### Chat Commands
Register useful player commands using `ChatManager`.

| Command | Description |
|---|---|
| `/stats` | Show your XP, level, coins, best times |
| `/lb` or `/leaderboard` | Show top 10 leaderboard |
| `/course` | Show current course info and modifier |
| `/help` | List available commands |

**SDK API**: `world.chatManager.registerCommand('/stats', (player) => { ... })` — sends response via `world.chatManager.sendPlayerMessage(player, message)`.

---

### Entity Outlines / Glow
Add colored outlines to entities for visual clarity.

| Use Case | Color |
|---|---|
| Active checkpoint (next target) | Green outline |
| Completed checkpoints | Gray/dim outline |
| Finish gate | Gold outline |
| Player with active modifier | Modifier-themed color |

**SDK API**: `entity.setOutlineColor({ r, g, b })` to enable, `entity.setOutlineColor(undefined)` to disable. Also available: `entity.setTintColor()`, `entity.setEmissiveColor()`.

---

## Tier 2 — Medium Effort (half day each)

### SceneUI — Floating 3D Labels
Attach HTML/CSS UI elements to world positions or entities.

| Element | Description |
|---|---|
| Checkpoint numbers | Floating "1", "2", "3" above each checkpoint |
| Countdown display | Large 3D countdown above the start pad |
| Player nameplates | Custom nameplates with level/rank badges |
| Course name banner | Floating course name at the start area |

**SDK API**: `new SceneUI({ templateId, attachedToEntity, position, offset, state })` — uses HTML templates registered via `PlayerUI`.

---

### Spectator Mode
Let eliminated/DNF players spectate the race leader.

- When a player finishes or DNFs, attach their camera to the current leader
- Cycle through players with a key press
- Show spectated player's name and checkpoint progress

**SDK API**: `player.camera.setAttachedToEntity(targetEntity)`, `player.camera.setMode('third_person')`, `player.camera.setModelHiddenNodes([])`.

---

### Moving Platforms
Add dynamic obstacles using `SimpleEntityController` with waypoints.

| Platform Type | Behavior |
|---|---|
| Horizontal slider | Moves left-right on a timer |
| Vertical elevator | Moves up-down between two heights |
| Rotating arm | Spins around a center point |
| Disappearing platform | Toggles visibility on interval |

**SDK API**: `new SimpleEntityController()` with `entity.setPosition()` updates in tick handler. Players stick to platforms via `DefaultPlayerEntityController.sticksToPlatforms`.

---

### 3D Course Markers
Replace invisible trigger volumes with visible model assets.

| Marker | Available Asset |
|---|---|
| Checkpoint pillars | `models/gameplay/checkpoint-block.gltf` |
| Direction arrows | `models/gameplay/arrow.gltf` |
| Start/Finish portals | `models/portals/portal-round.gltf`, `models/portals/portal-square.gltf` |
| Course decorations | `models/dungeon/*`, `models/halloween/*`, `models/nature/*` |

**Available Model Categories** (500+ total):
- `models/gameplay/` — Arrows, checkpoints, coins, keys, chests, flags
- `models/portals/` — Round and square portal frames
- `models/animals/` — Bats, cats, chickens, deer, fish, frogs, etc.
- `models/dungeon/` — Barrels, braziers, cages, skulls, pillars
- `models/halloween/` — Pumpkins, gravestones, cauldrons, coffins
- `models/nature/` — Trees, mushrooms, rocks, flowers, bushes
- `models/npcs/` — Knights, wizards, zombies, skeletons, goblins

---

### Per-Course Skybox
Set a unique skybox for each course to give them distinct atmospheres.

| Course | Suggested Theme |
|---|---|
| Neon Gauntlet | Cyberpunk night sky |
| Shadow Run | Dark stormy clouds |
| Sky Circuit | Bright blue sky with clouds |
| Twisted Spire | Sunset/twilight |

**SDK API**: `world.loadSkybox({ north, south, east, west, top, bottom })` — accepts 6 face image URIs.

---

### Per-Course Music
Play different music tracks per course (partially implemented with music rotation).

**Available Music Tracks** (10 total):
- `audio/music/credits.mp3`
- `audio/music/menu.mp3`
- `audio/music/overworld-epic.mp3`
- `audio/music/overworld-mellow.mp3`
- `audio/music/overworld-night.mp3`
- `audio/music/overworld-spooky.mp3`
- `audio/music/underworld-dungeon.mp3`
- `audio/music/underworld-final-boss.mp3`
- `audio/music/underworld-mini-boss.mp3`
- `audio/music/underworld-spooky.mp3`

---

## Tier 3 — Bigger Features (1+ day each)

### New Modifiers
Expand the 6 existing modifiers with new mechanics.

| Modifier | Effect |
|---|---|
| `no_jump` | Disables jumping entirely (`canJump = false`) |
| `high_jump` | 2x jump velocity |
| `swimming` | Sections with swim physics (`swimGravity`, `swimSpeed`) |
| `reverse_gravity` | Flip gravity via `simulation.setGravity()` |
| `tiny_player` | Shrink player scale |
| `giant_player` | Enlarge player scale |
| `slippery` | Reduce friction / increase slide |
| `bouncy` | Players bounce on landing |

**SDK API**: `DefaultPlayerEntityController` exposes `walkVelocity`, `runVelocity`, `jumpVelocity`, `canJump`, `canRun`, `isGrounded`, `isOnPlatform`, `swimGravity`, `swimSpeed`, `swimBuoyancy`.

---

### Hazard Entities
Physical obstacles that knock players off course.

| Hazard | Behavior |
|---|---|
| Spinning saw blade | Rotates at fixed point, knocks players back |
| Spike trap | Pops up on interval, damages/respawns player |
| Swinging pendulum | Swings back and forth across path |
| Falling rocks | Drop from above at random intervals |
| Lava floor sections | Respawns player on contact |

**SDK API**: Use `Entity` with `RigidBodyType.KINEMATIC_POSITION`, collision events via `entity.onEntityCollision`, apply impulse via `entity.applyImpulse()`.

---

### Coin Collection
Scatter collectible coins along courses for bonus currency.

- Place coin entities along course paths (off the main line for risk/reward)
- Coins despawn on collection, respawn each round
- Award bonus coins to player's persistent balance
- Coins rotate/bob using tick handler position updates

**Available Asset**: `models/gameplay/coin-gold.gltf`

---

### Dynamic Course Elements
Modify the block world at runtime for dynamic gameplay.

| Element | Behavior |
|---|---|
| Disappearing platforms | Blocks fade out after player steps on them |
| Rising lava | Block layer rises from below over time |
| Crumbling bridges | Blocks break away after being touched |
| Opening doors | Blocks removed to reveal new paths |

**SDK API**: `world.chunkLattice.setBlock(x, y, z, blockTypeId)` — set to 0 to remove, or a valid ID to place. Can be called at runtime for live block manipulation.

---

### Camera FOV Speed Effects
Dynamically adjust camera field of view based on player speed.

- Normal running: default FOV
- Speed boost modifier: wider FOV for sense of speed
- Blink teleport: brief extreme FOV shift
- Finish line: zoom effect

**SDK API**: `player.camera.setFov(degrees)` — default is ~75, widen to 90-100 for speed feel.

---

## SDK API Quick Reference

| API | Purpose |
|---|---|
| `new Audio({ uri, loop, volume, attachedToEntity })` | Play sound effects and music |
| `new ParticleEmitter({ ... })` | Spawn particle effects |
| `new SceneUI({ templateId, attachedToEntity, state })` | Floating 3D UI elements |
| `PlayerUI.load(templateId, html)` | Register HTML UI templates |
| `player.camera.setAttachedToEntity(entity)` | Spectator camera |
| `player.camera.setFov(degrees)` | FOV effects |
| `player.camera.setMode(mode)` | Camera mode (first/third person) |
| `entity.setOutlineColor({ r, g, b })` | Entity outline glow |
| `entity.setTintColor({ r, g, b })` | Entity color tint |
| `entity.setEmissiveColor({ r, g, b })` | Entity emissive glow |
| `world.chatManager.registerCommand(cmd, handler)` | Chat commands |
| `world.chatManager.sendPlayerMessage(player, msg)` | Send chat message |
| `world.chunkLattice.setBlock(x, y, z, id)` | Runtime block editing |
| `world.simulation.setGravity(vec3)` | Change gravity |
| `DefaultPlayerEntityController` | Player movement config |
| `SimpleEntityController` | Moving platform controller |

---

## Asset Library Summary

| Category | Count | Path Pattern |
|---|---|---|
| 3D Models | 500+ | `models/{category}/{name}.gltf` |
| Sound Effects | 100+ | `audio/sfx/{category}/{name}.mp3` |
| Music Tracks | 10 | `audio/music/{name}.mp3` |
| Particle Textures | 3 | `textures/particles/{name}.png` |
| Block Textures | 150+ | `textures/blocks/{name}.png` |
