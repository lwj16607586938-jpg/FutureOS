import OpenAI from "openai";
import type { AIProvider, AIContext, VerificationOutput } from "./types";
import type {
  MissionAIOutput,
  ReviewAIOutput,
  PredictionAssistanceOutput,
} from "@/lib/types";
import { AI_MAX_RETRIES, AI_TIMEOUT_MS } from "@/lib/constants";
import {
  buildMissionPrompt,
  buildReviewPrompt,
  buildPredictionAssistancePrompt,
  buildSuggestionPrompt,
} from "@/prompts";
import { MockProvider } from "./mock.provider";
import {
  parseMission,
  parseReview,
  parseAssistance,
  parseStringArray,
} from "./parse";

// Real provider using the OpenAI Responses API. On exhaustion of retries it falls
// back to the deterministic MockProvider so the Mission is never blocked (doc 11 §14 / 决策 D1).
export class OpenAIResponsesProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;
  private fallback = new MockProvider();

  constructor(fallback?: MockProvider) {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "missing" });
    this.model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    if (fallback) this.fallback = fallback;
  }

  async generateMission(ctx: AIContext): Promise<MissionAIOutput> {
    return this.withFallback(() =>
      this.respond(buildMissionPrompt(ctx), parseMission)
    , () => this.fallback.generateMission(ctx));
  }

  async generateQuestions(ctx: AIContext): Promise<MissionAIOutput["questions"]> {
    const m = await this.generateMission(ctx);
    return m.questions;
  }

  async generateReview(ctx: AIContext): Promise<ReviewAIOutput> {
    return this.withFallback(() =>
      this.respond(buildReviewPrompt(ctx), parseReview)
    , () => this.fallback.generateReview(ctx));
  }

  async generateSuggestion(ctx: AIContext): Promise<string[]> {
    return this.withFallback(() =>
      this.respond(buildSuggestionPrompt(ctx), parseStringArray)
    , () => this.fallback.generateSuggestion(ctx));
  }

  async assistPrediction(ctx: AIContext): Promise<PredictionAssistanceOutput> {
    return this.withFallback(() =>
      this.respond(buildPredictionAssistancePrompt(ctx), parseAssistance)
    , () => this.fallback.assistPrediction(ctx));
  }

  // Streaming (live typewriter). The Responses API path has no first-class
  // SSE primitive wired here, so we delegate to the Mock fallback — the UI
  // still animates; this branch is dormant (active provider is deepseek-hybrid).
  async *streamGenerateMission(ctx: AIContext): AsyncIterable<string> {
    yield* this.fallback.streamGenerateMission(ctx);
  }
  async *streamGenerateReview(ctx: AIContext): AsyncIterable<string> {
    yield* this.fallback.streamGenerateReview(ctx);
  }

  // Auto-verify delegated to Mock → returns null → caller SKIPs (never false-verify).
  generateVerification(ctx: AIContext): Promise<VerificationOutput | null> {
    return this.fallback.generateVerification(ctx);
  }

  private async withFallback<T>(
    attempt: () => Promise<T>,
    fallbackFn: () => Promise<T>
  ): Promise<T> {
    try {
      return await attempt();
    } catch {
      return fallbackFn();
    }
  }

  private async respond<T>(prompt: string, parse: (raw: string) => T): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < AI_MAX_RETRIES; i++) {
      try {
        const res = await this.client.responses.create(
          {
            model: this.model,
            input: prompt,
          },
          { timeout: AI_TIMEOUT_MS }
        );
        const text = this.extractText(res);
        return parse(text);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("OpenAI request failed");
  }

  private extractText(res: unknown): string {
    const r = res as { output_text?: string; output?: { content?: { text?: string }[] }[] };
    if (r.output_text) return r.output_text;
    const first = r.output?.[0]?.content?.find((c) => c.text);
    return first?.text ?? "";
  }
}
