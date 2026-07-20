import { route } from "@/lib/api";
import { missionService } from "@/services/mission/mission.service";
import { predictionInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const POST = route(async (userId, _req, body) => {
  const { missionId, content, confidence, targetDate, tag } = predictionInputSchema.parse(body);
  return missionService.submitPrediction(userId, missionId, {
    content,
    confidence,
    targetDate,
    tag: tag ?? null,
  });
});
