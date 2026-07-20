import { getDefaultUserId } from "@/lib/user";
import { toAppError } from "@/lib/errors";
import { missionService } from "@/services/mission/mission.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Streaming Mission completion: emits SSE `data: {delta}` for each review token,
// then `event: done data: {missionId}` once the review is persisted.
export const POST = async (req: Request): Promise<Response> => {
  const userId = await getDefaultUserId();
  let missionId = "";
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = (await req.json()) as { missionId?: string };
      missionId = body.missionId ?? "";
    }
  } catch {
    /* ignore body parse errors */
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!missionId) throw new Error("missionId 缺失");
        const onDelta = (d: string) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: d })}\n\n`));
        await missionService.streamComplete(userId, missionId, onDelta);
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
