// reset-concepts-only.mjs — SAFE reset for development.
// Deletes ONLY the concept graph (KnowledgeNode / KnowledgeEdge / KnowledgeProgress)
// and re-seeds it, while PRESERVING all user-generated learning data
// (missions / questions / predictions / reviews / abilities / stats).
//
// USE THIS instead of `prisma db push --force-reset`, which would WIPE the user's
// precious answers/thoughts/predictions.
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const prisma = new PrismaClient();

// 1) Null out the (optional) node FK on missions so deleting nodes can't fail,
//    and drop the concept tables + progress pointers.
await prisma.mission.updateMany({ data: { nodeId: null } });
await prisma.knowledgeProgress.deleteMany({});
await prisma.knowledgeEdge.deleteMany({});
await prisma.knowledgeNode.deleteMany({});
console.log("[reset] concept graph cleared (user learning data kept)");

// 2) Re-seed the concept graph (and upsert the default user — idempotent).
execSync("npx prisma db seed", { stdio: "inherit" });

const missions = await prisma.mission.count();
console.log(`[reset] done. user missions preserved: ${missions}`);
await prisma.$disconnect();
