import {
  ABILITY_DELTA,
  ABILITY_DIMENSIONS,
  ABILITY_INIT,
  CGS_WEIGHTS,
} from "@/lib/constants";
import type { AbilityDimensionKey } from "@/lib/constants";
import type { AbilityScores } from "@/lib/types";

// Cognitive Engine — pure computation only (doc 12). No DB, no UI.

export interface MissionEvidence {
  answeredDims: AbilityDimensionKey[]; // dimensions exercised by answered questions
  hasPrediction: boolean;
  consecutiveGood: boolean; // prior streak >= 2 => treat as consecutive good day
}

// doc 12 §7/§8: small-step updates, −2..+3, good=+2, consecutive good=+3.
export function evidenceToDeltas(ev: MissionEvidence): Partial<Record<AbilityDimensionKey, number>> {
  const deltas: Partial<Record<AbilityDimensionKey, number>> = {};
  for (const dim of ev.answeredDims) {
    deltas[dim] = Math.min(ABILITY_DELTA.MAX_STEP, ABILITY_DELTA.GOOD);
  }
  if (ev.hasPrediction) {
    deltas.predict = Math.min(ABILITY_DELTA.MAX_STEP, ABILITY_DELTA.GOOD);
  }
  // Long-term Update (doc 12 §9): +1 per completion; +3 when on a consecutive-good streak.
  deltas.update = ev.consecutiveGood
    ? Math.min(ABILITY_DELTA.MAX_STEP, ABILITY_DELTA.STRONG)
    : Math.min(ABILITY_DELTA.MAX_STEP, ABILITY_DELTA.DEFAULT + 1);
  return deltas;
}

export interface CGSInputs {
  abilityAverage: number; // 0-100
  missionConsistency: number; // 0-1
  predictionQuality: number; // 0-1
  knowledgeCoverage: number; // 0-1
  learningStreak: number; // 0-1 (normalized)
}

// doc 12 §11 + 决策 D5 weights. Returns 0-100.
export function computeCGS(i: CGSInputs): number {
  const raw =
    i.abilityAverage * CGS_WEIGHTS.abilityAverage +
    i.missionConsistency * 100 * CGS_WEIGHTS.missionConsistency +
    i.predictionQuality * 100 * CGS_WEIGHTS.predictionQuality +
    i.knowledgeCoverage * 100 * CGS_WEIGHTS.knowledgeCoverage +
    i.learningStreak * 100 * CGS_WEIGHTS.learningStreak;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function toAbilityScores(a: {
  observe: number;
  understand: number;
  connect: number;
  reason: number;
  predict: number;
  update: number;
}): AbilityScores {
  return {
    observe: a.observe,
    understand: a.understand,
    connect: a.connect,
    reason: a.reason,
    predict: a.predict,
    update: a.update,
  };
}

export function abilityAverage(s: AbilityScores): number {
  const vals = ABILITY_DIMENSIONS.map((d) => s[d]);
  return Math.round(vals.reduce((x, y) => x + y, 0) / vals.length);
}

export { ABILITY_INIT };
