import { knowledgeRepository } from "@/repositories/knowledge.repository";
import { toPredictionView } from "@/lib/mappers";
import { NotFoundError } from "@/lib/errors";
import type { WorldView, NodeDetailView } from "@/lib/types";

// World (Concept Graph) Module service (doc 03 FR-006 / doc 13). V1 read-only.
export const knowledgeService = {
  async getWorld(userId: string): Promise<WorldView> {
    const { nodes, edges } = await knowledgeRepository.getGraph();
    const progressMap = await knowledgeRepository.getProgressMap(userId);
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        title: n.title,
        slug: n.slug,
        category: n.category,
        difficulty: n.difficulty,
        learningStatus: progressMap.get(n.id) ?? "UNKNOWN",
      })),
      edges: edges.map((e) => ({
        id: e.id,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        relation: e.relation,
      })),
    };
  },

  async getNodeDetail(userId: string, id: string): Promise<NodeDetailView> {
    const detail = await knowledgeRepository.getNodeDetail(id, userId);
    if (!detail) throw new NotFoundError("KNOWLEDGE_NOT_FOUND", "概念不存在");
    return {
      id: detail.node.id,
      title: detail.node.title,
      description: detail.node.description,
      category: detail.node.category,
      difficulty: detail.node.difficulty,
      relatedNodes: detail.related,
      learningStatus: detail.learningStatus,
    };
  },
};

void toPredictionView;
