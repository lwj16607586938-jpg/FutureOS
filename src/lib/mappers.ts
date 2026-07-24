import type { Mission, Prediction, Review, Ability } from "@prisma/client";
import type {
  MissionView,
  PredictionView,
  ReviewView,
  AbilityScores,
  QuestionView,
  QuestionReviewItem,
} from "./types";

function parseList(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return json ? [json] : [];
  }
}

function parseQuestionReviews(review: Review | null | undefined): QuestionReviewItem[] {
  const raw = review?.questionReviews as unknown;
  if (raw == null) return [];
  let arr: any[] = [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      arr = [];
    }
  } else if (Array.isArray(raw)) {
    arr = raw as any[];
  }
  return arr.slice(0, 3).map((q: any) => ({
    order: Number(q?.order) || 0,
    type: (["EXPLAIN", "REASON", "CONNECT"].includes(q?.type) ? q.type : "EXPLAIN") as QuestionReviewItem["type"],
    question: String(q?.question ?? ""),
    userAnswer: q?.userAnswer != null ? String(q.userAnswer) : null,
    verdict: (["correct", "partial", "wrong"].includes(q?.verdict) ? q.verdict : "wrong") as QuestionReviewItem["verdict"],
    diagnosis: String(q?.diagnosis ?? ""),
    correctAnswer: String(q?.correctAnswer ?? ""),
    explanation: String(q?.explanation ?? ""),
  }));
}

export function toQuestionViews(mission: Mission & { questions?: { order: number; type: string; content: string; answer: string | null }[] }): QuestionView[] {
  return (mission.questions ?? []).map((q) => ({
    order: q.order,
    type: q.type as QuestionView["type"],
    question: q.content,
    answer: q.answer,
  }));
}

export function toPredictionView(p: Prediction): PredictionView {
  return {
    id: p.id,
    missionId: p.missionId,
    content: p.content,
    confidence: p.confidence,
    targetDate: p.targetDate.toISOString(),
    tag: p.tag,
    status: p.status,
    verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
    result: p.result,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toReviewView(r: Review | null): ReviewView | null {
  if (!r) return null;
  return {
    summary: r.summary,
    strength: parseList(r.strength),
    weakness: parseList(r.weakness),
    suggestion: parseList(r.suggestion),
  };
}

export function toAbilityScores(a: Ability): AbilityScores {
  return {
    observe: a.observe,
    understand: a.understand,
    connect: a.connect,
    reason: a.reason,
    predict: a.predict,
    update: a.update,
  };
}

export function toMissionView(
  m: Mission & {
    learning?: { title: string; content: string; estimatedMinutes: number } | null;
    questions?: { order: number; type: string; content: string; answer: string | null }[];
    prediction?: Prediction | null;
    review?: Review | null;
    node?: { id: string; difficulty: number } | null;
  }
): MissionView {
  const tierCount = m.node ? Math.min(Math.max(m.node.difficulty, 1), 5) : m.tier ?? 1;
  return {
    missionId: m.id,
    theme: m.theme,
    status: m.status,
    stage: m.stage,
    date: m.date,
    startedAt: m.startedAt ? m.startedAt.toISOString() : null,
    completedAt: m.completedAt ? m.completedAt.toISOString() : null,
    tier: m.tier ?? 1,
    tierCount,
    learning: m.learning
      ? { title: m.learning.title, content: m.learning.content, estimatedMinutes: m.learning.estimatedMinutes }
      : null,
    questions: toQuestionViews(m),
    prediction: m.prediction ? toPredictionView(m.prediction) : null,
    review: toReviewView(m.review ?? null),
    questionReviews: parseQuestionReviews(m.review),
  };
}
