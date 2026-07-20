import { route, segmentFromEnd } from "@/lib/api";
import { predictionService } from "@/services/prediction/prediction.service";

export const dynamic = "force-dynamic";
export const GET = route(async (userId, req) => {
  const id = segmentFromEnd(req, 1);
  return predictionService.getById(userId, id);
});
