import { OpenAICompatibleProvider } from "./openai-compatible.provider";

// WorkBuddyProvider — routes generation to a LOCAL model server (Ollama) that speaks
// the OpenAI-compatible /v1/chat/completions protocol.
//
// Why this exists (user decision 2026-07-16): "复用现有模型，希望它聪明、能进化。"
// The machine runs Ollama with qwen2.5-7b (and a finance-tuned variant). Routing
// FutureOS's text generation here means 100% offline, no cloud, no key — consistent
// with the user's local-model preference. The model receives the user's LIVE ability
// scores + recent themes every call, so coaching is personalized and evolves.
//
// NOTE: the Ardof local bridge (127.0.0.1:31415, DeepSeek-V4-Pro) was found to return
// "Insufficient Balance" on 2026-07-17, so the cloud DeepSeek path is preferred; this
// local Ollama path remains available by setting AI_PROVIDER=workbuddy.
export class WorkBuddyProvider extends OpenAICompatibleProvider {
  constructor() {
    super("workbuddy", {
      baseUrl: (process.env.WORKBUDDY_BASE_URL || "http://localhost:11434/v1").replace(/\/+$/, ""),
      model: process.env.WORKBUDDY_MODEL || "qwen2.5-7b",
      apiKey: process.env.WORKBUDDY_API_KEY || "ollama", // Ollama ignores the key, but send one
      timeoutMs: Number(process.env.WORKBUDDY_TIMEOUT_MS) || 180000, // local 7B is slow (~4.5 tok/s)
    });
  }
}
