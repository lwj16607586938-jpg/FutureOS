import { route } from "@/lib/api";
import { missionService } from "@/services/mission/mission.service";
import { completeInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const POST = route(async (userId, _req, body) => {
  const { missionId } = completeInputSchema.parse(body);
  return missionService.completeMission(userId, missionId);
});
