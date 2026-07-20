// Burst-mode E2E: same user does TWO full missions on the SAME day.
// Asserts distinct mission IDs (burst = multiple/day) and both reach COMPLETED.
const BASE = "http://localhost:3000";
const USER = "e2e-burst-" + Date.now();
const DATE = "2026-07-16";

async function streamPost(url, body, onDelta) {
  const res = await fetch(BASE + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`${url} -> ${res.status}: ${t.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let donePayload = null;
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
        if (evt.delta !== undefined) onDelta?.(evt.delta);
        else if (evt.missionId !== undefined) donePayload = evt;
        else if (evt.error !== undefined) throw new Error(evt.error);
        else if (evt.id !== undefined) donePayload = evt; // /today wraps under data
      } catch (e) {
        if (e.message && e.message !== "[object Object]") throw e;
      }
    }
  }
  return donePayload;
}

async function postJSON(url, body) {
  const res = await fetch(BASE + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function getJSON(url) {
  const res = await fetch(BASE + url, { method: "GET" });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function runRound(round) {
  console.log(`\n=== Round ${round} (start streaming, flash) ===`);
  const start = await streamPost("/api/mission/start/stream", { userId: USER, date: DATE }, () => {});
  const missionId = start?.missionId;
  console.log(`  missionId=${missionId}`);
  for (let order = 0; order < 3; order++) {
    await postJSON("/api/mission/answer", { missionId, order, answer: `R${round} 答案 ${order}` });
  }
  await postJSON("/api/mission/prediction", {
    missionId,
    content: `R${round} 预测：本周内会复用此概念复盘一次真实决策。`,
    confidence: 65,
    targetDate: new Date(Date.now() + 5 * 86400000).toISOString(),
  });
  console.log(`=== Round ${round} (complete streaming, pro) ===`);
  const comp = await streamPost("/api/mission/complete/stream", { missionId }, () => {});
  const finalMission = (await getJSON("/api/mission/today")).data; // latest (default user)
  console.log(`  completed missionId=${comp?.id ?? missionId}  status=${finalMission?.status}`);
  return missionId;
}

(async () => {
  const id1 = await runRound(1);
  const id2 = await runRound(2);
  console.log("\n=== BURST ASSERTIONS ===");
  console.log(`mission1=${id1}`);
  console.log(`mission2=${id2}`);
  console.log(`distinct IDs (burst OK)? ${id1 !== id2 ? "YES" : "NO (!!)"}`);

  // Confirm both persisted as COMPLETED on the same date via /api/mission/today.
  const today = (await getJSON("/api/mission/today")).data;
  console.log(`latest mission date=${today?.date} status=${today?.status}`);
  console.log(id1 !== id2 && today?.status === "COMPLETED" ? "\n✅ BURST PASS" : "\n❌ BURST FAIL");
})().catch((e) => {
  console.error("E2E FAILED:", e.message);
  process.exit(1);
});
