import { prisma } from "@/lib/prisma";
import type { Ability, AbilityHistory, AbilityDimension } from "@prisma/client";
import { ABILITY_INIT, ABILITY_DIMENSIONS } from "@/lib/constants";
import type { AbilityDimensionKey } from "@/lib/constants";

const EMPTY: Record<AbilityDimensionKey, number> = {
  observe: ABILITY_INIT,
  understand: ABILITY_INIT,
  connect: ABILITY_INIT,
  reason: ABILITY_INIT,
  predict: ABILITY_INIT,
  update: ABILITY_INIT,
};

export const abilityRepository = {
  async ensureForUser(userId: string): Promise<Ability> {
    const existing = await prisma.ability.findFirst({ where: { userId } });
    if (existing) return existing;
    return prisma.ability.create({ data: { userId, ...EMPTY } });
  },

  async getByUser(userId: string): Promise<Ability> {
    return this.ensureForUser(userId);
  },

  // Apply deltas atomically and record AbilityHistory for each changed dimension.
  async applyDelta(
    userId: string,
    deltas: Partial<Record<AbilityDimensionKey, number>>,
    reason: string,
    missionId?: string
  ): Promise<Ability> {
    return prisma.$transaction(async (tx) => {
      const ability = await tx.ability.findFirstOrThrow({ where: { userId } });
      const next: Record<string, number> = {};
      const changed: { dimension: AbilityDimension; before: number; after: number }[] = [];
      for (const dim of ABILITY_DIMENSIONS) {
        const d = deltas[dim] ?? 0;
        if (d === 0) continue;
        const before = (ability as any)[dim] as number;
        const after = Math.max(0, Math.min(100, before + d));
        next[dim] = after;
        if (after !== before) changed.push({ dimension: dim.toUpperCase() as AbilityDimension, before, after });
      }
      if (changed.length === 0) return ability;
      const updated = await tx.ability.update({ where: { id: ability.id }, data: next });
      await tx.abilityHistory.createMany({
        data: changed.map((c) => ({
          abilityId: ability.id,
          dimension: c.dimension,
          before: c.before,
          after: c.after,
          reason,
          missionId: missionId ?? null,
        })),
      });
      return updated;
    });
  },

  async getHistory(userId: string, limit = 50): Promise<AbilityHistory[]> {
    const ability = await prisma.ability.findFirst({ where: { userId } });
    if (!ability) return [];
    return prisma.abilityHistory.findMany({
      where: { abilityId: ability.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};
