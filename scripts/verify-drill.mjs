process.loadEnvFile && process.loadEnvFile(".env");
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const BASE = "http://localhost:3000";

async function post(url, body) {
  const r = await fetch(BASE + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) throw new Error(`${url} -> ${r.status}: ${JSON.stringify(j)}`);
  return j.data;
}

async function get(url) {
  const r = await fetch(BASE + url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) throw new Error(`${url} -> ${r.status}: ${JSON.stringify(j)}`);
  return j.data;
}

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT FAIL: " + msg);
  console.log("✓", msg);
}

console.log("[0] clear previous test missions");
await prisma.$transaction([
  prisma.review.deleteMany(),
  prisma.prediction.deleteMany(),
  prisma.question.deleteMany(),
  prisma.learning.deleteMany(),
  prisma.mission.deleteMany(),
]);
await prisma.$disconnect();

console.log("[1] start mission");
const started = await post("/api/mission/start", {});
console.log("   started:", JSON.stringify({ stage: started.stage, status: started.status, theme: started.theme }));
assert(started.stage === "LEARNING", "mission started");

console.log("[2] submit 3 weak answers");
await post("/api/mission/answer", { missionId: started.missionId, order: 0, answer: "a" });
await post("/api/mission/answer", { missionId: started.missionId, order: 1, answer: "b" });
await post("/api/mission/answer", { missionId: started.missionId, order: 2, answer: "c" });
const afterAns = await get("/api/mission/today");
console.log("   after answers:", afterAns.questions.map((q) => ({ order: q.order, ans: q.answer })));

console.log("[3] submit prediction");
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
await post("/api/mission/prediction", { missionId: started.missionId, content: "需求将上升", confidence: 70, targetDate: tomorrow });

console.log("[4] complete (expect DRILL due to weak answers)");
const afterComplete = await post("/api/mission/complete", { missionId: started.missionId });
console.log("   stage:", afterComplete.stage, "drillQuestions:", afterComplete.drillQuestions?.length);
assert(afterComplete.stage === "DRILL", "entered DRILL due to weak answers");
assert(afterComplete.drillQuestions?.length > 0, "drill questions generated");
assert(afterComplete.questionReviews.length > 0, "questionReviews present");
console.log("   [ref-answer sample] first question correctAnswer:");
const _refAns = afterComplete.questionReviews[0]?.correctAnswer || "";
console.log("   >>>", _refAns.slice(0, 400));
const _cnCount = (_refAns.match(/[\u4e00-\u9fa5]/g) || []).length;
assert(_cnCount >= 20, `reference answer is a concrete paragraph (${_cnCount} chinese chars >= 20)`);
assert(!/(回答时|你可以从|建议先|围绕.*展开|应说明|请说明|需说明)/.test(_refAns), "reference answer is NOT prompt instructions");

console.log("[5] submit wrong drill answer");
const wrongAnswers = afterComplete.drillQuestions.map((q) => ({ questionId: q.id, answer: q.type === "TF" ? (q.correctAnswer === "true" ? "false" : "true") : "X" }));
const afterWrong = await post("/api/mission/drill", { missionId: started.missionId, answers: wrongAnswers });
console.log("   afterWrong drillQuestions:", JSON.stringify(afterWrong.drillQuestions.map((q) => ({ id: q.id, type: q.type, userAnswer: q.userAnswer, isCorrect: q.isCorrect }))));
assert(afterWrong.stage === "DRILL", "still DRILL after wrong answers");
const wrongQ = afterWrong.drillQuestions.find((q) => q.isCorrect === false);
assert(!!wrongQ, "wrong answer flagged");
assert(!!wrongQ.explanation, "explanation shown for wrong answer");

console.log("[6] submit correct drill answers");
const correctAnswers = afterWrong.drillQuestions.map((q) => ({ questionId: q.id, answer: q.correctAnswer }));
const afterCorrect = await post("/api/mission/drill", { missionId: started.missionId, answers: correctAnswers });
assert(afterCorrect.stage === "COMPLETED", "completed after all drill correct");
console.log("ALL PASS");
