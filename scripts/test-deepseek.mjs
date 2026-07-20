import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve("D:/space_workbuddy/2026-07-16-14-26-16/futureos/.env");
const env = fs.readFileSync(envPath, "utf8");
const get = (k) => {
  const m = env.match(new RegExp(`^${k}="([^"]*)"`, "m"));
  return m ? m[1] : "";
};
const key = get("DEEPSEEK_API_KEY");
const model = get("DEEPSEEK_MODEL") || "deepseek-chat";
const base = get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com/v1";

console.log("model:", model, "| key length:", key.length, "| key prefix:", key.slice(0, 7) + "...");

const body = {
  model,
  messages: [
    { role: "system", content: "你只输出JSON，不要多余文字。" },
    { role: "user", content: '请输出JSON: {"theme":"GPU","ok":true}' },
  ],
  temperature: 0.3,
  max_tokens: 200,
};

const t0 = Date.now();
const res = await fetch(`${base}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  },
  body: JSON.stringify(body),
});
const text = await res.text();
const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n[HTTP ${res.status} | ${dt}s]`);
console.log(text.slice(0, 600));
