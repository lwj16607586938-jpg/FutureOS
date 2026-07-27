import { route } from "@/lib/api";
import { missionService } from "@/services/mission/mission.service";
import { drillAnswerInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/mission/drill?missionId=... — return current drill questions (generate if none).
export const GET = route(async (userId, req) => {
  const url = new URL(req.url);
  const missionId = url.searchParams.get("missionId") ?? "";
  return missionService.getOrCreateDrill(userId, missionId);
});

// POST /api/mission/drill — submit drill answers; if all correct mission completes.
export const POST = route(async (userId, _req, body) => {
  const { missionId, answers } = drillAnswerInputSchema.parse(body);
  return missionService.answerDrill(userId, missionId, answers);
});
