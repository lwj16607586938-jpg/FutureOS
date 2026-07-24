// Validates req2 (prediction gating per tier) + req3/req4 (questionReviews)
// by walking ONE node through all its tiers (also exercises req6 same-theme).
// Self-contained: flushes in-progress missions for the default user first.
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";
const DATE = "2026-07-24";
const prisma = new PrismaClient();

async function postJSON(url, body) {
  const res = await fetch(BASE + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}
async function getJSON(url, params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(BASE + url + "?" + qs, { method: "GET" });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}
async function streamPost(url, body) {
  const res = await fetch(BASE + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`${url} -> ${res.status}: ${t.slice(0, 400)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", missionId = null, error = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      try {
        const evt = JSON.parse(data);
        if (evt.missionId !== undefined) missionId = evt.missionId;
        // route emits `event: error data: {message: ...}`
        if (evt.error !== undefined) error = evt.error;
        if (evt.message !== undefined) error = evt.message;
      } catch {}
    }
  }
  return { missionId, error };
}

const log = (...a) => console.log(...a);
const ok = (b) => (b ? "PASS" : "FAIL ❌");
const weak = [
  "需求就是大家想要买东西吧。",
  "我觉得需求多的时候生意就好，具体机制说不清。",
  "需求和其他概念好像有关系但不太确定。",
];

await prisma.mission.deleteMany({ where: { status: { not: "COMPLETED" } } });
log("[cleanup] fresh slate");

let validatedFinalBlock = false;
let finalQuestionReviews = null;
let lastTheme = null;

for (let iter = 1; iter <= 6; iter++) {
  const { missionId } = await streamPost("/api/mission/start/stream", {});
  const started = (await getJSON("/api/mission/today", { date: DATE }))?.data;
  const { tier, tierCount, theme } = started;
  lastTheme = theme;
  log(`\n--- iter ${iter}: theme=${theme} tier=${tier}/${tierCount} (${tier >= tierCount ? "FINAL" : "non-final"}) ---`);

  for (let i = 0; i < 3; i++) {
    await postJSON("/api/mission/answer", { missionId, order: i, answer: weak[i] });
  }

  const r = await streamPost("/api/mission/complete/stream", { missionId });
  if (tier >= tierCount) {
    // final tier: prediction REQUIRED
    const blocked = !!r.error;
    log(`[req2 FINAL] no-prediction blocked? ${ok(blocked)}  (error="${r.error}")`);
    if (!blocked) log("   ⚠️ BUG: final tier must require prediction!");
    // now complete WITH prediction
    await postJSON("/api/mission/prediction", {
      missionId, content: "相关需求未来会持续增长", confidence: 70, targetDate: "2026-12-31",
    });
    const r2 = await streamPost("/api/mission/complete/stream", { missionId });
    log(`[req2 FINAL] with-prediction completes? ${ok(!r2.error)}  (missionId=${r2.missionId})`);
    const view = (await getJSON("/api/mission/today", { date: DATE }))?.data;
    finalQuestionReviews = view?.questionReviews || [];
    validatedFinalBlock = true;
    break;
  } else {
    // non-final tier: prediction NOT required
    log(`[req2 non-final] no-prediction allowed? ${ok(!r.error)}  (missionId=${r.missionId})`);
    if (r.error) log("   ⚠️ BUG: non-final tier should NOT require prediction!");
  }
}

// req3/req4 on the final (completed) mission's questionReviews
log(`\n=== req3/req4 (theme=${lastTheme}) ===`);
const qr = finalQuestionReviews || [];
log(`questionReviews count = ${qr.length}  (${ok(qr.length > 0)})`);
if (qr.length) {
  const wrong = qr.filter((q) => q.verdict === "wrong" || q.verdict === "partial");
  log(`verdicts: ${qr.map((q) => q.verdict).join(", ")}  (wrong/partial = ${wrong.length})`);
  const allFields = qr.every((q) =>
    ["order","type","question","userAnswer","verdict","diagnosis","correctAnswer","explanation"].every((k) => k in q)
  );
  log(`all 8 fields present? ${ok(allFields)}`);
  const selfContainedAll = qr.every(
    (q) => (q.explanation || "").length > 8 && !/回看材料|见上文|结合阅读|查看材料/.test(q.explanation + " " + (q.correctAnswer || ""))
  );
  log(`[req4] all explanations self-contained? ${ok(selfContainedAll)}`);
  const wrongHaveDiag = wrong.length === 0 || wrong.every((q) => (q.diagnosis || "").trim() && (q.correctAnswer || "").trim());
  log(`[req3] wrong/partial items have diagnosis+correctAnswer? ${ok(wrongHaveDiag)}`);
}

await prisma.$disconnect();
log(`\n=== DONE (final-tier gating validated: ${validatedFinalBlock}) ===`);
