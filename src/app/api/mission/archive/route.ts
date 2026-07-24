import { NextResponse } from "next/server";
import { getDefaultUserId } from "@/lib/user";
import { missionRepository } from "@/repositories/mission.repository";
import { toArchiveMission } from "@/lib/mappers";
import type { ArchiveMission } from "@/lib/types";

// GET /api/mission/archive — all missions for the user (every tier/node), so the
// user can browse back through everything they've written. Returns { missions }.
export async function GET() {
  const userId = await getDefaultUserId();
  const rows = await missionRepository.getAllForUser(userId);
  const missions: ArchiveMission[] = rows.map((m) => toArchiveMission(m as Parameters<typeof toArchiveMission>[0]));
  return NextResponse.json({ success: true, data: { missions } });
}
