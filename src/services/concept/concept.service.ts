import { prisma } from "@/lib/prisma";
import type { KnowledgeNode } from "@prisma/client";

// Concept Engine — selects the next concept to learn (doc 10 §7 / doc 13 §13).
// Deterministic, never random: ① next-node of learned → ② high-degree → ③ long-unlearned → ④ new.
export const conceptService = {
  async selectNextConcept(
    userId: string
  ): Promise<{ node: KnowledgeNode; recentThemes: string[]; dayIndex: number }> {
    const [progress, allNodes, edges, completed] = await Promise.all([
      prisma.knowledgeProgress.findMany({
        where: { userId, status: { in: ["LEARNED", "MASTERED"] } },
        select: { knowledgeNodeId: true, updatedAt: true },
      }),
      prisma.knowledgeNode.findMany({ where: { status: "ACTIVE" } }),
      prisma.knowledgeEdge.findMany(),
      prisma.mission.findMany({
        where: { userId, status: "COMPLETED" },
        select: { theme: true, date: true },
        orderBy: { date: "desc" },
        take: 6,
      }),
    ]);

    const learnedIds = new Set(progress.map((p) => p.knowledgeNodeId));
    const recentThemes = completed.map((c) => c.theme);
    const recentSet = new Set(recentThemes);
    const dayIndex = completed.length + 1;

    const degree = new Map<string, number>();
    for (const e of edges) {
      degree.set(e.sourceNodeId, (degree.get(e.sourceNodeId) ?? 0) + 1);
      degree.set(e.targetNodeId, (degree.get(e.targetNodeId) ?? 0) + 1);
    }
    const deg = (id: string) => degree.get(id) ?? 0;

    const unlearned = allNodes.filter((n) => !learnedIds.has(n.id));

    // ① Candidate next nodes: outgoing edges from learned nodes to unlearned nodes.
    const nextSet = new Set<string>();
    for (const e of edges) {
      if (learnedIds.has(e.sourceNodeId) && !learnedIds.has(e.targetNodeId)) {
        nextSet.add(e.targetNodeId);
      }
    }
    const candidates = allNodes.filter((n) => nextSet.has(n.id));

    const pick = (pool: KnowledgeNode[]): KnowledgeNode => {
      // Prefer nodes not repeated in recent themes; tie-break by degree desc, then title asc.
      const fresh = pool.filter((n) => !recentSet.has(n.title));
      const usePool = fresh.length > 0 ? fresh : pool;
      return [...usePool].sort((a, b) => deg(b.id) - deg(a.id) || a.title.localeCompare(b.title))[0];
    };

    let chosen: KnowledgeNode | undefined;
    if (candidates.length > 0) chosen = pick(candidates); // ①② combined
    else if (unlearned.length > 0) chosen = pick(unlearned); // ②③
    else chosen = pick(allNodes); // ④ review mode (all learned)

    if (!chosen) {
      // Fallback: deterministic first node by title.
      chosen = [...allNodes].sort((a, b) => a.title.localeCompare(b.title))[0];
    }
    return { node: chosen, recentThemes, dayIndex };
  },

  async getConceptByTitle(title: string): Promise<KnowledgeNode | null> {
    return prisma.knowledgeNode.findFirst({ where: { title } });
  },
};
