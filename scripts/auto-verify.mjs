// Triggers FutureOS auto-verification of due predictions.
// Run manually: `node scripts/auto-verify.mjs`
// Or via the scheduled automation (daily). Requires the server on :3000.
const BASE = process.env.FUTUREOS_BASE || "http://localhost:3000";

try {
  const res = await fetch(`${BASE}/api/predictions/auto-verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const json = await res.json();
  if (!json.success) {
    console.error("自动验证失败:", json.error?.message || res.status);
    process.exit(1);
  }
  const { verified, skipped } = json.data;
  console.log(`[${new Date().toISOString()}] 自动验证完成 → 已判定 ${verified} 条，跳过 ${skipped} 条（模型不可用）。`);
} catch (e) {
  console.error("无法连接 FutureOS 服务（是否 npm run start 在运行？）:", e.message);
  process.exit(1);
}
