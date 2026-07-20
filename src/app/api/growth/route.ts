import { route } from "@/lib/api";
import { growthService } from "@/services/growth/growth.service";

export const dynamic = "force-dynamic";
export const GET = route(async (userId) => growthService.getGrowth(userId));
