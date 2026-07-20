import { prisma } from "@/lib/prisma";
import type { Prediction, PredictionStatus } from "@prisma/client";

export const predictionRepository = {
  async create(data: {
    missionId: string;
    content: string;
    confidence: number;
    targetDate: Date;
    tag?: string | null;
  }): Promise<Prediction> {
    return prisma.prediction.create({ data });
  },

  async findByMission(missionId: string): Promise<Prediction | null> {
    return prisma.prediction.findUnique({ where: { missionId } });
  },

  async findById(id: string): Promise<Prediction | null> {
    return prisma.prediction.findUnique({ where: { id } });
  },

  async list(params: {
    status?: PredictionStatus | null;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Prediction[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
    const where = params.status ? { status: params.status } : {};
    const [items, total] = await Promise.all([
      prisma.prediction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.prediction.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  async countByUser(userId: string): Promise<number> {
    return prisma.prediction.count({
      where: { mission: { userId } },
    });
  },

  // Predictions awaiting verification whose targetDate has passed (auto-verify).
  async findDue(now: Date): Promise<Prediction[]> {
    return prisma.prediction.findMany({
      where: { status: "PENDING", targetDate: { lte: now } },
      orderBy: { targetDate: "asc" },
    });
  },

  // Manual verification (决策 D6): PENDING -> VERIFIED | FAILED.
  async verify(id: string, status: "VERIFIED" | "FAILED", result: string | null): Promise<Prediction> {
    return prisma.prediction.update({
      where: { id },
      data: { status, result, verifiedAt: new Date() },
    });
  },
};
