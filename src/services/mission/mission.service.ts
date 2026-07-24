import { prisma } from "@/lib/prisma";
import { missionRepository } from "@/repositories/mission.repository";
import { abilityRepository } from "@/repositories/ability.repository";
import { predictionRepository } from "@/repositories/prediction.repository";
import { knowledgeRepository } from "@/repositories/knowledge.repository";
import { statsRepository, recomputeStreak } from "@/repositories/stats.repository";
import { conceptService } from "@/services/concept/concept.service";
import { getAIProvider, buildContext } from "@/services/ai";
import { parseMission, parseReview } from "@/services/ai/parse";
import { toMissionView } from "@/lib/mappers";
import { appendLearningEntry } from "@/lib/backup";
import {
  evidenceToDeltas,
  toAbilityScores,
} from "@/services/cognitive/cognitive.service";
import { QUESTION_DIMENSION, ABILITY_DIMENSIONS } from "@/lib/constants";
import type { AbilityDimensionKey } from "@/lib/constants";
import { NotFoundError, BusinessError, ValidationError } from "@/lib/errors";
import type { MissionView, PredictionView, MissionAIOutput, ReviewAIOutput } from "@/lib/types";

const STAGE_ORDER = [
  "CREATED",
  "STARTED",
  "LEARNING",
  "THINKING",
  "PREDICTION",
  "REVIEW",
  "COMPLETED",
] as const;

function assertForward(current: string, next: string) {
  if (STAGE_ORDER.indexOf(next as any) < STAGE_ORDER.indexOf(current as any)) {
    throw new BusinessError("MISSION_COMPLETED", "状态只能向前推进");
  }
}

export const missionService = {
  async getTodayMission(userId: string, date: string): Promise<MissionView> {
    // Resume the latest mission (burst-safe: may be COMPLETED from a prior round today).
    let m = await missionRepository.getLatest(userId);
    if (!m) m = await missionRepository.createForToday(userId, date);
    return toMissionView(m);
  },

  async startMission(userId: string, date: string, preAI?: MissionAIOutput): Promise<MissionView> {
    let m = await missionRepository.getLatest(userId);
    if (!m) m = await missionRepository.createForToday(userId, date);
    // Burst mode (决策 2026-07-17): if the latest mission is already COMPLETED,
    // spin up a fresh one so the user can do another round the same day.
    if (m.status === "COMPLETED") {
      m = await missionRepository.createForToday(userId, date);
    }
    // Idempotent resume: if already generated (STARTED), return as-is.
    if (m.status === "STARTED") return toMissionView(m);

    const { node, recentThemes, dayIndex } = await conceptService.selectNextConcept(userId);
    const ability = await abilityRepository.getByUser(userId);
    const ctx = buildContext("MISSION", {
      concept: { title: node.title, description: node.description, category: node.category, difficulty: node.difficulty },
      ability: toAbilityScores(ability),
      recentThemes,
      dayIndex,
    });
    const ai = preAI ?? (await getAIProvider().generateMission(ctx));
    const questions = ai.questions.map((q, i) => ({ type: q.type, content: q.content, order: i }));
    // req2/req5/req6: assign the 1-based tier within this node's module so that
    // prediction is gated to the final tier and the same node is studied deeply
    // before moving on. Tier = (completed missions of this node) + 1.
    const doneForNode = await prisma.mission.count({
      where: { userId, theme: node.title, status: "COMPLETED" },
    });
    const tier = doneForNode + 1;
    const updated = await missionRepository.setStarted(m.id, ai.theme, ai.learning, questions, {
      id: node.id,
      tier,
    });
    return toMissionView(updated);
  },

  // Streaming variant of startMission: yields generation deltas for a live
  // "typewriter" UI, then persists the parsed result via startMission(preAI).
  async streamStart(
    userId: string,
    date: string,
    onDelta: (delta: string) => void
  ): Promise<{ missionId: string }> {
    let m = await missionRepository.getLatest(userId);
    if (!m) m = await missionRepository.createForToday(userId, date);
    // Burst mode: if the latest is COMPLETED, start a fresh round.
    if (m.status === "COMPLETED") {
      m = await missionRepository.createForToday(userId, date);
    }
    if (m.status === "STARTED") return { missionId: m.id }; // already generated, nothing to stream

    const { node, recentThemes, dayIndex } = await conceptService.selectNextConcept(userId);
    const ability = await abilityRepository.getByUser(userId);
    const ctx = buildContext("MISSION", {
      concept: { title: node.title, description: node.description, category: node.category, difficulty: node.difficulty },
      ability: toAbilityScores(ability),
      recentThemes,
      dayIndex,
    });
    let acc = "";
    for await (const d of getAIProvider().streamGenerateMission(ctx)) {
      acc += d;
      onDelta(d);
    }
    const ai = parseMission(acc);
    await this.startMission(userId, date, ai);
    return { missionId: m.id };
  },

  async beginThinking(userId: string, missionId: string): Promise<MissionView> {
    const m = await this.requireEditable(userId, missionId);
    if (m.stage === "LEARNING") {
      await missionRepository.setStage(missionId, "THINKING");
      const refreshed = await missionRepository.findById(missionId);
      return toMissionView(refreshed!);
    }
    return toMissionView(m);
  },

  async answerQuestion(
    userId: string,
    missionId: string,
    order: number,
    answer: string
  ): Promise<MissionView> {
    const m = await this.requireEditable(userId, missionId);
    if (m.stage === "CREATED") throw new BusinessError("MISSION_NOT_FOUND", "请先开始 Mission");
    if (![ "LEARNING", "THINKING" ].includes(m.stage)) {
      throw new BusinessError("MISSION_COMPLETED", "当前阶段不可作答");
    }
    await missionRepository.submitQuestionAnswer(missionId, order, answer);
    // First answer moves LEARNING -> THINKING (doc 10 §9/§10).
    if (m.stage === "LEARNING") await missionRepository.setStage(missionId, "THINKING");
    const refreshed = await missionRepository.findById(missionId);
    return toMissionView(refreshed!);
  },

  async submitPrediction(
    userId: string,
    missionId: string,
    data: { content: string; confidence: number; targetDate: string; tag?: string | null }
  ): Promise<PredictionView> {
    const m = await this.requireEditable(userId, missionId);
    const answered = (m.questions ?? []).filter((q) => q.answer && q.answer.trim()).length;
    if (answered < 3) throw new BusinessError("VALIDATION_ERROR", "需先答完 3 道思考题");
    if (m.stage === "PREDICTION" || m.stage === "REVIEW" || m.stage === "COMPLETED") {
      // allow re-edit before completion
    } else {
      assertForward(m.stage, "PREDICTION");
    }
    const confidence = Math.max(0, Math.min(100, Math.round(data.confidence)));
    if (!data.content || !data.content.trim()) throw new ValidationError("预测内容不能为空");
    const target = new Date(data.targetDate);
    if (isNaN(target.getTime())) throw new ValidationError("targetDate 格式无效");

    const existing = await predictionRepository.findByMission(missionId);
    const pred = existing
      ? await prisma.prediction.update({
          where: { id: existing.id },
          data: { content: data.content, confidence, targetDate: target, tag: data.tag ?? null },
        })
      : await predictionRepository.create({
          missionId,
          content: data.content,
          confidence,
          targetDate: target,
          tag: data.tag ?? null,
        });
    if (m.stage !== "PREDICTION" && m.stage !== "REVIEW" && m.stage !== "COMPLETED") {
      await missionRepository.setStage(missionId, "PREDICTION");
    }
    return toPredictionViewLocal(pred);
  },

  async completeMission(userId: string, missionId: string, preReview?: ReviewAIOutput): Promise<MissionView> {
    const m = await missionRepository.findById(missionId);
    if (!m || m.userId !== userId) throw new NotFoundError("MISSION_NOT_FOUND", "Mission 不存在");
    if (m.status === "COMPLETED") throw new BusinessError("MISSION_COMPLETED", "Mission 已完成，不可重复");
    if (!m.learning) throw new BusinessError("VALIDATION_ERROR", "缺少 Learning，无法完成");
    const answered = (m.questions ?? []).filter((q) => q.answer && q.answer.trim());
    if (answered.length < 3) throw new BusinessError("VALIDATION_ERROR", "需先答完 3 道思考题");
    // req2: 预测只在「最终一级」要求，基础级别（L1..Lk-1）不要求预测。
    const isFinalTier = finalTierOf(m);
    if (!m.prediction && isFinalTier) throw new BusinessError("VALIDATION_ERROR", "需先提交预测");

    // AI Review (Context Engine) — never blocks completion; falls back to mock.
    const concept = (await conceptService.getConceptByTitle(m.theme)) ?? {
      title: m.theme,
      description: m.learning?.content ?? "",
      category: null,
      difficulty: 2,
    };
    const ability = await abilityRepository.getByUser(userId);
    const recentRows = await prisma.mission.findMany({
      where: { userId, status: "COMPLETED" },
      select: { theme: true },
      orderBy: { date: "desc" },
      take: 5,
    });
    const ctx = buildContext("REVIEW", {
      concept: { title: concept.title, description: concept.description, category: concept.category, difficulty: concept.difficulty },
      ability: toAbilityScores(ability),
      recentThemes: recentRows.map((r) => r.theme),
      mission: {
        theme: m.theme,
        answers: (m.questions ?? []).map((q) => ({
          order: q.order,
          type: q.type,
          question: q.content,
          answer: q.answer,
        })),
        prediction: m.prediction
          ? { content: m.prediction.content, confidence: m.prediction.confidence, targetDate: m.prediction.targetDate.toISOString() }
          : null,
      },
    });
    const review = preReview ?? (await getAIProvider().generateReview(ctx));

    const answeredDims = answered.map((q) => QUESTION_DIMENSION[q.type as keyof typeof QUESTION_DIMENSION]) as AbilityDimensionKey[];
    const streakBefore = await recomputeStreak(userId);
    const deltas = evidenceToDeltas({ answeredDims, hasPrediction: !!m.prediction, consecutiveGood: streakBefore >= 2 });

    const completed = await prisma.$transaction(async (tx) => {
      // 1) Ability update + history
      const ab = await tx.ability.findFirstOrThrow({ where: { userId } });
      const next: Record<string, number> = {};
      const history: { dimension: any; before: number; after: number }[] = [];
      for (const dim of ABILITY_DIMENSIONS) {
        const d = deltas[dim] ?? 0;
        if (d === 0) continue;
        const before = (ab as any)[dim] as number;
        const after = Math.max(0, Math.min(100, before + d));
        next[dim] = after;
        if (after !== before) history.push({ dimension: dim.toUpperCase() as any, before, after });
      }
      if (Object.keys(next).length > 0) {
        await tx.ability.update({ where: { id: ab.id }, data: next });
        if (history.length > 0) {
          await tx.abilityHistory.createMany({
            data: history.map((h) => ({
              abilityId: ab.id,
              dimension: h.dimension,
              before: h.before,
              after: h.after,
              reason: "mission-complete",
              missionId,
            })),
          });
        }
      }
      // 2) Review upsert
      await tx.review.upsert({
        where: { missionId },
        create: {
          missionId,
          summary: review.summary,
          strength: JSON.stringify(review.strength),
          weakness: JSON.stringify(review.weakness),
          suggestion: JSON.stringify(review.suggestion),
          questionReviews: JSON.stringify(review.questionReviews ?? []),
        },
        update: {
          summary: review.summary,
          strength: JSON.stringify(review.strength),
          weakness: JSON.stringify(review.weakness),
          suggestion: JSON.stringify(review.suggestion),
          questionReviews: JSON.stringify(review.questionReviews ?? []),
        },
      });
      // 3) Mark knowledge learned
      const node = await tx.knowledgeNode.findFirst({ where: { title: m.theme } });
      if (node) {
        await tx.knowledgeProgress.upsert({
          where: { userId_knowledgeNodeId: { userId, knowledgeNodeId: node.id } },
          create: { userId, knowledgeNodeId: node.id, status: "LEARNED", completedMissionId: missionId },
          update: { status: "LEARNED", completedMissionId: missionId },
        });
      }
      // 4) Mission complete
      await tx.mission.update({
        where: { id: missionId },
        data: { status: "COMPLETED", stage: "COMPLETED", completedAt: new Date() },
      });
      return missionId;
    });

    // 5) Recompute cached DailyStatistics (outside tx is fine; single-writer V1)
    const missionCount = await prisma.mission.count({ where: { userId, status: "COMPLETED" } });
    const predictionCount = await predictionRepository.countByUser(userId);
    const knowledgeCount = await knowledgeRepository.countLearned(userId);
    const streak = await recomputeStreak(userId);
    const existing = await statsRepository.ensureForUser(userId);
    await statsRepository.upsert(userId, {
      missionCount,
      predictionCount,
      knowledgeCount,
      currentStreak: streak,
      longestStreak: Math.max(existing.longestStreak, streak),
    });

    const full = await missionRepository.findById(completed);
    if (!full) throw new NotFoundError("MISSION_NOT_FOUND", "Mission 不存在");

    // 用户内容完整保留：每次完成把全量快照追加进 append-only 成长记录。
    // 即便数据库被重置，learning-log.jsonl 仍保留其全部回答/思考/预测。
    await appendLearningEntry(userId, completed);

    return toMissionView(full);
  },

  // Streaming variant of completeMission: yields review deltas for a live
  // "typewriter" UI, then persists the parsed result via completeMission(preReview).
  async streamComplete(
    userId: string,
    missionId: string,
    onDelta: (delta: string) => void
  ): Promise<MissionView> {
    const m = await missionRepository.findById(missionId);
    if (!m || m.userId !== userId) throw new NotFoundError("MISSION_NOT_FOUND", "Mission 不存在");
    if (m.status === "COMPLETED") throw new BusinessError("MISSION_COMPLETED", "Mission 已完成，不可重复");
    if (!m.learning) throw new BusinessError("VALIDATION_ERROR", "缺少 Learning，无法完成");
    const answered = (m.questions ?? []).filter((q) => q.answer && q.answer.trim());
    if (answered.length < 3) throw new BusinessError("VALIDATION_ERROR", "需先答完 3 道思考题");
    // req2: 预测只在「最终一级」要求，基础级别（L1..Lk-1）不要求预测。
    const isFinalTier = finalTierOf(m);
    if (!m.prediction && isFinalTier) throw new BusinessError("VALIDATION_ERROR", "需先提交预测");

    const concept = (await conceptService.getConceptByTitle(m.theme)) ?? {
      title: m.theme,
      description: m.learning?.content ?? "",
      category: null,
      difficulty: 2,
    };
    const ability = await abilityRepository.getByUser(userId);
    const recentRows = await prisma.mission.findMany({
      where: { userId, status: "COMPLETED" },
      select: { theme: true },
      orderBy: { date: "desc" },
      take: 5,
    });
    const ctx = buildContext("REVIEW", {
      concept: { title: concept.title, description: concept.description, category: concept.category, difficulty: concept.difficulty },
      ability: toAbilityScores(ability),
      recentThemes: recentRows.map((r) => r.theme),
      mission: {
        theme: m.theme,
        answers: (m.questions ?? []).map((q) => ({
          order: q.order,
          type: q.type,
          question: q.content,
          answer: q.answer,
        })),
        prediction: m.prediction
          ? { content: m.prediction.content, confidence: m.prediction.confidence, targetDate: m.prediction.targetDate.toISOString() }
          : null,
      },
    });

    let acc = "";
    for await (const d of getAIProvider().streamGenerateReview(ctx)) {
      acc += d;
      onDelta(d);
    }
    const review = parseReview(acc);
    return this.completeMission(userId, missionId, review);
  },

  async requireEditable(userId: string, missionId: string) {
    const m = await missionRepository.findById(missionId);
    if (!m || m.userId !== userId) throw new NotFoundError("MISSION_NOT_FOUND", "Mission 不存在");
    if (m.status === "COMPLETED") throw new BusinessError("MISSION_COMPLETED", "Mission 已完成，不可修改");
    return m;
  },
};

// req2: a mission is the "final tier" of its module when its 1-based tier
// reaches the node's tier count (clamp(difficulty,1,5)). Prediction is only
// required at the final tier; basic tiers (L1..Lk-1) skip it.
function finalTierOf(m: { tier?: number | null; node?: { difficulty: number } | null }): boolean {
  const tierCount = m.node ? Math.min(Math.max(m.node.difficulty, 1), 5) : m.tier ?? 1;
  return (m.tier ?? 1) >= tierCount;
}

function toPredictionViewLocal(p: import("@prisma/client").Prediction): PredictionView {
  return {
    id: p.id,
    missionId: p.missionId,
    content: p.content,
    confidence: p.confidence,
    targetDate: p.targetDate.toISOString(),
    tag: p.tag,
    status: p.status,
    verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
    result: p.result,
    createdAt: p.createdAt.toISOString(),
  };
}
