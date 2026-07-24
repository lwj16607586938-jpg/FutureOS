import { NextResponse } from "next/server";
import { getDefaultUserId } from "@/lib/user";
import { missionRepository } from "@/repositories/mission.repository";
import { toArchiveMission } from "@/lib/mappers";
import type { MissionExport } from "@/lib/types";

// GET /api/mission/export — full JSON backup of the user's learning record
// (阅读材料 / 每题回答(思考) / 预测 / 复盘讲解). Portable, machine-readable.
export async function GET() {
  const userId = await getDefaultUserId();
  const rows = await missionRepository.getAllForUser(userId);
  const missions = rows.map((m) => toArchiveMission(m as Parameters<typeof toArchiveMission>[0]));
  const payload: MissionExport = {
    exportedAt: new Date().toISOString(),
    app: "FutureOS",
    version: "1.0",
    missions,
  };
  return NextResponse.json({ success: true, data: payload });
}
