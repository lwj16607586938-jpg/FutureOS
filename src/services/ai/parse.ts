import type {
  MissionAIOutput,
  ReviewAIOutput,
  PredictionAssistanceOutput,
  QuestionReviewItem,
} from "@/lib/types";
import type { VerificationOutput } from "./types";

// Shared JSON extraction + light validation/clamping for AI provider outputs.
// Extracted so both OpenAI and WorkBuddy (local) providers can reuse identical
// parsing — one source of truth, no drift (doc 11 §10).

export function firstJson(raw: string): string {
  const start = raw.indexOf("{");
  const arrStart = raw.indexOf("[");
  if (start === -1 && arrStart === -1) return raw.trim();
  if (arrStart !== -1 && (start === -1 || arrStart < start)) {
    const end = raw.lastIndexOf("]");
    return raw.slice(arrStart, end + 1);
  }
  const end = raw.lastIndexOf("}");
  return raw.slice(start, end + 1);
}

export function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
}

// Question types, in canonical order (doc 11 §8). The prompt asks for exactly
// EXPLAIN → REASON → CONNECT; we honor the model's returned type when valid,
// otherwise fall back to the positional default.
const QUESTION_TYPES = ["EXPLAIN", "REASON", "CONNECT"] as const;

// Safety-net questions: used only when the model omits a question's content,
// so the UI never shows a blank prompt. Coherent per type + theme.
const FALLBACK_QUESTION: Record<
  (typeof QUESTION_TYPES)[number],
  (theme: string) => string
> = {
  EXPLAIN: (t) => `请用你自己的话解释「${t}」的核心概念与基本原理。`,
  REASON: (t) => `为什么「${t}」在它所涉及的场景中如此关键？请说出你的推理过程。`,
  CONNECT: (t) => `「${t}」与你已掌握的其他概念或日常经验有哪些联系？请举例说明。`,
};

// A question may arrive as an object under various keys, or even as a bare string.
function extractQuestionContent(q: any): string {
  if (!q) return "";
  if (typeof q === "string") return q.trim();
  return String(q.content ?? q.question ?? q.text ?? q.prompt ?? "").trim();
}

export function parseMission(raw: string): MissionAIOutput {
  const o = JSON.parse(firstJson(raw));
  const theme = String(o.theme ?? "");
  const questions = Array.isArray(o.questions)
    ? o.questions.slice(0, 3).map((q: any, i: number) => {
        const type = (QUESTION_TYPES as readonly string[]).includes(q?.type)
          ? (q.type as (typeof QUESTION_TYPES)[number])
          : QUESTION_TYPES[i];
        const content = extractQuestionContent(q) || FALLBACK_QUESTION[type](theme);
        return { type, content };
      })
    : [];
  return {
    theme,
    learning: {
      title: String(o.learning?.title ?? o.theme ?? ""),
      content: String(o.learning?.content ?? ""),
      estimatedMinutes: Math.min(Math.max(Number(o.learning?.estimatedMinutes) || 8, 5), 10),
    },
    questions,
  };
}

export function parseReview(raw: string): ReviewAIOutput {
  const o = JSON.parse(firstJson(raw));
  const questionReviews: QuestionReviewItem[] = Array.isArray(o.questionReviews)
    ? o.questionReviews.slice(0, 3).map((q: any) => ({
        order: Number(q?.order) || 0,
        type: (["EXPLAIN", "REASON", "CONNECT"].includes(q?.type) ? q.type : "EXPLAIN") as QuestionReviewItem["type"],
        question: String(q?.question ?? ""),
        userAnswer: q?.userAnswer != null ? String(q.userAnswer) : null,
        verdict: (["correct", "partial", "wrong"].includes(q?.verdict) ? q.verdict : "wrong") as QuestionReviewItem["verdict"],
        diagnosis: String(q?.diagnosis ?? ""),
        correctAnswer: String(q?.correctAnswer ?? ""),
        explanation: String(q?.explanation ?? ""),
      }))
    : [];
  return {
    summary: String(o.summary ?? ""),
    strength: asStringArray(o.strength),
    weakness: asStringArray(o.weakness),
    suggestion: asStringArray(o.suggestion),
    questionReviews,
  };
}

export function parseAssistance(raw: string): PredictionAssistanceOutput {
  const o = JSON.parse(firstJson(raw));
  return {
    historyNotes: asStringArray(o.historyNotes),
    riskHints: asStringArray(o.riskHints),
  };
}

export function parseStringArray(raw: string): string[] {
  const v = JSON.parse(firstJson(raw));
  return Array.isArray(v) ? v.map(String) : asStringArray(v);
}

// Verification verdict for due predictions. Returns null on any parse problem so
// the caller can safely SKIP (leave PENDING) instead of auto-verifying wrongly.
export function parseVerify(raw: string): VerificationOutput | null {
  try {
    const o = JSON.parse(firstJson(raw));
    const outcome = o.outcome === "FAILED" ? "FAILED" : "VERIFIED";
    const reason = String(o.reason ?? "").trim();
    if (!reason) return null; // require a stated basis
    return { outcome, reason };
  } catch {
    return null;
  }
}
