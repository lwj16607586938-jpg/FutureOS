import type {
  AIContext,
  AITaskType,
  AIConceptInput,
  AIMissionInput,
  AIPredictionInput,
} from "./types";
import type { AbilityScores } from "@/lib/types";

// Context Engine — the ONLY module allowed to assemble AI requests (doc 11 §2/§7).
// All AI calls flow through buildContext(taskType, ...). No module may call an LLM directly.
export function buildContext(
  taskType: AITaskType,
  data: {
    concept: AIConceptInput;
    ability: AbilityScores;
    recentThemes?: string[];
    dayIndex?: number;
    mission?: AIMissionInput | null;
    prediction?: AIPredictionInput | null;
  }
): AIContext {
  return {
    taskType,
    concept: data.concept,
    ability: data.ability,
    recentThemes: data.recentThemes ?? [],
    dayIndex: data.dayIndex ?? 0,
    mission: data.mission ?? null,
    prediction: data.prediction ?? null,
  };
}
