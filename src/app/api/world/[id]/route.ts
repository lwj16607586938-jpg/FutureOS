import { route, segmentFromEnd } from "@/lib/api";
import { knowledgeService } from "@/services/knowledge/knowledge.service";

export const dynamic = "force-dynamic";
export const GET = route(async (userId, req) => {
  const id = segmentFromEnd(req, 1);
  return knowledgeService.getNodeDetail(userId, id);
});
