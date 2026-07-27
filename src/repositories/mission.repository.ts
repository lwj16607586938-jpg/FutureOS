import { prisma } from "@/lib/prisma";
import type { Mission, MissionStage, MissionStatus } from "@prisma/client";

const include = {
  learning: true,
  questions: { orderBy: { order: "asc" } },
  prediction: true,
  review: true,
  node: true,
} as const;

export type MissionWithRelations = Mission & {
  learning: { title: string; content: string; estimatedMinutes: number } | null;
  questions: { order: number; type: string; content: string; answer: string | null }[];
  prediction: import("@prisma/client").Prediction | null;
  review: import("@prisma/client").Review | null;
  node: { id: string; difficulty: number } | null;
  drillQuestions: unknown;
};

export const missionRepository = {
  // Latest mission for a given calendar day (burst-safe: may be >1 per day).
  async getToday(userId: string, date: string): Promise<MissionWithRelations | null> {
    return prisma.mission.findFirst({
      where: { userId, date },
      orderBy: { createdAt: "desc" },
      include,
    });
  },

  // The single most recent mission for the user (any day) — used for "resume /
  // current mission" and to decide whether to spin up a fresh one (burst mode).
  async getLatest(userId: string): Promise<MissionWithRelations | null> {
    return prisma.mission.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include });
  },

  async findById(id: string): Promise<MissionWithRelations | null> {
    return prisma.mission.findUnique({ where: { id }, include });
  },

  async createForToday(userId: string, date: string): Promise<MissionWithRelations> {
    return prisma.mission.create({ data: { userId, date, theme: "", status: "CREATED", stage: "CREATED" }, include });
  },

  async setStarted(
    id: string,
    theme: string,
    learning: { title: string; content: string; estimatedMinutes: number },
    questions: { type: string; content: string; order: number }[],
    node?: { id: string; tier: number } | null
  ): Promise<MissionWithRelations> {
    return prisma.$transaction(async (tx) => {
      const m = await tx.mission.update({
        where: { id },
        data: {
          theme,
          status: "STARTED",
          stage: "LEARNING",
          startedAt: new Date(),
          nodeId: node?.id ?? null,
          tier: node?.tier ?? 1,
        },
        include,
      });
      await tx.learning.upsert({
        where: { missionId: id },
        create: { missionId: id, title: learning.title, content: learning.content, estimatedMinutes: learning.estimatedMinutes },
        update: { title: learning.title, content: learning.content, estimatedMinutes: learning.estimatedMinutes },
      });
      // Replace questions for idempotent regeneration
      await tx.question.deleteMany({ where: { missionId: id } });
      await tx.question.createMany({
        data: questions.map((q) => ({ missionId: id, type: q.type as any, content: q.content, order: q.order })),
      });
      const refreshed = await tx.mission.findUnique({ where: { id }, include });
      return refreshed as MissionWithRelations;
    });
  },

  async setStage(id: string, stage: MissionStage): Promise<void> {
    await prisma.mission.update({ where: { id }, data: { stage } });
  },

  async setDrillQuestions(id: string, questions: unknown[]): Promise<void> {
    await prisma.mission.update({
      where: { id },
      data: { stage: "DRILL", drillQuestions: questions as any },
    });
  },

  async submitDrillAnswer(id: string, questionId: string, userAnswer: string, isCorrect: boolean): Promise<void> {
    const m = await prisma.mission.findUnique({ where: { id }, select: { drillQuestions: true } });
    let arr: any[] = [];
    const raw = m?.drillQuestions;
    if (typeof raw === "string") {
      try { arr = JSON.parse(raw); } catch { arr = []; }
    } else if (Array.isArray(raw)) {
      arr = raw as any[];
    }
    const next = arr.map((q: any) =>
      String(q?.id) === questionId ? { ...q, userAnswer, isCorrect } : q
    );
    await prisma.mission.update({ where: { id }, data: { drillQuestions: next as any } });
  },

  // Persists an answer (idempotent). Stage transitions are owned by the service layer.
  async submitQuestionAnswer(id: string, order: number, answer: string): Promise<void> {
    await prisma.question.updateMany({ where: { missionId: id, order }, data: { answer } });
  },

  async countAnswered(id: string): Promise<number> {
    return prisma.question.count({ where: { missionId: id, NOT: { answer: null } } });
  },

  async hasLearning(id: string): Promise<boolean> {
    const l = await prisma.learning.findUnique({ where: { missionId: id } });
    return !!l;
  },

  async complete(id: string): Promise<MissionWithRelations> {
    return prisma.mission.update({
      where: { id },
      data: { status: "COMPLETED", stage: "COMPLETED", completedAt: new Date() },
      include,
    });
  },

  async countCompleted(userId: string): Promise<number> {
    return prisma.mission.count({ where: { userId, status: "COMPLETED" } });
  },

  async getCompletedInRange(userId: string, from: Date, to: Date): Promise<{ date: string; status: string }[]> {
    const rows = await prisma.mission.findMany({
      where: { userId, completedAt: { gte: from, lte: to } },
      select: { date: true, status: true },
    });
    return rows.map((r) => ({ date: r.date, status: r.status }));
  },

  // All missions for a user (oldest→newest by date), with full relations.
  // Used by the archive view and JSON export — surfaces EVERY mission (all tiers/
  // nodes), not just the latest, so nothing the user wrote is unreachable.
  async getAllForUser(userId: string): Promise<MissionWithRelations[]> {
    return prisma.mission.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include,
    });
  },
};
