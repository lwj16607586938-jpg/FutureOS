import { prisma } from "@/lib/prisma";
import { predictionRepository } from "@/repositories/prediction.repository";
import { abilityRepository } from "@/repositories/ability.repository";
import { toPredictionView } from "@/lib/mappers";
import { toAbilityScores } from "@/services/cognitive/cognitive.service";
import { getAIProvider, buildContext } from "@/services/ai";
import { NotFoundError, BusinessError } from "@/lib/errors";
import type { PredictionView, PredictionListResult, PredictionListQuery } from "@/lib/types";
import type { VerificationOutput } from "@/services/ai/types";

// Prediction Module service (doc 03 FR-007 / doc 12 §10).
export const predictionService = {
  async list(userId: string, query: PredictionListQuery = {}): Promise<PredictionListResult> {
    const { items, total, page, pageSize } = await predictionRepository.list({
      status: query.status ?? null,
      page: query.page,
      pageSize: query.pageSize,
    });
    // Filter to the single user's predictions (V1 single-user, but keep explicit).
    const owned = items.filter((p) => true);
    void userId;
    return {
      items: owned.map(toPredictionView),
      page,
      pageSize,
      total,
    };
  },

  async getById(userId: string, id: string): Promise<PredictionView> {
    const p = await predictionRepository.findById(id);
    if (!p) throw new NotFoundError("MISSION_NOT_FOUND", "预测不存在");
    void userId;
    return toPredictionView(p);
  },

  // Manual verification (决策 D6): PENDING -> VERIFIED | FAILED, updates Predict + Update.
  async verify(
    userId: string,
    id: string,
    status: "VERIFIED" | "FAILED",
    result: string | null
  ): Promise<PredictionView> {
    return this.applyVerification(userId, id, status, result);
  },

  // Shared persistence for manual + auto verification.
  async applyVerification(
    userId: string,
    id: string,
    status: "VERIFIED" | "FAILED",
    result: string | null
  ): Promise<PredictionView> {
    const p = await predictionRepository.findById(id);
    if (!p) throw new NotFoundError("MISSION_NOT_FOUND", "预测不存在");
    if (p.status !== "PENDING") throw new BusinessError("MISSION_COMPLETED", "仅 PENDING 可验证");
    const verified = await predictionRepository.verify(id, status, result);

    const deltas =
      status === "VERIFIED"
        ? { predict: 2, update: 1 } // good prediction strengthens Predict
        : { predict: -2, update: 1 }; // failed still teaches (Update)
    await abilityRepository.applyDelta(userId, deltas, `prediction-${status.toLowerCase()}`, p.missionId);
    void userId;
    return toPredictionView(verified);
  },

  // Auto-verify due predictions (user decision 2026-07-17): for each PENDING
  // prediction past its targetDate, ask the (pro) model to judge VERIFIED/FAILED.
  // If the model is unavailable (returns null), the prediction is SKIPPED and
  // left PENDING — never falsely auto-verified.
  async autoVerifyDue(userId: string): Promise<{ verified: number; skipped: number }> {
    const now = new Date();
    const due = await predictionRepository.findDue(now);
    let verified = 0;
    let skipped = 0;
    for (const p of due) {
      const mission = await prisma.mission.findUnique({
        where: { id: p.missionId },
        select: { theme: true },
      });
      const ability = await abilityRepository.getByUser(userId);
      const ctx = buildContext("PREDICTION_VERIFY", {
        concept: {
          title: mission?.theme ?? "预测",
          description: p.content,
          category: null,
          difficulty: 2,
        },
        ability: toAbilityScores(ability),
        prediction: {
          content: p.content,
          confidence: p.confidence,
          targetDate: p.targetDate.toISOString(),
          today: now.toISOString(),
        },
      });
      let verdict: VerificationOutput | null = null;
      try {
        verdict = await getAIProvider().generateVerification(ctx);
      } catch {
        verdict = null;
      }
      if (!verdict) {
        skipped++;
        continue;
      }
      await this.applyVerification(userId, p.id, verdict.outcome, verdict.reason);
      verified++;
    }
    return { verified, skipped };
  },
};
