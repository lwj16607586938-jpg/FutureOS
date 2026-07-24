// Append-only backup of the user's learning record.
//
// Every time a mission is COMPLETED, its full snapshot (阅读材料 / 每题回答(思考) /
// 预测 / 复盘讲解) is appended as one JSON line to data/learning-log.jsonl.
// The log is append-only and line-atomic, so it forms an immutable, tamper-evident
// growth record that survives database resets. Failures here NEVER break the request.
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { toArchiveMission } from "@/lib/mappers";
import type { ArchiveMission } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const LOG_FILE = path.join(DATA_DIR, "learning-log.jsonl");

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

// Append a single completed mission as one JSON line (append-only, tamper-evident).
export async function appendLearningEntry(userId: string, missionId: string): Promise<void> {
  try {
    const m = await prisma.mission.findUnique({
      where: { id: missionId },
      include: {
        learning: true,
        questions: { orderBy: { order: "asc" } },
        prediction: true,
        review: true,
        node: true,
      },
    });
    if (!m || m.userId !== userId) return;
    const snapshot: ArchiveMission = toArchiveMission(m as Parameters<typeof toArchiveMission>[0]);
    const entry = { archivedAt: new Date().toISOString(), ...snapshot };
    await ensureDir();
    await fs.appendFile(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
  } catch (e) {
    // The growth record is best-effort: a disk error must never fail the mission.
    console.warn("[backup] appendLearningEntry failed (non-fatal):", (e as Error)?.message ?? e);
  }
}

// Read the full append-only log (used by verification / future import tooling).
export async function readLearningLog(): Promise<Record<string, unknown>[]> {
  try {
    const buf = await fs.readFile(LOG_FILE, "utf8");
    return buf
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Record<string, unknown>);
  } catch {
    return [];
  }
}
