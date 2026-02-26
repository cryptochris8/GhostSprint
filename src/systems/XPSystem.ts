/**
 * XP awarding system.
 * Awards XP based on round performance and notifies the player.
 */

import type { Player } from 'hytopia';
import { XP_VALUES, DEBUG_MODE } from '../config/gameConfig';
import type { PersistenceSystem } from './PersistenceSystem';

export interface RoundResult {
  playerId: string;
  player: Player;
  finished: boolean;
  timeMs: number | null;
  isNewPB: boolean;
  placement: number; // 1-indexed (0 = DNF)
}

export interface XPAward {
  playerId: string;
  amount: number;
  reasons: string[];
  newLevel: number;
  leveled: boolean;
  coinsAwarded: number;
}

export class XPSystem {
  private _persistence: PersistenceSystem;

  constructor(persistence: PersistenceSystem) {
    this._persistence = persistence;
  }

  /** Award XP for round results. Returns awards for each player. */
  awardRound(results: RoundResult[]): XPAward[] {
    const awards: XPAward[] = [];

    for (const result of results) {
      let amount = 0;
      const reasons: string[] = [];

      if (result.finished) {
        amount += XP_VALUES.finish;
        reasons.push(`Finish: +${XP_VALUES.finish}`);

        // Placement bonuses
        if (result.placement === 1) {
          amount += XP_VALUES.top1;
          reasons.push(`1st Place: +${XP_VALUES.top1}`);
        } else if (result.placement === 2) {
          amount += XP_VALUES.top2;
          reasons.push(`2nd Place: +${XP_VALUES.top2}`);
        } else if (result.placement === 3) {
          amount += XP_VALUES.top3;
          reasons.push(`3rd Place: +${XP_VALUES.top3}`);
        }

        if (result.isNewPB) {
          amount += XP_VALUES.newPB;
          reasons.push(`New PB: +${XP_VALUES.newPB}`);
        }
      } else {
        amount += XP_VALUES.dnf;
        reasons.push(`DNF: +${XP_VALUES.dnf}`);
      }

      const { newLevel, leveled, coinsAwarded } = this._persistence.addXP(result.player, amount);

      awards.push({
        playerId: result.playerId,
        amount,
        reasons,
        newLevel,
        leveled,
        coinsAwarded,
      });

      if (DEBUG_MODE) {
        console.log(`[XP] ${result.player.username}: +${amount} XP (${reasons.join(', ')})`);
      }
    }

    return awards;
  }
}
