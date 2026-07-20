// Focused E2E: hybrid streaming loop (flash generation, pro review) + auto-verify.
const BASE = "http://localhost:3000";
const USER = "e2e-hybrid-" + Date.now();
const DATE = "2026-07-16";

function parseSSE(body, onDelta, onDone, onError) {
  // body: string accumulator of SSE text. We process line-by-line.
  return null;
}

// Minimal SSE reader over fetch Response body.
async function readSSE(res, onDelta) {
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
        if (evt.delta !== undefined) onDelta(evt.delta);
        else if (evt.missionId !== undefined) donePayload = evt;
        else if (evt.error !== undefined) throw new Error(evt.error);
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
  return readSSE(res, onDelta);
}

(async () => {
  console.log("USER =", USER);

  // 1) STREAMING START (flash model: deepseek-v4-flash)
  console.log("\n[1] POST /api/mission/start/stream  (flash generation)");
  const t0 = Date.now();
  let startDeltas = 0;
  let startHead = "";
  const startDone = await streamPost(
    "/api/mission/start/stream",
    { userId: USER, date: DATE },
    (d) => {
      startDeltas++;
      if (startHead.length < 120) startHead += d;
    }
  );
  const startMs = Date.now() - t0;
  console.log(`    deltas=${startDeltas}  ms=${startMs}  missionId=${startDone?.missionId}`);
  console.log("    head:", JSON.stringify(startHead.slice(0, 120)));

  const missionId = startDone.missionId;

  // 2) Answer 3 questions
  console.log("\n[2] POST /api/mission/answer x3");
  for (let order = 0; order < 3; order++) {
    const r = await postJSON("/api/mission/answer", {
      missionId,
      order,
      answer: `E2E 测试答案 ${order}：我认为这个概念的关键在于把抽象原则落到可执行的日常动作里。`,
    });
    console.log(`    order ${order} -> status ${r?.status ?? "?"}`);
  }

  // 3) Submit prediction (target in the future)
  console.log("\n[3] POST /api/mission/prediction");
  const target = new Date(Date.now() + 5 * 86400000).toISOString();
  const pred = await postJSON("/api/mission/prediction", {
    missionId,
    content: "E2E：我预测未来一周内会主动用这个概念复盘一次真实工作决策。",
    confidence: 70,
    targetDate: target,
  });
  console.log("    prediction id:", pred?.id, "status:", pred?.status);

  // 4) STREAMING COMPLETE (pro model: deepseek-v4-pro)
  console.log("\n[4] POST /api/mission/complete/stream  (pro review)");
  const t1 = Date.now();
  let revDeltas = 0;
  let revHead = "";
  const compDone = await streamPost(
    "/api/mission/complete/stream",
    { missionId },
    (d) => {
      revDeltas++;
      if (revHead.length < 120) revHead += d;
    }
  );
  const compMs = Date.now() - t1;
  console.log(`    deltas=${revDeltas}  ms=${compMs}  missionId=${compDone?.id ?? missionId}`);
  console.log("    head:", JSON.stringify(revHead.slice(0, 120)));

  // 5) Auto-verify (should find no due predictions for fresh user, but must run)
  console.log("\n[5] POST /api/predictions/auto-verify");
  const av = await postJSON("/api/predictions/auto-verify", { userId: USER });
  console.log("    result:", JSON.stringify(av));

  console.log("\n=== SUMMARY ===");
  console.log(`start(flash): ${startMs}ms / ${startDeltas} deltas`);
  console.log(`complete(pro): ${compMs}ms / ${revDeltas} deltas`);
  console.log(`flash faster than pro? ${startMs < compMs ? "YES (expected)" : "no"}`);
})().catch((e) => {
  console.error("E2E FAILED:", e.message);
  process.exit(1);
});
