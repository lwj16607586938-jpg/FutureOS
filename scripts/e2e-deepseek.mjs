// E2E verification for FutureOS with the real DeepSeek cloud provider.
// Usage: node scripts/e2e-deepseek.mjs   (server must be running on :3000 with AI_PROVIDER=deepseek + DEEPSEEK_API_KEY)
const BASE = process.env.BASE || "http://localhost:3000";

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!json.success) {
    throw new Error(`[${method} ${path}] ${json.error?.code}: ${json.error?.message}`);
  }
  return json.data;
}

function clip(s, n = 320) {
  if (!s) return "(空)";
  s = String(s);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

const log = (...a) => console.log(...a);

async function main() {
  log("=== 1) 今日 Mission (GET /api/mission/today) ===");
  const today = await call("GET", "/api/mission/today");
  log("status:", today.status, "| stage:", today.stage, "| id:", today.id);

  log("\n=== 2) 开始 Mission (POST /api/mission/start) —— 此处调用真实 DeepSeek 生成 ===");
  const started = await call("POST", "/api/mission/start");
  const mid = started.missionId;
  log("theme:", started.theme);
  log("learning.title:", started.learning?.title);
  log("learning.content:", clip(started.learning?.content, 400));
  log("questions:", (started.questions || []).map((q) => `[${q.type}] ${clip(q.content, 120)}`));

  log("\n=== 3) 进入思考 (POST /api/mission/thinking) ===");
  await call("POST", "/api/mission/thinking", { missionId: mid });
  log("ok");

  log("\n=== 4) 作答 3 题 (POST /api/mission/answer ×3) ===");
  const sample = {
    EXPLAIN: "我用类比的方式理解：它像……",
    REASON: "核心逻辑链条是……",
    CONNECT: "它和已学的 HBM/数据中心有因果关联……",
  };
  for (let i = 0; i < (started.questions || []).length; i++) {
    const q = started.questions[i];
    const ans = sample[q.type] || `关于「${q.content}」我的理解是……`;
    await call("POST", "/api/mission/answer", { missionId: mid, order: i, answer: ans });
    log(`  Q${i} [${q.type}] 已答`);
  }

  log("\n=== 5) 提交预测 (POST /api/mission/prediction) ===");
  const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const pred = await call("POST", "/api/mission/prediction", {
    missionId: mid,
    content: `30 天后，我对「${started.theme}」的理解将能独立用于解释相关工程决策。`,
    confidence: 70,
    targetDate: future,
    tag: "self",
  });
  log("prediction id:", pred.id, "| status:", pred.status);

  log("\n=== 6) 完成 Mission (POST /api/mission/complete) —— 此处调用真实 DeepSeek 生成复盘 ===");
  const done = await call("POST", "/api/mission/complete", { missionId: mid });
  log("status:", done.status, "| stage:", done.stage);
  const r = done.review || {};
  log("review.summary:", clip(r.summary, 400));
  log("review.strength:", r.strength);
  log("review.weakness:", r.weakness);
  log("review.suggestion:", r.suggestion);

  log("\n=== 7) 三页面/接口可用性 ===");
  const growth = await call("GET", "/api/growth");
  log("growth: cgs =", growth.cgs, "| missionCount =", growth.missionCount, "| currentStreak =", growth.currentStreak);
  const world = await call("GET", "/api/world");
  log("world: nodes =", world.nodes?.length, "| edges =", world.edges?.length);
  const preds = await call("GET", "/api/predictions");
  log("predictions: total =", preds.total ?? preds.items?.length);

  log("\n✅ 真实 DeepSeek 闭环验证完成。如上面 theme/learning/review 为自然语义化文本（非固定模板），即证明走的是 DeepSeek。");
}

main().catch((e) => {
  console.error("❌ E2E 失败:", e.message);
  process.exit(1);
});
