import type { AIProvider } from "./types";
import { MockProvider } from "./mock.provider";
import { OpenAIResponsesProvider } from "./openai.provider";
import { WorkBuddyProvider } from "./workbuddy.provider";
import { DeepSeekProvider } from "./deepseek.provider";
import { HybridDeepSeekProvider } from "./hybrid-deepseek.provider";

// Provider factory (ADR-004 / 决策 D1). Switched by AI_PROVIDER env.
// - "mock" (default, offline): deterministic JSON, no key needed.
// - "openai": real Responses API (cloud), with automatic Mock fallback on failure.
// - "workbuddy": local Ollama (qwen2.5-7b) via OpenAI-compatible API, fully offline,
//   with automatic Mock fallback (user decision 2026-07-16).
// - "deepseek": REAL DeepSeek cloud API, all calls on v4-pro, with Mock fallback.
// - "deepseek-hybrid" (default since 2026-07-17): flash for generation, pro for
//   deep thinking (review + prediction verify) — smart AND fast.
let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const kind = (process.env.AI_PROVIDER || "mock").toLowerCase();
  if (kind === "openai") {
    cached = new OpenAIResponsesProvider(new MockProvider());
  } else if (kind === "workbuddy") {
    cached = new WorkBuddyProvider();
  } else if (kind === "deepseek") {
    cached = new DeepSeekProvider();
  } else if (kind === "deepseek-hybrid") {
    cached = new HybridDeepSeekProvider();
  } else {
    cached = new MockProvider();
  }
  return cached;
}

export type { AIProvider, AIContext, AITaskType } from "./types";
export { buildContext } from "./context";
