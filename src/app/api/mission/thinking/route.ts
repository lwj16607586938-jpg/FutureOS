import { route } from "@/lib/api";
import { missionService } from "@/services/mission/mission.service";
import { z } from "zod";

const schema = z.object({ missionId: z.string().min(1) });

export const dynamic = "force-dynamic";
export const POST = route(async (userId, _req, body) => {
  const { missionId } = schema.parse(body);
  return missionService.beginThinking(userId, missionId);
});
