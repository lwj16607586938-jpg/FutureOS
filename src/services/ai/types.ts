import type {
  MissionAIOutput,
  ReviewAIOutput,
  DrillAIOutput,
  PredictionAssistanceOutput,
  AbilityScores,
} from "@/lib/types";

// taskType mirrors doc 11 §7 — the only entry points allowed to call an LLM.
export type AITaskType =
  | "MISSION"
  | "QUESTION"
  | "REVIEW"
  | "DRILL"
  | "SUGGESTION"
  | "PREDICTION_ASSISTANCE"
  | "PREDICTION_VERIFY";

export interface AIConceptInput {
  title: string;
  description: string; // Markdown
  category: string | null;
  difficulty: number; // 1-5
}

export interface AIMissionInput {
  theme: string;
  answers: { order: number; type: string; question: string; answer: string | null }[];
  prediction: { content: string; confidence: number; targetDate: string } | null;
  questionReviews?: { order: number; type: string; question: string; userAnswer: string | null; verdict: string; diagnosis: string; correctAnswer: string; explanation: string }[];
}

export interface AIPredictionInput {
  content: string;
  confidence: number;
  targetDate: string; // ISO
  today: string; // ISO, current date when verifying
}

// The assembled context passed to every provider. buildContext (Context Engine)
// is the ONLY module that may construct this. doc 11 §4/§5.
export interface AIContext {
  taskType: AITaskType;
  concept: AIConceptInput;
  ability: AbilityScores;
  recentThemes: string[];
  dayIndex: number;
  mission: AIMissionInput | null;
  prediction?: AIPredictionInput | null;
}

export interface VerificationOutput {
  outcome: "VERIFIED" | "FAILED";
  reason: string;
}

// Unified provider interface (doc 11 §13). Swappable: openai / anthropic / gemini / mock.
export interface AIProvider {
  readonly name: string;
  generateMission(ctx: AIContext): Promise<MissionAIOutput>;
  generateQuestions(ctx: AIContext): Promise<MissionAIOutput["questions"]>;
  generateReview(ctx: AIContext): Promise<ReviewAIOutput>;
  generateDrill(ctx: AIContext): Promise<DrillAIOutput>;
  generateSuggestion(ctx: AIContext): Promise<string[]>;
  assistPrediction(ctx: AIContext): Promise<PredictionAssistanceOutput>;
  // Streaming variants for live "typewriter" UX (start / complete flows).
  streamGenerateMission(ctx: AIContext): AsyncIterable<string>;
  streamGenerateReview(ctx: AIContext): AsyncIterable<string>;
  // Auto-verification of due predictions. Returns null when the model is
  // unavailable so callers can SKIP (leave PENDING) rather than false-verify.
  generateVerification(ctx: AIContext): Promise<VerificationOutput | null>;
}

export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIError";
  }
}
