// verify-preserve.mjs — proves the "完整保留" feature end-to-end against a running
// (mock) server at http://localhost:3000:
//   1) completing a mission appends a JSONL growth record with answers + prediction
//   2) /api/mission/archive returns every mission (incl. earlier tiers)
//   3) /api/mission/export returns the full JSON
//   4) reset-concepts-only.mjs does NOT delete user learning data
import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const DEMO_ANSWER = "这是一条用于验证的回答/思考内容，确认用户产出的文本被完整保留。";

function readBody(res) {
  return res.json().then((j) => {
    if (!j.success) throw new Error(j.error?.message ?? "请求失败");
    return j.data;
  });
}
async function apiGet(url) {
  const r = await fetch(BASE + url);
  return readBody(r);
}
async function apiSend(url, body) {
  const r = await fetch(BASE + url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return readBody(r);
}
async function streamPost(url, body) {
  const r = await fetch(BASE + url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok || !r.body) throw new Error(`stream 失败 (${r.status})`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const evt = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let name = "message",
        data = "";
      for (const line of evt.split("\n")) {
        if (line.startsWith("event:")) name = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (name === "done") return;
      if (name === "error") throw new Error(JSON.parse(data || "{}").message || "stream 出错");
    }
  }
}

const future = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
let pass = 0,
  fail = 0;
function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

async function completeOne(needPredictionFirst) {
  await streamPost("/api/mission/start/stream", {});
  const m = await apiGet("/api/mission/today");
  for (const q of m.questions) await apiSend("/api/mission/answer", { missionId: m.missionId, order: q.order, answer: DEMO_ANSWER });
  const isFinal = (m.tier ?? 1) >= (m.tierCount ?? 1);
  if (isFinal || needPredictionFirst) {
    await apiSend("/api/mission/prediction", {
      missionId: m.missionId,
      content: "验证用预测：未来一周该主题热度上升。",
      confidence: 70,
      targetDate: future,
    });
  }
  try {
    await streamPost("/api/mission/complete/stream", { missionId: m.missionId });
  } catch (e) {
    if (String(e.message).includes("需先提交预测")) {
      await apiSend("/api/mission/prediction", {
        missionId: m.missionId,
        content: "验证用预测（补交）：未来一周该主题热度上升。",
        confidence: 70,
        targetDate: future,
      });
      await streamPost("/api/mission/complete/stream", { missionId: m.missionId });
    } else throw e;
  }
  return m.missionId;
}

console.log("[verify] 1) 完成 3 个 mission（含预测路径）…");
const ids = [];
ids.push(await completeOne(false));
ids.push(await completeOne(false));
ids.push(await completeOne(true));

console.log("[verify] 2) JSONL 成长记录…");
const logPath = "data/learning-log.jsonl";
check("learning-log.jsonl 存在", existsSync(logPath));
const lines = existsSync(logPath) ? readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean) : [];
const logIds = lines.map((l) => JSON.parse(l).missionId);
for (const id of ids) {
  const entry = lines.map((l) => JSON.parse(l)).find((e) => e.missionId === id);
  check(`JSONL 含 mission ${id}`, !!entry);
  check(`  └ 含回答文本`, !!entry && entry.questions?.some((q) => q.answer && q.answer.includes("完整保留")));
  check(`  └ 含预测(若提交)`, !!entry && (entry.prediction == null || typeof entry.prediction.content === "string"));
}

console.log("[verify] 3) /api/mission/archive 返回全部 mission…");
const archive = await apiGet("/api/mission/archive");
for (const id of ids) check(`archive 含 mission ${id}`, archive.missions.some((x) => x.missionId === id));
check("archive 数量 >= 完成数", archive.missions.length >= ids.length, `(got ${archive.missions.length})`);

console.log("[verify] 4) /api/mission/export 返回完整 JSON…");
const exp = await apiGet("/api/mission/export");
check("export.app === FutureOS", exp.app === "FutureOS");
for (const id of ids) check(`export 含 mission ${id}`, exp.missions.some((x) => x.missionId === id));

console.log("[verify] 5) reset-concepts-only 不删用户数据…");
const before = (await apiGet("/api/mission/archive")).missions.length;
execSync("node scripts/reset-concepts-only.mjs", { stdio: "inherit" });
const after = (await apiGet("/api/mission/archive")).missions.length;
check("reset 后 mission 数不变", after === before, `(before=${before}, after=${after})`);
for (const id of ids) check(`reset 后仍含 mission ${id}`, (await apiGet("/api/mission/archive")).missions.some((x) => x.missionId === id));

console.log(`\n[verify] 结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
