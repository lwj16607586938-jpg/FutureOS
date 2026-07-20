// Typed fetch helpers for the FutureOS API. Throws on { success:false }.
export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "请求失败");
  return json.data as T;
}

export async function apiSend<T>(url: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "请求失败");
  return json.data as T;
}

// Streaming POST: reads a Server-Sent Events stream and invokes onDelta for each
// `data: {delta}` event. Resolves on `event: done`; throws on `event: error`.
export async function streamPost(
  url: string,
  body: unknown,
  onDelta: (delta: string) => void
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok || !res.body) throw new Error(`stream 请求失败 (${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const evt = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let eventName = "message";
      let dataStr = "";
      for (const line of evt.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
      }
      if (eventName === "done") return;
      if (eventName === "error") {
        try {
          const d = JSON.parse(dataStr || "{}");
          throw new Error(d.message || "stream 出错");
        } catch (e) {
          throw e instanceof Error ? e : new Error("stream 出错");
        }
      }
      if (dataStr) {
        try {
          const d = JSON.parse(dataStr);
          if (d.delta) onDelta(d.delta);
        } catch {
          /* ignore non-JSON keepalive */
        }
      }
    }
  }
}
