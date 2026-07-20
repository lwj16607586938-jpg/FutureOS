// Domain constants shared across engines. Single Source of Truth mirrors doc 06/07/12.

export const ABILITY_DIMENSIONS = [
  "observe",
  "understand",
  "connect",
  "reason",
  "predict",
  "update",
] as const;
export type AbilityDimensionKey = (typeof ABILITY_DIMENSIONS)[number];

export const ABILITY_INIT = 50; // doc 06/07/12
export const ABILITY_MIN = 0;
export const ABILITY_MAX = 100;

export const QUESTION_TYPES = ["EXPLAIN", "REASON", "CONNECT"] as const;
export type QuestionTypeKey = (typeof QUESTION_TYPES)[number];

// Question -> assessed ability dimension (doc 12 §9)
export const QUESTION_DIMENSION: Record<QuestionTypeKey, AbilityDimensionKey> = {
  EXPLAIN: "understand",
  REASON: "reason",
  CONNECT: "connect",
};

export const PREDICTION_STATUS = ["PENDING", "VERIFIED", "FAILED"] as const;
export type PredictionStatusKey = (typeof PREDICTION_STATUS)[number];

export const RELATION_TYPES = [
  "CAUSE",
  "DEPEND_ON",
  "ENABLE",
  "PART_OF",
  "COMPARE",
  "OPPOSITE",
  "EXTENDS",
  "PREREQUISITE",
] as const;

// AI behavior (doc 10 §17 / doc 11 §14 / doc 17 §15)
export const AI_MAX_RETRIES = 2;
export const AI_TIMEOUT_MS = 15000;

// Context Engine token budget (doc 11 §6) — percentages, sum 100
export const TOKEN_BUDGET = {
  SYSTEM: 0.1,
  MISSION: 0.2,
  KNOWLEDGE: 0.3,
  HISTORY: 0.2,
  ABILITY: 0.1,
  OUTPUT: 0.1,
} as const;

// CGS weights (决策 D5): sum = 1.0
export const CGS_WEIGHTS = {
  abilityAverage: 0.4,
  missionConsistency: 0.2,
  predictionQuality: 0.15,
  knowledgeCoverage: 0.15,
  learningStreak: 0.1,
} as const;

// Ability delta rules (doc 12 §7,§8). Env-overridable so the evolution engine
// can be tuned to the user's real learning rhythm (决策 2026-07-17).
export const ABILITY_DELTA = {
  DEFAULT: 0,
  GOOD: Number(process.env.ABILITY_DELTA_GOOD) || 2,
  STRONG: Number(process.env.ABILITY_DELTA_STRONG) || 3, // consecutive good
  MAX_STEP: 3, // never jump >3 in one mission (doc 10 §13)
  MIN_STEP: -2,
} as const;

export const PROMPT_VERSION = "v1.0";

// Default knowledge coverage target for normalization (doc 06 success: 200+ nodes).
// Env-overridable; meaningful once the concept graph is expanded toward 200+.
export const KNOWLEDGE_COVERAGE_TARGET = Number(process.env.KNOWLEDGE_COVERAGE_TARGET) || 200;
// Mission consistency target (weekly active days ≥5 -> 5/7)
export const MISSION_CONSISTENCY_TARGET = 5 / 7;
// Streak normalization cap (days) — env-overridable; larger rewards long-term consistency.
export const STREAK_CAP = Number(process.env.STREAK_CAP) || 60;
