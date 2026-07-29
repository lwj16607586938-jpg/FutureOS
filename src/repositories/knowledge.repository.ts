import { prisma } from "@/lib/prisma";
import type { KnowledgeNode, KnowledgeEdge, KnowledgeProgress, KnowledgeProgressStatus } from "@prisma/client";

export const knowledgeRepository = {
  async getGraph(): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> {
    const [nodes, edges] = await Promise.all([
      prisma.knowledgeNode.findMany({ where: { status: "ACTIVE" }, orderBy: { title: "asc" } }),
      prisma.knowledgeEdge.findMany(),
    ]);
    return { nodes, edges };
  },

  async getNodeDetail(id: string, userId: string): Promise<{
    node: KnowledgeNode;
    related: { id: string; title: string; relation: string }[];
    learningStatus: KnowledgeProgressStatus;
  } | null> {
    const node = await prisma.knowledgeNode.findUnique({ where: { id } });
    if (!node) return null;
    const edges = await prisma.knowledgeEdge.findMany({
      where: { OR: [{ sourceNodeId: id }, { targetNodeId: id }] },
      include: { source: true, target: true },
    });
    const related = edges.map((e) => {
      const other = e.sourceNodeId === id ? e.target : e.source;
      return { id: other.id, title: other.title, relation: e.relation };
    });
    const progress = await prisma.knowledgeProgress.findUnique({
      where: { userId_knowledgeNodeId: { userId, knowledgeNodeId: id } },
    });
    return { node, related, learningStatus: progress?.status ?? "UNKNOWN" };
  },

  async getProgressMap(userId: string): Promise<Map<string, KnowledgeProgressStatus>> {
    const rows = await prisma.knowledgeProgress.findMany({ where: { userId } });
    const map = new Map<string, KnowledgeProgressStatus>();
    for (const r of rows) map.set(r.knowledgeNodeId, r.status);
    return map;
  },

  async getProgress(userId: string, nodeId: string): Promise<KnowledgeProgress | null> {
    return prisma.knowledgeProgress.findUnique({
      where: { userId_knowledgeNodeId: { userId, knowledgeNodeId: nodeId } },
    });
  },

  async markLearned(userId: string, nodeId: string, missionId: string, status: KnowledgeProgressStatus = "LEARNED") {
    return prisma.knowledgeProgress.upsert({
      where: { userId_knowledgeNodeId: { userId, knowledgeNodeId: nodeId } },
      create: { userId, knowledgeNodeId: nodeId, status, completedMissionId: missionId },
      update: { status, completedMissionId: missionId },
    });
  },

  async countLearned(userId: string): Promise<number> {
    return prisma.knowledgeProgress.count({ where: { userId, status: { in: ["LEARNED", "MASTERED"] } } });
  },
};
