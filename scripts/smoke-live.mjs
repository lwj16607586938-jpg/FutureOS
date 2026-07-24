const BASE = "http://localhost:3000";
async function streamPost(url, body) {
  const res = await fetch(BASE + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(url + " -> " + res.status);
  const r = res.body.getReader();
  const d = new TextDecoder();
  let buf = "", id = null, text = "";
  while (true) {
    const { done, value } = await r.read();
    if (done) break;
    buf += d.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      try {
        const e = JSON.parse(data);
        if (e.missionId !== undefined) id = e.missionId;
        if (e.delta !== undefined) text += e.delta;
      } catch {}
    }
  }
  return { id, text };
}
console.log("[smoke] starting mission via deepseek-hybrid...");
const { id, text } = await streamPost("/api/mission/start/stream", {});
console.log("[smoke] missionId =", id);
console.log("[smoke] ---- generated learning (head) ----");
console.log(text.slice(0, 800));
const hasMd = /\n#{1,3} |\*\*|^\s*-\s/.test(text);
console.log("\n[smoke] contains markdown (## / ** / - list)?", hasMd);
