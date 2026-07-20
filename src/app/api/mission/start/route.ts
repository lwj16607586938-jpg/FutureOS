import { route } from "@/lib/api";
import { missionService } from "@/services/mission/mission.service";
import { todayStr } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const POST = route(async (userId) => missionService.startMission(userId, todayStr()));
