// backup-user-data.mjs — dump ALL user-generated rows before any destructive op.
// Run this BEFORE `prisma db push --force-reset` or any reset so the user's
// answers/thoughts/predictions are never lost. Output: backups/pre-reset-<ts>.json
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";

const prisma = new PrismaClient();
const dir = path.join(process.cwd(), "backups");
await fs.mkdir(dir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const out = path.join(dir, `pre-reset-${ts}.json`);

const dump = {};
dump.users = await prisma.user.findMany();
dump.missions = await prisma.mission.findMany();
dump.questions = await prisma.question.findMany();
dump.predictions = await prisma.prediction.findMany();
dump.reviews = await prisma.review.findMany();
dump.learnings = await prisma.learning.findMany();
dump.knowledgeProgress = await prisma.knowledgeProgress.findMany();
dump.abilities = await prisma.ability.findMany();
dump.abilityHistories = await prisma.abilityHistory.findMany();
dump.dailyStatistics = await prisma.dailyStatistics.findMany();

await fs.writeFile(out, JSON.stringify(dump, null, 2), "utf8");
console.log(`[backup] user data backed up -> ${out}`);
console.log(
  `[backup] missions=${dump.missions.length} questions=${dump.questions.length} predictions=${dump.predictions.length} reviews=${dump.reviews.length}`
);
await prisma.$disconnect();
