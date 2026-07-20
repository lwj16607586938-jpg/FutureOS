import { getDefaultUserId } from "@/lib/user";
import { toAppError } from "@/lib/errors";
import { todayStr } from "@/lib/utils";
import { missionService } from "@/services/mission/mission.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Streaming Mission generation: emits Server-Sent Events with `data: {delta}`
// for each model token, then `event: done data: {missionId}` when persisted.
export const POST = async (_req: Request): Promise<Response> => {
  const userId = await getDefaultUserId();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const onDelta = (d: string) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: d })}\n\n`));
        const { missionId } = await missionService.streamStart(userId, todayStr(), onDelta);
        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ missionId })}\n\n`));
      } catch (e) {
        const err = toAppError(e);
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};
