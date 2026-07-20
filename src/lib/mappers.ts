import type { Mission, Prediction, Review, Ability } from "@prisma/client";
import type {
  MissionView,
  PredictionView,
  ReviewView,
  AbilityScores,
  QuestionView,
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
  }
): MissionView {
  return {
    missionId: m.id,
    theme: m.theme,
    status: m.status,
    stage: m.stage,
    date: m.date,
    startedAt: m.startedAt ? m.startedAt.toISOString() : null,
    completedAt: m.completedAt ? m.completedAt.toISOString() : null,
    learning: m.learning
      ? { title: m.learning.title, content: m.learning.content, estimatedMinutes: m.learning.estimatedMinutes }
      : null,
    questions: toQuestionViews(m),
    prediction: m.prediction ? toPredictionView(m.prediction) : null,
    review: toReviewView(m.review ?? null),
  };
}
