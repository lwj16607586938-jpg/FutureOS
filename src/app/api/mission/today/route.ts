import { routeToday } from "@/lib/api";
import { missionService } from "@/services/mission/mission.service";

export const dynamic = "force-dynamic";
export const GET = routeToday((userId, date) => missionService.getTodayMission(userId, date));
