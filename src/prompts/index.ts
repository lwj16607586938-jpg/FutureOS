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
    `【Task】为上述概念生成一次每日 Mission。要求：主题唯一（即该概念标题）；Learning 为一段 5-10 分钟可读的 Markdown 资料（可直接使用概念资料，必要时补充一句引导）；Thinking 固定 3 题，依次为 EXPLAIN（考理解）、REASON（考推理）、CONNECT（考连接）。`,
    `【Mission】${knowledgeLine(ctx)}`,
    `【Ability】${abilityLine(ctx)}`,
    `【History】${historyLine(ctx)}`,
    `【Output】严格返回 JSON，格式：{"theme":"","learning":{"title":"","content":"","estimatedMinutes":8},"questions":[{"type":"EXPLAIN","content":""},{"type":"REASON","content":""},{"type":"CONNECT","content":""}]}`,
  ].join("\n\n");
}

export function buildReviewPrompt(ctx: AIContext): string {
  const m = ctx.mission;
  const answers = (m?.answers ?? [])
    .map((a, i) => `Q${i + 1}[${a.type}] ${a.question}\n答案：${a.answer || "（未作答）"}`)
    .join("\n");
  const pred = m?.prediction
    ? `用户预测：${m.prediction.content}（置信度 ${m.prediction.confidence}%，目标日期 ${m.prediction.targetDate}）`
    : "用户未提交预测。";
  return [
    `【System】${SYSTEM_INSTRUCTION}`,
    `【Task】基于本次 Mission 的用户作答与预测，生成复盘 Review。summary 一句话总评；strength/weakness/suggestion 各 2-3 条字符串数组（中文、可操作）。`,
    `【Mission】主题「${m?.theme ?? ctx.concept.title}」。\n${answers}\n${pred}`,
    `【Ability】${abilityLine(ctx)}`,
    `【Output】严格返回 JSON，格式：{"summary":"","strength":[],"weakness":[],"suggestion":[]}`,
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
