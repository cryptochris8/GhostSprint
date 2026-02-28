/**
 * GhostSprint
 * Main game orchestrator. Wires all systems together.
 */

import {
  startServer,
  Audio,
  DefaultPlayerEntity,
  DefaultPlayerEntityController,
  PlayerEvent,
  PlayerUIEvent,
  WorldLoopEvent,
  Entity,
  RigidBodyType,
  ColliderShape,
  ParticleEmitter,
} from 'hytopia';
import type { World, Player } from 'hytopia';

import worldMap from '../assets/map.json';

// Config
import {
  DEBUG_MODE,
  ROUND_DURATION_SEC,
} from './config/gameConfig';
import { COURSES } from './config/courseConfig';
import type { CourseDefinition } from './config/courseConfig';

// Systems
import { StateMachine, GameState } from './systems/StateMachine';
import { CheckpointSystem } from './systems/CheckpointSystem';
import { TimerSystem } from './systems/TimerSystem';
import { ModifierSystem } from './systems/ModifierSystem';
import { GhostSystem } from './systems/GhostSystem';
import { PersistenceSystem } from './systems/PersistenceSystem';
import { LeaderboardSystem } from './systems/LeaderboardSystem';
import { XPSystem } from './systems/XPSystem';
import { CourseManager } from './systems/CourseManager';
import type { RoundResult } from './systems/XPSystem';

// Data
import { COSMETICS, getCosmeticById } from './data/cosmeticsData';

// ── Player tracking ──────────────────────────────────────────
interface ActivePlayer {
  player: Player;
  entity: DefaultPlayerEntity;
  finishTimeMs: number | null;
  isNewPB: boolean;
}

const activePlayers: Map<string, ActivePlayer> = new Map();

// ── Trail particle emitters per player ───────────────────────
const trailEmitters: Map<string, ParticleEmitter> = new Map();

// ── Course marker entities (for despawn/respawn between rounds) ──
let courseMarkerEntities: Entity[] = [];

startServer(world => {
  // ── Load map & world settings ────────────────────────────
  world.loadMap(worldMap);
  world.setSkyboxUri('skyboxes/ghostsprint');
  world.setAmbientLightIntensity(1.0);
  world.setDirectionalLightIntensity(1.0);

  // ── Music ──────────────────────────────────────────────
  const lobbyMusic = new Audio({ uri: 'audio/lobby-music.mp3', loop: true, volume: 0.5 });
  const gameMusic = new Audio({ uri: 'audio/game-music.mp3', loop: true, volume: 0.5 });

  // ── Initialize systems ───────────────────────────────────
  const stateMachine = new StateMachine(world);
  const checkpointSystem = new CheckpointSystem();
  const timerSystem = new TimerSystem();
  const modifierSystem = new ModifierSystem();
  const ghostSystem = new GhostSystem();
  const persistenceSystem = new PersistenceSystem();
  const leaderboardSystem = new LeaderboardSystem();
  const xpSystem = new XPSystem(persistenceSystem);
  const courseManager = new CourseManager();

  // Initialize systems with the first course
  const initialCourse = courseManager.activeCourse;
  checkpointSystem.setCourse(initialCourse);
  persistenceSystem.setCourseId(initialCourse.id);
  leaderboardSystem.setCourseId(initialCourse.id);

  // Load global leaderboard
  leaderboardSystem.load();

  // Start lobby music on server boot
  lobbyMusic.play(world);

  // Helper: get player entity pairs for modifier system
  function getPlayerEntities() {
    return Array.from(activePlayers.values()).map(ap => ({
      entity: ap.entity,
      player: ap.player,
    }));
  }

  // ── Spawn initial course markers (visual) ─────────────────
  spawnCourseMarkers(world, courseManager.activeCourse);

  // ── State machine transitions ────────────────────────────
  stateMachine.onStateChange((prev, next) => {
    if (DEBUG_MODE) console.log(`[Main] State: ${prev} → ${next}`);

    switch (next) {
      case GameState.LOBBY_IDLE:
        handleLobbyIdle(world);
        break;
      case GameState.LOBBY_COUNTDOWN:
        broadcastUI({
          type: 'stateChange',
          state: 'LOBBY_COUNTDOWN',
          timer: stateMachine.stateTimer,
          courseName: courseManager.courseName,
        });
        break;
      case GameState.ROUND_STARTING:
        handleRoundStarting(world);
        break;
      case GameState.ROUND_ACTIVE:
        handleRoundActive(world);
        break;
      case GameState.ROUND_RESULTS:
        handleRoundResults(world);
        break;
    }
  });

  // ── Checkpoint callbacks ─────────────────────────────────
  checkpointSystem.onStart((player) => {
    timerSystem.startTimer(player.id);
    ghostSystem.startRecording(player.id);
    sendUI(player, { type: 'timerStarted' });
  });

  checkpointSystem.onCheckpoint((player, index) => {
    sendUI(player, {
      type: 'checkpointHit',
      checkpoint: index + 1,
      total: checkpointSystem.totalCheckpoints,
    });
    world.chatManager.sendPlayerMessage(player, `Checkpoint ${index + 1}/${checkpointSystem.totalCheckpoints}`, '00FF00');
  });

  checkpointSystem.onFinish((player, respawns) => {
    const timeMs = timerSystem.stopTimer(player.id);
    const ghostData = ghostSystem.stopRecording(player.id);

    const ap = activePlayers.get(player.id);
    if (ap) {
      ap.finishTimeMs = timeMs;

      // Check PB
      const isNewPB = persistenceSystem.updateBestTime(player, timeMs, respawns);
      ap.isNewPB = isNewPB;

      if (isNewPB && ghostData) {
        persistenceSystem.saveGhost(player, ghostData);
      }

      // Submit to leaderboard
      leaderboardSystem.submit(player.id, player.username, timeMs);
    }

    sendUI(player, {
      type: 'finished',
      timeMs,
      timeFormatted: TimerSystem.formatTime(timeMs),
      respawns,
      isNewPB: ap?.isNewPB ?? false,
    });

    world.chatManager.sendBroadcastMessage(
      `${player.username} finished in ${TimerSystem.formatTime(timeMs)}!`,
      '00FFAA',
    );

    // Remove trail
    removeTrail(player.id);

    // Check if all players finished → force results
    const allFinished = Array.from(activePlayers.values()).every(p => p.finishTimeMs !== null);
    if (allFinished && activePlayers.size > 0) {
      stateMachine.forceResults();
    }
  });

  checkpointSystem.onRespawn((player) => {
    const ap = activePlayers.get(player.id);
    if (!ap) return;

    // Respawn after 1 second delay
    setTimeout(() => {
      const respawnPos = checkpointSystem.getRespawnPosition(player.id);
      ap.entity.setPosition(respawnPos);
      ap.entity.setLinearVelocity({ x: 0, y: 0, z: 0 });
      sendUI(player, {
        type: 'respawned',
        respawns: checkpointSystem.getPlayerData(player.id)?.respawns ?? 0,
      });
    }, 1000);
  });

  // ── Player join ──────────────────────────────────────────
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    const playerEntity = new DefaultPlayerEntity({
      player,
      name: player.username,
    });

    playerEntity.spawn(world, courseManager.activeCourse.lobbySpawn);
    player.ui.load('ui/index.html');

    // Load persistence for current course
    persistenceSystem.setCourseId(courseManager.courseId);
    const pData = persistenceSystem.load(player);

    activePlayers.set(player.id, {
      player,
      entity: playerEntity,
      finishTimeMs: null,
      isNewPB: false,
    });

    stateMachine.playerJoined(player.id);

    // Send initial UI data
    sendUI(player, {
      type: 'init',
      state: stateMachine.state,
      timer: stateMachine.stateTimer,
      leaderboard: leaderboardSystem.top10,
      courseName: courseManager.courseName,
      totalCheckpoints: checkpointSystem.totalCheckpoints,
      playerData: {
        xp: pData.xp,
        level: pData.level,
        coins: pData.coins,
        bestTimeMs: pData.bestTimeMs,
        bestTimeFormatted: pData.bestTimeMs ? TimerSystem.formatTime(pData.bestTimeMs) : null,
        wins: pData.wins,
        ownedCosmetics: pData.ownedCosmetics,
        equippedTrailId: pData.equippedTrailId,
        equippedFinishEffectId: pData.equippedFinishEffectId,
      },
      cosmetics: COSMETICS,
      modifier: modifierSystem.activeModifierLabel,
    });

    // Listen for UI messages from this player
    player.ui.on(PlayerUIEvent.DATA, ({ data }) => {
      handleUIMessage(player, data as Record<string, unknown>);
    });

    world.chatManager.sendPlayerMessage(player, 'Welcome to GhostSprint!', '00FF00');
    world.chatManager.sendPlayerMessage(player, `Course: ${courseManager.courseName}`, '00CCFF');
    world.chatManager.sendPlayerMessage(player, 'Race through checkpoints to the finish!');
  });

  // ── Player leave ─────────────────────────────────────────
  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    stateMachine.playerLeft(player.id);
    checkpointSystem.removePlayer(player.id);
    timerSystem.removePlayer(player.id);
    ghostSystem.despawnGhost(player.id);
    removeTrail(player.id);
    persistenceSystem.save(player);
    persistenceSystem.removePlayer(player.id);

    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(e => e.despawn());
    activePlayers.delete(player.id);
  });

  // ── Player reconnect ────────────────────────────────────
  world.on(PlayerEvent.RECONNECTED_WORLD, ({ player }) => {
    player.ui.load('ui/index.html');
    const pData = persistenceSystem.get(player.id);
    sendUI(player, {
      type: 'init',
      state: stateMachine.state,
      timer: stateMachine.stateTimer,
      leaderboard: leaderboardSystem.top10,
      courseName: courseManager.courseName,
      totalCheckpoints: checkpointSystem.totalCheckpoints,
      playerData: pData ? {
        xp: pData.xp,
        level: pData.level,
        coins: pData.coins,
        bestTimeMs: pData.bestTimeMs,
        bestTimeFormatted: pData.bestTimeMs ? TimerSystem.formatTime(pData.bestTimeMs) : null,
        wins: pData.wins,
        ownedCosmetics: pData.ownedCosmetics,
        equippedTrailId: pData.equippedTrailId,
        equippedFinishEffectId: pData.equippedFinishEffectId,
      } : null,
      cosmetics: COSMETICS,
      modifier: modifierSystem.activeModifierLabel,
    });
  });

  // ── UI message handler ──────────────────────────────────
  function handleUIMessage(player: Player, data: Record<string, unknown>) {
    const msgType = data.type as string;

    switch (msgType) {
      case 'buyCosmetic': {
        const cosmeticId = data.cosmeticId as string;
        const cosmetic = getCosmeticById(cosmeticId);
        if (!cosmetic) return;

        const success = persistenceSystem.buyCosmetic(player, cosmeticId, cosmetic.price);
        const pData = persistenceSystem.get(player.id);
        sendUI(player, {
          type: 'shopUpdate',
          success,
          coins: pData?.coins ?? 0,
          ownedCosmetics: pData?.ownedCosmetics ?? [],
        });
        break;
      }

      case 'equipCosmetic': {
        const cosmeticId = data.cosmeticId as string;
        const cosmetic = getCosmeticById(cosmeticId);
        if (!cosmetic) return;

        const success = persistenceSystem.equipCosmetic(player, cosmeticId, cosmetic.type);
        const pData = persistenceSystem.get(player.id);
        sendUI(player, {
          type: 'equipUpdate',
          success,
          equippedTrailId: pData?.equippedTrailId ?? null,
          equippedFinishEffectId: pData?.equippedFinishEffectId ?? null,
        });
        break;
      }
    }
  }

  // ── World tick ───────────────────────────────────────────
  let lastTickMs = Date.now();

  world.loop.on(WorldLoopEvent.TICK_START, ({ tickDeltaMs }) => {
    const now = Date.now();
    const deltaSec = tickDeltaMs / 1000;

    // State machine tick
    stateMachine.tick(deltaSec);

    // Ghost replay tick
    ghostSystem.tickGhosts();

    // Per-player tick during active round
    if (stateMachine.state === GameState.ROUND_ACTIVE) {
      for (const [playerId, ap] of activePlayers) {
        if (ap.finishTimeMs !== null) continue; // already finished

        const pos = ap.entity.position;
        if (!pos) continue;
        const rot = ap.entity.rotation;

        // Record ghost
        ghostSystem.recordSample(playerId, pos, rot);

        // Check triggers
        checkpointSystem.checkStartPad(ap.player, pos);
        checkpointSystem.checkCheckpoints(ap.player, pos);
        checkpointSystem.checkFinish(ap.player, pos);

        // Check out-of-bounds
        if (checkpointSystem.checkOutOfBounds(ap.player, pos)) {
          // Respawn handled by callback
        }

        // Modifier tick
        modifierSystem.tryDoubleJump(playerId, ap.entity, ap.player.input);
        modifierSystem.tryBlink(playerId, ap.entity, ap.player.input);
      }
    }

    // Broadcast timer updates every ~500ms
    if (now - lastTickMs > 500) {
      lastTickMs = now;
      broadcastTimerUpdate();
    }
  });

  // ── State handlers ───────────────────────────────────────

  function handleLobbyIdle(world: World) {
    // Switch to lobby music
    gameMusic.pause();
    lobbyMusic.play(world, true);

    // Clean up round state
    modifierSystem.reset(world, getPlayerEntities);
    checkpointSystem.resetAll();
    timerSystem.resetAll();
    ghostSystem.despawnAll();
    ghostSystem.cancelAllRecordings();
    removeAllTrails();

    // Advance to next course
    const nextCourse = courseManager.advanceCourse();
    checkpointSystem.setCourse(nextCourse);
    persistenceSystem.setCourseId(nextCourse.id);
    leaderboardSystem.setCourseId(nextCourse.id);
    leaderboardSystem.load();

    // Despawn old markers, spawn new ones
    despawnCourseMarkers();
    spawnCourseMarkers(world, nextCourse);

    // Reload persistence for all connected players on the new course
    for (const [, ap] of activePlayers) {
      persistenceSystem.load(ap.player);
    }

    // Teleport all players to lobby
    for (const [, ap] of activePlayers) {
      ap.finishTimeMs = null;
      ap.isNewPB = false;
      ap.entity.setPosition(nextCourse.lobbySpawn);
      ap.entity.setLinearVelocity({ x: 0, y: 0, z: 0 });

      // Restore controller defaults
      const ctrl = ap.entity.controller as DefaultPlayerEntityController;
      if (ctrl) {
        ctrl.walkVelocity = 4;
        ctrl.runVelocity = 8;
      }
    }

    broadcastUI({
      type: 'stateChange',
      state: 'LOBBY_IDLE',
      leaderboard: leaderboardSystem.top10,
      courseName: courseManager.courseName,
      nextCourseName: courseManager.nextCourse().name,
      totalCheckpoints: checkpointSystem.totalCheckpoints,
    });
  }

  function handleRoundStarting(world: World) {
    const course = courseManager.activeCourse;

    // Select modifier based on course mode
    let modifier;
    if (course.modifierMode === 'fixed' && course.fixedModifierId) {
      modifier = modifierSystem.selectFixed(course.fixedModifierId);
    } else {
      modifier = modifierSystem.selectRandom();
    }

    // Reset checkpoints for all players
    for (const [playerId, ap] of activePlayers) {
      checkpointSystem.resetPlayer(playerId);
      ap.finishTimeMs = null;
      ap.isNewPB = false;

      // Teleport to start pad
      const startPos = course.startPadPosition;
      ap.entity.setPosition({ x: startPos.x, y: startPos.y + 2, z: startPos.z });
      ap.entity.setLinearVelocity({ x: 0, y: 0, z: 0 });

      // Spawn personal ghost if they have one
      const pData = persistenceSystem.get(playerId);
      if (pData?.ghostData) {
        ghostSystem.spawnGhost(world, playerId, pData.ghostData);
      }
    }

    broadcastUI({
      type: 'stateChange',
      state: 'ROUND_STARTING',
      timer: stateMachine.stateTimer,
      modifier: modifier.label,
      courseName: courseManager.courseName,
      totalCheckpoints: checkpointSystem.totalCheckpoints,
    });

    world.chatManager.sendBroadcastMessage(`Course: ${courseManager.courseName}`, '00CCFF');
    world.chatManager.sendBroadcastMessage(`Round modifier: ${modifier.label}!`, 'FFD700');
  }

  function handleRoundActive(world: World) {
    // Switch to game music
    lobbyMusic.pause();
    gameMusic.play(world, true);

    // Apply modifier
    modifierSystem.apply(world, getPlayerEntities);

    // Spawn trails for players with equipped trails
    for (const [playerId, ap] of activePlayers) {
      spawnTrailForPlayer(world, playerId, ap);
    }

    broadcastUI({
      type: 'stateChange',
      state: 'ROUND_ACTIVE',
      timer: ROUND_DURATION_SEC,
      modifier: modifierSystem.activeModifierLabel,
      courseName: courseManager.courseName,
      totalCheckpoints: checkpointSystem.totalCheckpoints,
    });
  }

  function handleRoundResults(world: World) {
    // Gather results sorted by finish time
    const finishers: Array<{ playerId: string; player: Player; timeMs: number; isNewPB: boolean }> = [];
    const dnfs: Array<{ playerId: string; player: Player }> = [];

    for (const [playerId, ap] of activePlayers) {
      if (ap.finishTimeMs !== null) {
        finishers.push({ playerId, player: ap.player, timeMs: ap.finishTimeMs, isNewPB: ap.isNewPB });
      } else {
        dnfs.push({ playerId, player: ap.player });
        // Stop any running recording
        ghostSystem.stopRecording(playerId);
      }
    }

    finishers.sort((a, b) => a.timeMs - b.timeMs);

    // Build round results for XP
    const roundResults: RoundResult[] = [];

    finishers.forEach((f, i) => {
      const placement = i + 1;
      roundResults.push({
        playerId: f.playerId,
        player: f.player,
        finished: true,
        timeMs: f.timeMs,
        isNewPB: f.isNewPB,
        placement,
      });

      // Record wins/podiums
      if (placement === 1) persistenceSystem.addWin(f.player);
      if (placement <= 3) persistenceSystem.addPodium(f.player);
    });

    for (const d of dnfs) {
      roundResults.push({
        playerId: d.playerId,
        player: d.player,
        finished: false,
        timeMs: null,
        isNewPB: false,
        placement: 0,
      });
    }

    // Award XP
    const xpAwards = xpSystem.awardRound(roundResults);

    // Build podium data
    const podium = finishers.slice(0, 3).map((f, i) => ({
      placement: i + 1,
      username: f.player.username,
      timeMs: f.timeMs,
      timeFormatted: TimerSystem.formatTime(f.timeMs),
    }));

    // Send results to each player
    for (const award of xpAwards) {
      const ap = activePlayers.get(award.playerId);
      if (!ap) continue;

      const pData = persistenceSystem.get(award.playerId);
      const cpData = checkpointSystem.getPlayerData(award.playerId);

      sendUI(ap.player, {
        type: 'roundResults',
        podium,
        xpAwarded: award.amount,
        xpReasons: award.reasons,
        leveled: award.leveled,
        newLevel: award.newLevel,
        coinsAwarded: award.coinsAwarded,
        courseName: courseManager.courseName,
        nextCourseName: courseManager.nextCourse().name,
        playerStats: {
          finished: ap.finishTimeMs !== null,
          timeMs: ap.finishTimeMs,
          timeFormatted: ap.finishTimeMs ? TimerSystem.formatTime(ap.finishTimeMs) : 'DNF',
          respawns: cpData?.respawns ?? 0,
          isNewPB: ap.isNewPB,
          bestTimeMs: pData?.bestTimeMs ?? null,
          bestTimeFormatted: pData?.bestTimeMs ? TimerSystem.formatTime(pData.bestTimeMs) : null,
        },
        nextRoundTimer: stateMachine.stateTimer,
      });
    }

    // Announce podium
    if (podium.length > 0) {
      world.chatManager.sendBroadcastMessage(`--- ${courseManager.courseName} RESULTS ---`, 'FFD700');
      for (const p of podium) {
        const medal = p.placement === 1 ? '1st' : p.placement === 2 ? '2nd' : '3rd';
        world.chatManager.sendBroadcastMessage(
          `${medal}: ${p.username} - ${p.timeFormatted}`,
          p.placement === 1 ? 'FFD700' : p.placement === 2 ? 'C0C0C0' : 'CD7F32',
        );
      }
    }

    // Clean up ghosts and trails
    ghostSystem.despawnAll();
    removeAllTrails();
  }

  // ── Trail management ─────────────────────────────────────

  function spawnTrailForPlayer(world: World, playerId: string, ap: ActivePlayer) {
    const pData = persistenceSystem.get(playerId);
    if (!pData?.equippedTrailId) return;

    const cosmetic = getCosmeticById(pData.equippedTrailId);
    if (!cosmetic?.color) return;

    const emitter = new ParticleEmitter({
      attachedToEntity: ap.entity,
      textureUri: 'particles/smoke.png',
      rate: 15,
      lifetime: 0.8,
      maxParticles: 30,
      sizeStart: 0.3,
      sizeEnd: 0.05,
      opacityStart: 0.8,
      opacityEnd: 0,
      colorStart: cosmetic.color,
      colorEnd: cosmetic.color,
      velocity: { x: 0, y: 0.5, z: 0 },
      velocityVariance: { x: 0.2, y: 0.2, z: 0.2 },
      positionVariance: { x: 0.2, y: 0, z: 0.2 },
    });

    emitter.spawn(world);
    trailEmitters.set(playerId, emitter);
  }

  function removeTrail(playerId: string) {
    const emitter = trailEmitters.get(playerId);
    if (emitter?.isSpawned) emitter.despawn();
    trailEmitters.delete(playerId);
  }

  function removeAllTrails() {
    for (const [id] of trailEmitters) {
      removeTrail(id);
    }
  }

  // ── Finish effect ────────────────────────────────────────

  function spawnFinishEffect(world: World, player: Player, pos: { x: number; y: number; z: number }) {
    const pData = persistenceSystem.get(player.id);
    if (!pData?.equippedFinishEffectId) return;

    const cosmetic = getCosmeticById(pData.equippedFinishEffectId);
    if (!cosmetic) return;

    // Confetti burst
    const emitter = new ParticleEmitter({
      position: pos,
      textureUri: 'particles/smoke.png',
      rate: 0, // burst mode
      maxParticles: 50,
      lifetime: 2,
      sizeStart: 0.3,
      sizeEnd: 0.1,
      opacityStart: 1,
      opacityEnd: 0,
      colorStart: { r: 255, g: 215, b: 0 },
      colorEnd: { r: 255, g: 50, b: 50 },
      colorStartVariance: { r: 100, g: 100, b: 100 },
      velocity: { x: 0, y: 5, z: 0 },
      velocityVariance: { x: 3, y: 3, z: 3 },
      gravity: { x: 0, y: -5, z: 0 },
    });

    emitter.spawn(world);
    // Auto-despawn after 3 seconds
    setTimeout(() => {
      if (emitter.isSpawned) emitter.despawn();
    }, 3000);
  }

  // Hook finish effect into the checkpoint finish callback
  checkpointSystem.onFinish((player, _respawns) => {
    const ap = activePlayers.get(player.id);
    if (ap) {
      spawnFinishEffect(world, player, ap.entity.position);
    }
  });

  // ── UI helpers ───────────────────────────────────────────

  function sendUI(player: Player, data: Record<string, unknown>) {
    player.ui.sendData(data);
  }

  function broadcastUI(data: Record<string, unknown>) {
    for (const [, ap] of activePlayers) {
      sendUI(ap.player, data);
    }
  }

  function broadcastTimerUpdate() {
    const state = stateMachine.state;

    for (const [playerId, ap] of activePlayers) {
      const raceElapsed = timerSystem.getElapsed(playerId);
      const cpData = checkpointSystem.getPlayerData(playerId);

      sendUI(ap.player, {
        type: 'timerUpdate',
        state,
        stateTimer: Math.ceil(stateMachine.stateTimer),
        raceElapsed,
        raceFormatted: TimerSystem.formatTime(raceElapsed),
        checkpoint: cpData?.nextCheckpoint ?? 0,
        totalCheckpoints: checkpointSystem.totalCheckpoints,
        respawns: cpData?.respawns ?? 0,
        modifier: modifierSystem.activeModifierLabel,
        courseName: courseManager.courseName,
      });
    }
  }

  // ── Course visual markers ────────────────────────────────

  function spawnCourseMarkers(world: World, course: CourseDefinition) {
    // Start pad
    const startHalf = {
      x: course.startPadSize.x / 2,
      y: course.startPadSize.y / 2,
      z: course.startPadSize.z / 2,
    };
    const startEntity = new Entity({
      name: 'start_pad',
      blockTextureUri: 'blocks/lime-concrete.png',
      blockHalfExtents: startHalf,
      opacity: 0.4,
      rigidBodyOptions: {
        type: RigidBodyType.FIXED,
        colliders: [{
          shape: ColliderShape.BLOCK,
          halfExtents: startHalf,
          isSensor: true,
        }],
      },
    });
    startEntity.spawn(world, course.startPadPosition);
    courseMarkerEntities.push(startEntity);

    // Finish gate
    const finishHalf = {
      x: course.finishGateSize.x / 2,
      y: course.finishGateSize.y / 2,
      z: course.finishGateSize.z / 2,
    };
    const finishEntity = new Entity({
      name: 'finish_gate',
      blockTextureUri: 'blocks/gold-block.png',
      blockHalfExtents: finishHalf,
      opacity: 0.4,
      rigidBodyOptions: {
        type: RigidBodyType.FIXED,
        colliders: [{
          shape: ColliderShape.BLOCK,
          halfExtents: finishHalf,
          isSensor: true,
        }],
      },
    });
    finishEntity.spawn(world, course.finishGatePosition);
    courseMarkerEntities.push(finishEntity);

    // Checkpoint markers
    const cpTextures = [
      'blocks/glass-aqua.png',
      'blocks/glass-lime.png',
      'blocks/glass-yellow.png',
      'blocks/glass-orange.png',
      'blocks/glass-pink.png',
      'blocks/glass-magenta.png',
      'blocks/glass-purple.png',
      'blocks/glass-light-blue.png',
      'blocks/glass-aqua.png',
      'blocks/glass-lime.png',
    ];

    const cpHalf = {
      x: course.checkpointSize.x / 2,
      y: course.checkpointSize.y / 2,
      z: course.checkpointSize.z / 2,
    };

    course.checkpointPositions.forEach((pos, i) => {
      const cpEntity = new Entity({
        name: `checkpoint_${i}`,
        blockTextureUri: cpTextures[i % cpTextures.length],
        blockHalfExtents: cpHalf,
        opacity: 0.3,
        rigidBodyOptions: {
          type: RigidBodyType.FIXED,
          colliders: [{
            shape: ColliderShape.BLOCK,
            halfExtents: cpHalf,
            isSensor: true,
          }],
        },
      });
      cpEntity.spawn(world, pos);
      courseMarkerEntities.push(cpEntity);
    });

    if (DEBUG_MODE) console.log(`[Main] Spawned course markers for ${course.name}: start, finish, ${course.checkpointPositions.length} checkpoints`);
  }

  function despawnCourseMarkers() {
    for (const entity of courseMarkerEntities) {
      if (entity.isSpawned) entity.despawn();
    }
    courseMarkerEntities = [];
  }

  // ── Chat commands ────────────────────────────────────────

  world.chatManager.registerCommand('/stats', (player) => {
    const pData = persistenceSystem.get(player.id);
    if (!pData) return;
    world.chatManager.sendPlayerMessage(player, `--- Your Stats (${courseManager.courseName}) ---`, 'FFD700');
    world.chatManager.sendPlayerMessage(player, `Level: ${pData.level} | XP: ${pData.xp}`);
    world.chatManager.sendPlayerMessage(player, `Wins: ${pData.wins} | Podiums: ${pData.podiums}`);
    world.chatManager.sendPlayerMessage(player, `Best Time: ${pData.bestTimeMs ? TimerSystem.formatTime(pData.bestTimeMs) : 'None'}`);
    world.chatManager.sendPlayerMessage(player, `Coins: ${pData.coins}`);
  });

  world.chatManager.registerCommand('/lb', (player) => {
    const top = leaderboardSystem.top10;
    world.chatManager.sendPlayerMessage(player, `--- Leaderboard (${courseManager.courseName}) ---`, 'FFD700');
    if (top.length === 0) {
      world.chatManager.sendPlayerMessage(player, 'No times recorded yet!');
      return;
    }
    top.forEach((entry, i) => {
      world.chatManager.sendPlayerMessage(
        player,
        `#${i + 1} ${entry.username} - ${TimerSystem.formatTime(entry.timeMs)}`,
      );
    });
    const rank = leaderboardSystem.getPlayerRank(player.id);
    if (rank) {
      world.chatManager.sendPlayerMessage(player, `Your rank: #${rank}`, '00FF00');
    }
  });

  if (DEBUG_MODE) {
    world.chatManager.registerCommand('/forcestart', (_player) => {
      if (stateMachine.state === GameState.LOBBY_IDLE || stateMachine.state === GameState.LOBBY_COUNTDOWN) {
        // Directly jump to round starting
        (stateMachine as any)._transition(GameState.ROUND_STARTING);
        (stateMachine as any)._stateTimer = 3;
      }
    });
  }
});
