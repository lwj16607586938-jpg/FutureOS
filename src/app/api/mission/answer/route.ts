import { route } from "@/lib/api";
import { missionService } from "@/services/mission/mission.service";
import { answerInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const POST = route(async (userId, _req, body) => {
  const { missionId, order, answer } = answerInputSchema.parse(body);
  return missionService.answerQuestion(userId, missionId, order, answer);
});
