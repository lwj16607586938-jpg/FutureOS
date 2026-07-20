import { prisma } from "@/lib/prisma";
import { STREAK_CAP } from "@/lib/constants";

// DailyStatistics is a per-user cache (doc 06 / 增补 A7). Recomputed on each Mission completion.
export const statsRepository = {
  async ensureForUser(userId: string) {
    const existing = await prisma.dailyStatistics.findFirst({ where: { userId } });
    if (existing) return existing;
    return prisma.dailyStatistics.create({
      data: { userId, missionCount: 0, predictionCount: 0, knowledgeCount: 0, currentStreak: 0, longestStreak: 0 },
    });
  },

  async upsert(
    userId: string,
    data: {
      missionCount?: number;
      predictionCount?: number;
      knowledgeCount?: number;
      currentStreak?: number;
      longestStreak?: number;
    }
  ) {
    const existing = await this.ensureForUser(userId);
    const longestStreak = Math.max(existing.longestStreak, data.currentStreak ?? existing.currentStreak);
    return prisma.dailyStatistics.update({
      where: { id: existing.id },
      data: { ...data, longestStreak },
    });
  },
};

// Recompute streak from completed mission dates (consecutive days ending today or yesterday).
export async function recomputeStreak(userId: string): Promise<number> {
  const rows = await prisma.mission.findMany({
    where: { userId, status: "COMPLETED" },
    select: { date: true },
    orderBy: { date: "desc" },
  });
  const dates = new Set(rows.map((r) => r.date));
  const today = new Date();
  // allow streak to count if last completion was today or yesterday
  let cursor = new Date(today);
  const todayStr = toYMD(today);
  const yesterdayStr = toYMD(new Date(today.getTime() - 86400000));
  if (!dates.has(todayStr) && !dates.has(yesterdayStr)) return 0;
  if (!dates.has(todayStr)) cursor = new Date(today.getTime() - 86400000);
  let streak = 0;
  while (dates.has(toYMD(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - 86400000);
    if (streak > STREAK_CAP) break;
  }
  return streak;
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}
