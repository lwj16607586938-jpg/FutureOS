import { OpenAICompatibleProvider } from "./openai-compatible.provider";
import type { AIProvider, AIContext, VerificationOutput } from "./types";
import type {
  MissionAIOutput,
  ReviewAIOutput,
  PredictionAssistanceOutput,
} from "@/lib/types";
import { buildMissionPrompt, buildReviewPrompt } from "@/prompts";

// HybridDeepSeekProvider — the "smart AND fast" strategy (user decision 2026-07-17):
//   • Generation (Mission + 3 questions + suggestions) → flash  (deepseek-v4-flash)
//     → fast, cheap, quality is plenty for content production.
//   • Deep thinking (Review + Prediction verification)  → pro   (deepseek-v4-pro)
//     → slower & pricier, but reasoning quality is what makes the coach "evolve".
//
// Both sub-providers inherit the shared base (chat/retry/stream/Mock-fallback), so
// this class only wires routing. If either sub-call fails, it falls back to Mock
// (except verification, which returns null → caller skips, never false-verifies).
export class HybridDeepSeekProvider implements AIProvider {
  readonly name = "deepseek-hybrid";
  private flash: OpenAICompatibleProvider;
  private pro: OpenAICompatibleProvider;

  constructor() {
    const apiKey = process.env.DEEPSEEK_API_KEY || "";
    const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/+$/, "");
    const timeout = Number(process.env.DEEPSEEK_TIMEOUT_MS) || 120000;
    const flashModel = process.env.DEEPSEEK_FLASH_MODEL || "deepseek-v4-flash";
    const proModel = process.env.DEEPSEEK_PRO_MODEL || "deepseek-v4-pro";
    // flash is fast; cap its timeout so a stuck call fails over to Mock quickly.
    this.flash = new OpenAICompatibleProvider("deepseek-flash", {
      baseUrl: base,
      model: flashModel,
      apiKey,
      timeoutMs: Math.min(timeout, 60000),
    });
    this.pro = new OpenAICompatibleProvider("deepseek-pro", {
      baseUrl: base,
      model: proModel,
      apiKey,
      timeoutMs: timeout,
    });
  }

  generateMission(ctx: AIContext): Promise<MissionAIOutput> {
    return this.flash.generateMission(ctx);
  }
  generateQuestions(ctx: AIContext): Promise<MissionAIOutput["questions"]> {
    return this.flash.generateQuestions(ctx);
  }
  generateReview(ctx: AIContext): Promise<ReviewAIOutput> {
    return this.pro.generateReview(ctx);
  }
  generateSuggestion(ctx: AIContext): Promise<string[]> {
    return this.flash.generateSuggestion(ctx);
  }
  assistPrediction(ctx: AIContext): Promise<PredictionAssistanceOutput> {
    return this.pro.assistPrediction(ctx);
  }

  async *streamGenerateMission(ctx: AIContext): AsyncIterable<string> {
    yield* this.flash.streamChat(buildMissionPrompt(ctx));
  }
  async *streamGenerateReview(ctx: AIContext): AsyncIterable<string> {
    yield* this.pro.streamChat(buildReviewPrompt(ctx));
  }

  generateVerification(ctx: AIContext): Promise<VerificationOutput | null> {
    // Delegate to pro; the base provider wraps chat+parseVerify in try/catch and
    // returns null on ANY failure so the caller can SKIP rather than false-verify.
    return this.pro.generateVerification(ctx);
  }
}
