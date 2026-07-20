import { OpenAICompatibleProvider } from "./openai-compatible.provider";

// DeepSeekProvider — routes generation to the REAL DeepSeek cloud API
// (https://api.deepseek.com, OpenAI-compatible /v1/chat/completions).
//
// Chosen 2026-07-17 when the user asked to use "我的 deepseek 的 api". The local
// Ardof bridge (127.0.0.1:31415 → DeepSeek-V4-Pro) was returning "Insufficient
// Balance", so the genuine cloud API is the working path. DeepSeek-chat is fast and
// cheap (far quicker than the local 7B), giving smart, evolving coaching.
//
// Requires DEEPSEEK_API_KEY (sk-...). If missing/empty, every call transparently
// falls back to MockProvider (safety net, decision D1) — so the app never breaks,
// but you'll see a warning in the server log.
export class DeepSeekProvider extends OpenAICompatibleProvider {
  constructor() {
    const apiKey = process.env.DEEPSEEK_API_KEY || "";
    super("deepseek", {
      baseUrl: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/+$/, ""),
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      apiKey,
      timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS) || 60000, // cloud is fast; 60s is generous
    });
    if (!apiKey) {
      console.warn(
        "[DeepSeekProvider] DEEPSEEK_API_KEY 未设置 —— 将回退 Mock。请在 .env 填入 sk-... 后重启服务。"
      );
    }
  }
}
