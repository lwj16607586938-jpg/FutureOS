import { route, segmentFromEnd } from "@/lib/api";
import { predictionService } from "@/services/prediction/prediction.service";
import { verifyInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const PATCH = route(async (userId, req, body) => {
  const id = segmentFromEnd(req, 2); // /api/predictions/<id>/verify
  const { status, result } = verifyInputSchema.parse(body);
  return predictionService.verify(userId, id, status, result ?? null);
});
