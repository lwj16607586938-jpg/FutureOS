import { prisma } from "./prisma";

// V1 single-user (doc 03 §7 / doc 06 §5). No auth; all data belongs to one seeded user.
const DEFAULT_NAME = process.env.DEFAULT_USER_NAME || "FutureOS Learner";

export async function ensureDefaultUser() {
  const existing = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.user.create({ data: { name: DEFAULT_NAME } });
}

export async function getDefaultUserId(): Promise<string> {
  const u = await ensureDefaultUser();
  return u.id;
}
