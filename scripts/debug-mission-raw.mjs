import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve("D:/space_workbuddy/2026-07-16-14-26-16/futureos/.env");
const env = fs.readFileSync(envPath, "utf8");
const get = (k) => { const m = env.match(new RegExp(`^${k}="([^"]*)"`, "m")); return m ? m[1] : ""; };
const key = get("DEEPSEEK_API_KEY");
const model = get("DEEPSEEK_MODEL") || "deepseek-chat";
const base = get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com/v1";

const SYSTEM_INSTRUCTION = `你是 FutureOS 的认知训练教练。FutureOS 是一款 AI 驱动的认知操作系统，目标是训练用户的六项能力：观察(Observe)、理解(Understand)、连接(Connect)、推理(Reason)、预测(Predict)、修正(Update)。你只输出结构化 JSON，绝不输出自由文本、解释或 markdown 代码块围栏。所有字段必须存在。`;

const concept = {
  title: "GPU",
  category: "Technology",
  difficulty: 3,
  description: "图形处理器（GPU）是一种擅长大规模并行计算的处理器。\n\n与 CPU 顺序处理不同，GPU 拥有数千个核心，能同时执行大量简单运算。这一特性使它成为深度学习训练与推理的核心硬件，也是现代 AI 算力的基石。",
};
const ability = { observe: 50, understand: 50, connect: 50, reason: 50, predict: 50, update: 50 };
const recentThemes = [];

const prompt = [
  `【System】${SYSTEM_INSTRUCTION}`,
  `【Task】为上述概念生成一次每日 Mission。要求：主题唯一（即该概念标题）；Learning 为一段 5-10 分钟可读的 Markdown 资料（可直接使用概念资料，必要时补充一句引导）；Thinking 固定 3 题，依次为 EXPLAIN（考理解）、REASON（考推理）、CONNECT（考连接）。`,
  `【Mission】本次概念：标题「${concept.title}」；分类=${concept.category ?? "未分类"}；难度=${concept.difficulty}/5。\n概念资料（Markdown）：\n${concept.description}`,
  `【Ability】用户当前能力画像：observe=${ability.observe} understand=${ability.understand} connect=${ability.connect} reason=${ability.reason} predict=${ability.predict} update=${ability.update}（0-100）。`,
  `【History】${recentThemes.length ? `用户近期学习过的主题（用于保持连续性与对比）：${recentThemes.slice(0, 6).join("、")}。` : `用户处于较早学习阶段，尚无近期主题历史。`}`,
  `【Output】严格返回 JSON，格式：{"theme":"","learning":{"title":"","content":"","estimatedMinutes":8},"questions":[{"type":"EXPLAIN","content":""},{"type":"REASON","content":""},{"type":"CONNECT","content":""}]}`,
].join("\n\n");

const res = await fetch(`${base}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model,
    messages: [
      { role: "system", content: SYSTEM_INSTRUCTION },
      { role: "user", content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 1200,
  }),
});
const j = await res.json();
const raw = j.choices?.[0]?.message?.content ?? "";
console.log("=== RAW DeepSeek 输出 ===");
console.log(raw);
console.log("\n=== 尝试解析 ===");
try {
  const o = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  console.log("theme:", o.theme);
  console.log("learning.title:", o.learning?.title);
  console.log("questions:", JSON.stringify(o.questions, null, 2));
} catch (e) {
  console.log("解析失败:", e.message);
}
