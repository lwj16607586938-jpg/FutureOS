import { prisma } from "@/lib/prisma";
import { abilityRepository } from "@/repositories/ability.repository";
import { predictionRepository } from "@/repositories/prediction.repository";
import { knowledgeRepository } from "@/repositories/knowledge.repository";
import { statsRepository, recomputeStreak } from "@/repositories/stats.repository";
import {
  abilityAverage,
  computeCGS,
  toAbilityScores,
} from "@/services/cognitive/cognitive.service";
import {
  ABILITY_INIT,
  KNOWLEDGE_COVERAGE_TARGET,
  STREAK_CAP,
} from "@/lib/constants";
import type { GrowthView, TrendPoint, AbilityScores } from "@/lib/types";

// Growth Module service (doc 03 FR-008 / doc 12 §11/§13). Read-only aggregation.
export const growthService = {
  async getGrowth(userId: string): Promise<GrowthView> {
    const ability = await abilityRepository.getByUser(userId);
    const scores = toAbilityScores(ability);
    const avg = abilityAverage(scores);

    const [missionCount, predictionCount, knowledgeCount, stats, streak] = await Promise.all([
      prisma.mission.count({ where: { userId, status: "COMPLETED" } }),
      predictionRepository.countByUser(userId),
      knowledgeRepository.countLearned(userId),
      statsRepository.ensureForUser(userId),
      recomputeStreak(userId),
    ]);

    const missionConsistency = await this.missionConsistency(userId);
    const predictionQuality = await this.predictionQuality();
    const knowledgeCoverage = Math.min(1, knowledgeCount / KNOWLEDGE_COVERAGE_TARGET);
    const learningStreak = Math.min(1, streak / STREAK_CAP);

    const cgs = computeCGS({
      abilityAverage: avg,
      missionConsistency,
      predictionQuality,
      knowledgeCoverage,
      learningStreak,
    });

    const trend = await this.buildTrend(userId, {
      missionConsistency,
      predictionQuality,
      knowledgeCoverage,
      learningStreak,
    });

    return {
      ability: scores,
      cgs,
      missionCount,
      predictionCount,
      knowledgeCount,
      currentStreak: streak,
      longestStreak: stats.longestStreak,
      trend,
    };
  },

  // Completed missions within the last 7 days / 7 (doc 12 success: weekly active).
  async missionConsistency(userId: string): Promise<number> {
    const since = new Date(Date.now() - 7 * 86400000);
    const c = await prisma.mission.count({
      where: { userId, status: "COMPLETED", completedAt: { gte: since } },
    });
    return Math.min(1, c / 7);
  },

  async predictionQuality(): Promise<number> {
    const [verified, failed] = await Promise.all([
      prisma.prediction.count({ where: { status: "VERIFIED" } }),
      prisma.prediction.count({ where: { status: "FAILED" } }),
    ]);
    const denom = verified + failed;
    if (denom === 0) return 0;
    return verified / denom;
  },

  // CGS trend reconstructed from AbilityHistory (ability is the dominant 0.40 signal).
  async buildTrend(
    userId: string,
    factors: { missionConsistency: number; predictionQuality: number; knowledgeCoverage: number; learningStreak: number }
  ): Promise<TrendPoint[]> {
    const ability = await abilityRepository.getByUser(userId);
    const history = await abilityRepository.getHistory(userId, 500);
    if (history.length === 0) {
      return [{ date: new Date().toISOString().slice(0, 10), cgs: computeCGS({ abilityAverage: ABILITY_INIT, ...factors }) }];
    }
    const running: AbilityScores = { ...toAbilityScores(ability) };
    // Reset to initial, then replay history ascending to reconstruct the path.
    for (const k of Object.keys(running) as (keyof AbilityScores)[]) (running as any)[k] = ABILITY_INIT;
    const byDate = new Map<string, number>();
    const sorted = [...history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const h of sorted) {
      (running as any)[h.dimension.toLowerCase()] = h.after;
      const date = h.createdAt.toISOString().slice(0, 10);
      byDate.set(date, computeCGS({ abilityAverage: abilityAverage(running), ...factors }));
    }
    return [...byDate.entries()].map(([date, cgs]) => ({ date, cgs }));
  },
};
