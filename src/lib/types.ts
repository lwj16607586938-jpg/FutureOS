import type { AbilityDimensionKey } from "./constants";

// ---- API envelope (doc 09 §5) ----
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

// ---- AI JSON output schemas (doc 11 §10) ----
export interface MissionAIOutput {
  theme: string;
  learning: { title: string; content: string; estimatedMinutes: number };
  questions: { type: "EXPLAIN" | "REASON" | "CONNECT"; content: string }[];
}

export interface ReviewAIOutput {
  summary: string;
  strength: string[];
  weakness: string[];
  suggestion: string[];
  // Per-question review (req3/req4): explicit verdict, pointed error location,
  // reference answer, and a self-contained explanation.
  questionReviews?: QuestionReviewItem[];
}

// AI output for the mastery drill (follow-up MCQ/TF questions).
export interface DrillAIOutput {
  questions: DrillQuestion[];
}

// Per-question coaching review (req3/req4).
export interface QuestionReviewItem {
  order: number;
  type: "EXPLAIN" | "REASON" | "CONNECT";
  question: string;
  userAnswer: string | null;
  verdict: "correct" | "partial" | "wrong";
  diagnosis: string; // 错在哪里 — quotes the user's specific error; empty when correct
  correctAnswer: string; // 参考答案 — the reference/ideal answer
  explanation: string; // 讲解 — complete analysis, self-contained, no "回看材料"
}

// Prediction assistance (doc 11 §7 PREDICTION_ASSISTANCE) — AI helps, never writes the prediction.
export interface PredictionAssistanceOutput {
  historyNotes: string[];
  riskHints: string[];
}

// ---- View models (serializable, client-safe) ----
export interface QuestionView {
  order: number;
  type: "EXPLAIN" | "REASON" | "CONNECT";
  question: string;
  answer: string | null;
}

export interface LearningView {
  title: string;
  content: string;
  estimatedMinutes: number;
}

export interface PredictionView {
  id: string;
  missionId: string;
  content: string;
  confidence: number;
  targetDate: string;
  tag: string | null;
  status: "PENDING" | "VERIFIED" | "FAILED";
  verifiedAt: string | null;
  result: string | null;
  createdAt: string;
}

export interface ReviewView {
  summary: string;
  strength: string[];
  weakness: string[];
  suggestion: string[];
}

export interface MissionView {
  missionId: string;
  theme: string;
  status: "CREATED" | "STARTED" | "COMPLETED";
  stage: "CREATED" | "STARTED" | "LEARNING" | "THINKING" | "PREDICTION" | "REVIEW" | "DRILL" | "COMPLETED";
  date: string;
  startedAt: string | null;
  completedAt: string | null;
  tier: number; // 1-based tier within this node's module (L1..Lk)
  tierCount: number; // total tiers of the node (== clamp(difficulty,1,5)); prediction required only at final tier (req2)
  learning: LearningView | null;
  questions: QuestionView[];
  prediction: PredictionView | null;
  review: ReviewView | null;
  questionReviews: QuestionReviewItem[]; // per-question coaching (req3/req4)
  drillQuestions: DrillQuestion[]; // 追问（选择题/判断题），stage=DRILL 时出现
}

// Drill / mastery loop questions (MCQ or true/false).
export interface DrillQuestion {
  id: string;
  type: "MCQ" | "TF";
  question: string;
  options?: string[]; // for MCQ: A/B/C/D labels as strings like "A. xxx"
  correctAnswer: string; // for MCQ: the letter/label; for TF: "true" | "false"
  explanation: string; // shown after answering
  userAnswer?: string | null;
  isCorrect?: boolean | null;
}

export interface AbilityScores {
  observe: number;
  understand: number;
  connect: number;
  reason: number;
  predict: number;
  update: number;
}

export interface WorldNodeView {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  difficulty: number;
  learningStatus: "UNKNOWN" | "LEARNING" | "LEARNED" | "MASTERED";
}

export interface WorldEdgeView {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relation: string;
}

export interface WorldView {
  nodes: WorldNodeView[];
  edges: WorldEdgeView[];
}

export interface NodeDetailView {
  id: string;
  title: string;
  description: string;
  category: string | null;
  difficulty: number;
  relatedNodes: { id: string; title: string; relation: string }[];
  learningStatus: "UNKNOWN" | "LEARNING" | "LEARNED" | "MASTERED";
}

export interface PredictionListQuery {
  page?: number;
  pageSize?: number;
  status?: "PENDING" | "VERIFIED" | "FAILED" | null;
  sort?: string; // e.g. "createdAt,desc"
}

export interface PredictionListResult {
  items: PredictionView[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TrendPoint {
  date: string;
  cgs: number;
}

export interface GrowthView {
  ability: AbilityScores;
  cgs: number;
  missionCount: number;
  predictionCount: number;
  knowledgeCount: number;
  currentStreak: number;
  longestStreak: number;
  trend: TrendPoint[];
}

// ---- 用户内容完整保留（档案 / 导出 / 自动备份） ----
export interface ArchiveQuestion {
  order: number;
  type: "EXPLAIN" | "REASON" | "CONNECT";
  question: string;
  answer: string | null;
}

export interface ArchiveMission {
  missionId: string;
  theme: string;
  nodeTitle: string | null;
  tier: number; // 1-based tier within the node's module
  tierCount: number; // total tiers of the node
  date: string; // YYYY-MM-DD
  status: "CREATED" | "STARTED" | "COMPLETED";
  stage: string;
  completedAt: string | null;
  learning: { title: string; content: string } | null;
  questions: ArchiveQuestion[]; // 回答 / 思考（3 道思考题）
  prediction: {
    content: string;
    confidence: number;
    targetDate: string;
    tag: string | null;
    status: "PENDING" | "VERIFIED" | "FAILED";
    result: string | null;
  } | null;
  review: {
    summary: string;
    strength: string[];
    weakness: string[];
    suggestion: string[];
    questionReviews: QuestionReviewItem[]; // 逐题：判定/错因/参考答案/讲解
  } | null;
}

export interface ArchiveResult {
  missions: ArchiveMission[];
}

export interface MissionExport {
  exportedAt: string;
  app: "FutureOS";
  version: string;
  missions: ArchiveMission[];
}
