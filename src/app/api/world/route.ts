import { route } from "@/lib/api";
import { knowledgeService } from "@/services/knowledge/knowledge.service";

export const dynamic = "force-dynamic";
export const GET = route(async (userId) => knowledgeService.getWorld(userId));
