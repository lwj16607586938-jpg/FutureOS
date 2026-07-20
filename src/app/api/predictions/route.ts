import { route } from "@/lib/api";
import { predictionService } from "@/services/prediction/prediction.service";
import type { PredictionStatusKey } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const GET = route(async (userId, req) => {
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") as PredictionStatusKey) || null;
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  return predictionService.list(userId, { status, page, pageSize });
});
