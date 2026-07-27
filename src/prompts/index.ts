import type { AIContext } from "@/services/ai/types";
import { PROMPT_VERSION } from "@/lib/constants";

// Context Engine prompt templates (doc 11 §8). All output is strict JSON (doc 11 §10).
// Versioned per doc 11 §9. Never build prompts outside this module.

const SYSTEM_INSTRUCTION = `你是 FutureOS 的认知训练教练。FutureOS 是一款 AI 驱动的认知操作系统，
目标是训练用户的六项能力：观察(Observe)、理解(Understand)、连接(Connect)、推理(Reason)、预测(Predict)、修正(Update)。
你只输出结构化 JSON，绝不输出自由文本、解释或 markdown 代码块围栏。所有字段必须存在。`;

function abilityLine(ctx: AIContext): string {
  const a = ctx.ability;
  return `用户当前能力画像：observe=${a.observe} understand=${a.understand} connect=${a.connect} reason=${a.reason} predict=${a.predict} update=${a.update}（0-100）。`;
}

function knowledgeLine(ctx: AIContext): string {
  const c = ctx.concept;
  return `本次概念：标题「${c.title}」；分类=${c.category ?? "未分类"}；难度=${c.difficulty}/5。\n概念资料（Markdown）：\n${c.description}`;
}

function historyLine(ctx: AIContext): string {
  const r = ctx.recentThemes.filter(Boolean);
  return r.length
    ? `用户近期学习过的主题（用于保持连续性与对比）：${r.slice(0, 6).join("、")}。`
    : `用户处于较早学习阶段，尚无近期主题历史。`;
}

export function buildMissionPrompt(ctx: AIContext): string {
  return [
    `【System】${SYSTEM_INSTRUCTION}`,
    `【Task】为上述概念生成一次每日 Mission。要求：主题唯一（即该概念标题）；Learning 为一段 5-10 分钟可读资料；Thinking 固定 3 题，依次为 EXPLAIN（考理解）、REASON（考推理）、CONNECT（考连接）。`,
    `【排版要求 · 重点】learning.content 必须是排版清晰的 Markdown 正文（直接放在 JSON 字符串里，不要用 \`\`\` 代码围栏）：`,
    `  - 用 2-4 个 \`## 小标题\` 划分层次（如「定义」「为什么重要」「关键机制」「与你的关联」）；`,
    `  - 核心概念、术语、关键数字用 \`**加粗**\` 标注；`,
    `  - 并列要点用 \`- \` 无序列表；`,
    `  - 段落之间保留空行，行距清晰，避免大段密排文字；`,
    `  - 不出现 \`\`\` 围栏、不出现「详见上文」之类的回指。`,
    `【Mission】${knowledgeLine(ctx)}`,
    `【Ability】${abilityLine(ctx)}`,
    `【History】${historyLine(ctx)}`,
    `【Output】严格返回 JSON，格式：{"theme":"","learning":{"title":"","content":"","estimatedMinutes":8},"questions":[{"type":"EXPLAIN","content":""},{"type":"REASON","content":""},{"type":"CONNECT","content":""}]}`,
  ].join("\n\n");
}

export function buildReviewPrompt(ctx: AIContext): string {
  const m = ctx.mission;
  const answers = (m?.answers ?? [])
    .map((a, i) => `Q${i + 1}[${a.type}] ${a.question}\n用户答案：${a.answer || "（未作答）"}`)
    .join("\n");
  const pred = m?.prediction
    ? `用户预测：${m.prediction.content}（置信度 ${m.prediction.confidence}%，目标日期 ${m.prediction.targetDate}）`
    : "用户未提交预测。";
  return [
    `【System】${SYSTEM_INSTRUCTION}`,
    `【Task】基于本次 Mission 的用户作答，生成复盘 Review。summary 一句总评；strength/weakness/suggestion 各 2-3 条（中文、可操作）。`,
    `【逐题讲评 · 硬性要求】必须输出 questionReviews 数组，共 ${Math.max((m?.answers ?? []).length, 3)} 项，每一项对应下面【Mission】中的一道题（按 order 与 Q1/Q2/Q3 一一对应）：`,
    `  - order：题号（从 1 开始，与【Mission】中 Q1/Q2/Q3 对应）；question：原样抄录该题的问题文本；userAnswer：原样抄录用户答案；`,
    `  - verdict：correct（答到要点）/ partial（方向对但不完整或有小错）/ wrong（明显错误或空白）；`,
    `  - diagnosis（错在哪里）：若 verdict≠correct，必须直接引用用户答案中的具体错误原话并指出错处；严禁使用「答得不错」「有待加强」等模糊措辞；若 correct 则为空字符串；`,
    `  - correctAnswer（参考答案）：【必须直接回答该题所问的具体问题】写一段完整、具体、可独立理解的标准答案，包含必要的概念、机制与例子。严禁写成答题模板或方法论——绝对禁止出现「回答时应…」「你可以从…」「建议先…」「围绕…展开」这类引导语，也禁止用「结合/参考/见上文」等回指。`,
    `  - explanation（讲解）：直接给出完整解析，自成一体、可直接理解；严禁出现「回看材料」「见上文」「结合阅读」「请参考前面」等回指，也不得要求用户自行查阅。`,
    `【正面示例】correctAnswer 应类似：「GPT 的预训练是在大规模无标注文本上，用自回归/掩码语言建模目标让模型学习通用语言与世界的统计规律；它决定了模型后续微调能力的上限，算力与数据规模直接决定模型质量。」——而绝对不能是「应先说明它的定义，再讲训练目标，最后用例子验证」这种答题说明。`,
    `【Mission】主题「${m?.theme ?? ctx.concept.title}」。\n${answers}\n${pred}`,
    `【Ability】${abilityLine(ctx)}`,
    `【Output】严格返回 JSON，格式：{"summary":"","strength":[],"weakness":[],"suggestion":[],"questionReviews":[{"order":1,"type":"EXPLAIN","question":"","userAnswer":"","verdict":"correct","diagnosis":"","correctAnswer":"","explanation":""}]}`,
  ].join("\n\n");
}

export function buildPredictionAssistancePrompt(ctx: AIContext): string {
  return [
    `【System】${SYSTEM_INSTRUCTION} 你只做预测辅助，绝不替用户写预测内容。`,
    `【Task】返回历史梳理与风险提示，帮助用户自己写出更好的预测。historyNotes 整理相关背景；riskHints 给出预测质量的提醒。`,
    `【Mission】${knowledgeLine(ctx)}`,
    `【History】${historyLine(ctx)}`,
    `【Output】严格返回 JSON，格式：{"historyNotes":[],"riskHints":[]}`,
  ].join("\n\n");
}

export function buildDrillPrompt(ctx: AIContext): string {
  const m = ctx.mission;
  const weakItems = (m?.questionReviews ?? [])
    .filter((q) => q.verdict !== "correct")
    .map((q) => `Q${q.order}[${q.type}] ${q.question}\n用户答案：${q.userAnswer || "（未作答）"}\n错因：${q.diagnosis || "不完整/有偏差"}\n原题讲解：${q.explanation}`)
    .join("\n\n");
  return [
    `【System】${SYSTEM_INSTRUCTION}`,
    `【Task】用户在本次 Mission 的 3 道思考题中有错误/遗漏，需要生成 2-4 道追问题目帮助其吃透概念。题目必须是「选择题（MCQ）」或「判断题（TF）」，每道题只考察一个薄弱点。`,
    `【要求】`,
    `  - 每道题都要给出明确答案（MCQ 用选项字母/标签如 "A" / "B" / "C" / "D"；TF 用 "true" 或 "false"）；`,
    `  - 每个选项/判断都要附带 explanation，说明为什么对、为什么错；`,
    `  - 干扰项要贴近用户真实错误，有针对性；`,
    `  - 题目难度循序渐进，先补基础概念，再补推理应用。`,
    `【薄弱点】\n${weakItems || "用户在本次思考题中存在理解或推理偏差。"}`,
    `【概念资料】${knowledgeLine(ctx)}`,
    `【Ability】${abilityLine(ctx)}`,
    `【Output】严格返回 JSON，格式：{"questions":[{"id":"dq-1","type":"MCQ","question":"","options":["A. ...","B. ...","C. ...","D. ..."],"correctAnswer":"A","explanation":""},{"id":"dq-2","type":"TF","question":"","correctAnswer":"true","explanation":""}]}`,
  ].join("\n\n");
}

export function buildSuggestionPrompt(ctx: AIContext): string {
  return [
    `【System】${SYSTEM_INSTRUCTION}`,
    `【Task】基于本次主题，返回 2 条下一步学习建议（字符串数组）。`,
    `【Mission】${knowledgeLine(ctx)}`,
    `【Output】严格返回 JSON 数组字符串：["",""]`,
  ].join("\n\n");
}

export function buildPredictionVerifyPrompt(ctx: AIContext): string {
  const p = ctx.prediction;
  return [
    `【System】${SYSTEM_INSTRUCTION} 你现在是公正的验证官，只依据用户给出的信息做合理推断，绝不编造事实。`,
    `【Task】用户曾对某主题做出一项预测，现到达验证日期。请判断该预测应判为 VERIFIED（方向或结论基本成立）还是 FAILED（明显落空）。只依据预测内容、置信度与日期做推断；若信息不足以判断，仍须给出最可能的结果并说明依据。`,
    `【Prediction】预测内容：${p?.content ?? ""}；置信度 ${p?.confidence ?? "?"}%；目标验证日期 ${p?.targetDate ?? ""}；当前日期 ${p?.today ?? ""}。`,
    `【Output】严格返回 JSON：{"outcome":"VERIFIED"|"FAILED","reason":"一句话判定依据"}`,
  ].join("\n\n");
}

export { PROMPT_VERSION };
