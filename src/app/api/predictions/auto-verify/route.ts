import { getDefaultUserId } from "@/lib/user";
import { predictionService } from "@/services/prediction/prediction.service";

export const dynamic = "force-dynamic";

// Triggers auto-verification of due (PENDING, past targetDate) predictions.
// Safe: predictions the model can't judge are left PENDING (never false-verified).
export const POST = async (_req: Request): Promise<Response> => {
  const userId = await getDefaultUserId();
  const result = await predictionService.autoVerifyDue(userId);
  return Response.json({ success: true, data: result });
};
