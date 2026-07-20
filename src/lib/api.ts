import { NextResponse } from "next/server";
import { getDefaultUserId } from "@/lib/user";
import { toAppError } from "@/lib/errors";
import { todayStr } from "@/lib/utils";
import type { ApiResponse } from "@/lib/types";

type Handler<B, R> = (userId: string, req: Request, body: B) => Promise<R>;

// Generic route wrapper: resolves the single V1 user, parses JSON body (if any),
// runs the handler, and envelopes the result or maps AppError to a status code.
export function route<B = unknown, R = unknown>(handler: Handler<B, R>) {
  return async (req: Request): Promise<NextResponse> => {
    try {
      const userId = await getDefaultUserId();
      let body: B = undefined as unknown as B;
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json") && (req.method === "POST" || req.method === "PATCH" || req.method === "PUT")) {
        try {
          body = (await req.json()) as B;
        } catch {
          body = undefined as unknown as B;
        }
      }
      const data = await handler(userId, req, body);
      return NextResponse.json({ success: true, data } satisfies ApiResponse<R>);
    } catch (e) {
      const err = toAppError(e);
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } } satisfies ApiResponse<never>,
        { status: err.status }
      );
    }
  };
}

// Convenience for GET handlers that need today's date.
export function routeToday<R>(handler: (userId: string, date: string) => Promise<R>) {
  return route<unknown, R>(async (userId) => handler(userId, todayStr()));
}

// Extract a path segment by position from the end (Next 16 dynamic routes).
// e.g. /api/predictions/<id>/verify -> segmentFromEnd(req, 2) === <id>
export function segmentFromEnd(req: Request, n = 1): string {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  return parts[parts.length - n] ?? "";
}
