import type { AIProvider, AIContext, VerificationOutput } from "./types";
import type {
  MissionAIOutput,
  ReviewAIOutput,
  DrillAIOutput,
  PredictionAssistanceOutput,
} from "@/lib/types";
import { AI_MAX_RETRIES } from "@/lib/constants";
import {
  buildMissionPrompt,
  buildReviewPrompt,
  buildDrillPrompt,
  buildPredictionAssistancePrompt,
  buildSuggestionPrompt,
  buildPredictionVerifyPrompt,
} from "@/prompts";
import { MockProvider } from "./mock.provider";
import {
  parseMission,
  parseReview,
  parseDrill,
  parseAssistance,
  parseStringArray,
  parseVerify,
} from "./parse";

// Shared base for any provider that speaks the OpenAI-compatible
// /v1/chat/completions protocol (local Ollama, DeepSeek cloud, etc.).
//
// The cognitive loop only cares about the 5 AIProvider methods; HOW the text is
// produced is fully encapsulated here. Every call is retried (AI_MAX_RETRIES) and,
// on ANY failure, transparently falls back to the deterministic MockProvider so a
// Mission is never blocked (doc 11 §14 / 决策 D1).
//
// Subclasses supply only connection config via super(name, cfg).
export interface CompatibleConfig {
  baseUrl: string; // e.g. http://localhost:11434/v1  or  https://api.deepseek.com/v1
  model: string;
  apiKey: string;
  timeoutMs: number;
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string;
  protected cfg: CompatibleConfig;
  private fallback = new MockProvider();

  constructor(name: string, cfg: CompatibleConfig) {
    this.name = name;
    this.cfg = cfg;
  }

  async generateMission(ctx: AIContext): Promise<MissionAIOutput> {
    return this.tryOrFallback(
      () => this.chat(buildMissionPrompt(ctx)).then(parseMission),
      () => this.fallback.generateMission(ctx)
    );
  }

  async generateQuestions(ctx: AIContext): Promise<MissionAIOutput["questions"]> {
    return (await this.generateMission(ctx)).questions;
  }

  async generateReview(ctx: AIContext): Promise<ReviewAIOutput> {
    return this.tryOrFallback(
      () => this.chat(buildReviewPrompt(ctx), 4096).then(parseReview),
      () => this.fallback.generateReview(ctx)
    );
  }

  async generateDrill(ctx: AIContext): Promise<DrillAIOutput> {
    return this.tryOrFallback(
      () => this.chat(buildDrillPrompt(ctx), 4096).then(parseDrill),
      () => this.fallback.generateDrill(ctx)
    );
  }

  async generateSuggestion(ctx: AIContext): Promise<string[]> {
    return this.tryOrFallback(
      () => this.chat(buildSuggestionPrompt(ctx)).then(parseStringArray),
      () => this.fallback.generateSuggestion(ctx)
    );
  }

  async assistPrediction(ctx: AIContext): Promise<PredictionAssistanceOutput> {
    return this.tryOrFallback(
      () => this.chat(buildPredictionAssistancePrompt(ctx)).then(parseAssistance),
      () => this.fallback.assistPrediction(ctx)
    );
  }

  // --- Streaming (live typewriter). Yields content deltas as Server-Sent Events. ---
  async *streamGenerateMission(ctx: AIContext): AsyncIterable<string> {
    yield* this.streamChat(buildMissionPrompt(ctx));
  }

  async *streamGenerateReview(ctx: AIContext): AsyncIterable<string> {
    yield* this.streamChat(buildReviewPrompt(ctx));
  }

  // Auto-verification of due predictions. Returns null on ANY failure so the
  // caller can SKIP (leave PENDING) instead of falsely verifying. No Mock fallback.
  async generateVerification(ctx: AIContext): Promise<VerificationOutput | null> {
    try {
      const text = await this.chat(buildPredictionVerifyPrompt(ctx));
      return parseVerify(text);
    } catch {
      return null;
    }
  }

  // Public streaming primitive used by the hybrid provider's routed models.
  async *streamChat(prompt: string, maxTokens = 4096): AsyncGenerator<string> {
    const baseUrl = this.cfg.baseUrl.replace(/\/+$/, "");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: this.cfg.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
          max_tokens: maxTokens,
          stream: true,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok || !res.body) {
        const body = res.body ? await res.text().catch(() => "") : "";
        throw new Error(`HTTP ${res.status}${body ? ` ${body.slice(0, 200)}` : ""}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            const j = JSON.parse(payload);
            const delta = j?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length) yield delta;
          } catch {
            // ignore malformed keep-alive lines
          }
        }
      }
    } catch (e) {
      clearTimeout(timer);
      throw e instanceof Error ? e : new Error(`${this.name} 流式请求失败`);
    }
  }

  private async tryOrFallback<T>(
    attempt: () => Promise<T>,
    fallbackFn: () => Promise<T>
  ): Promise<T> {
    try {
      return await attempt();
    } catch (e) {
      console.warn(
        `[${this.name}] 模型调用失败，回退 Mock：${e instanceof Error ? e.message : String(e)}`
      );
      return fallbackFn();
    }
  }

  private async chat(prompt: string, maxTokens = 4096): Promise<string> {
    const baseUrl = this.cfg.baseUrl.replace(/\/+$/, "");
    let lastErr: unknown;
    for (let i = 0; i < AI_MAX_RETRIES; i++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: this.cfg.model,
            messages: [{ role: "user", content: prompt }],
            // Lower temperature → more reliable, complete structured JSON.
            // Explicit max_tokens prevents the provider's default (sometimes
            // short) ceiling from truncating long outputs (e.g. 3 questions
            // plus a full learning passage) — which previously left question
            // content empty (2026-07-17 DeepSeek run).
            // 2026-07-27: raised default to 4096 — a full Review/Drill JSON
            // (3 questionReviews, each with correctAnswer+explanation+diagnosis)
            // exceeds 1500 tokens and was being truncated → invalid JSON →
            // silent Mock fallback. Review/Drill now pass 4096 explicitly.
            temperature: 0.4,
            max_tokens: maxTokens,
          }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}${body ? ` ${body.slice(0, 200)}` : ""}`);
        }
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const text = data?.choices?.[0]?.message?.content ?? "";
        if (!text.trim()) throw new Error("空响应");
        return text;
      } catch (e) {
        clearTimeout(timer);
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(`${this.name} 请求失败`);
  }
}
