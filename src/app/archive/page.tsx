"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetcher";
import { Card, CardTitle, Badge, EmptyState } from "@/components/ui";
import type { ArchiveMission } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function groupByNode(missions: ArchiveMission[]): { nodeTitle: string; items: ArchiveMission[] }[] {
  const map = new Map<string, ArchiveMission[]>();
  for (const m of missions) {
    const key = m.nodeTitle || m.theme;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries()).map(([nodeTitle, items]) => ({ nodeTitle, items }));
}

function statusBadge(status: ArchiveMission["status"]) {
  if (status === "COMPLETED") return <Badge tone="success">已完成</Badge>;
  if (status === "STARTED") return <Badge tone="warning">进行中</Badge>;
  return <Badge tone="neutral">未开始</Badge>;
}

function ExportButton() {
  const onExport = async () => {
    const data = await apiGet<{ exportedAt: string; missions: ArchiveMission[] }>("/api/mission/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `futureos-archive-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      onClick={onExport}
      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
    >
      导出我的全部记录 (JSON)
    </button>
  );
}

function MissionCard({ m }: { m: ArchiveMission }) {
  const qr = m.review?.questionReviews ?? [];
  return (
    <Card>
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 py-1">
          <Badge tone="neutral">
            L{m.tier}/{m.tierCount}
          </Badge>
          <span className="font-medium text-foreground">{m.theme}</span>
          <span className="text-xs text-muted-foreground">{m.date}</span>
          {statusBadge(m.status)}
          {m.questions.length > 0 && <span className="text-xs text-muted-foreground">{m.questions.length} 题</span>}
          {m.prediction && <span className="text-xs text-muted-foreground">· 含预测</span>}
        </summary>

        <div className="mt-3 space-y-4">
          {m.learning && (
            <div className="prose-reading">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.learning.content}</ReactMarkdown>
            </div>
          )}

          {m.questions.map((q) => {
            const review = qr.find((r) => r.order === q.order);
            return (
              <div key={q.order} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{q.type}</Badge>
                  <span className="text-sm font-medium text-foreground">第 {q.order} 题</span>
                  {review && (
                    <Badge tone={review.verdict === "correct" ? "success" : review.verdict === "partial" ? "warning" : "error"}>
                      {review.verdict === "correct" ? "答对" : review.verdict === "partial" ? "部分正确" : "答错"}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-sm leading-7 text-foreground">{q.question}</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  你的回答（思考）：
                  <span className="text-foreground">{q.answer && q.answer.trim() ? q.answer : "（未作答）"}</span>
                </div>
                {review && review.verdict !== "correct" && review.diagnosis && (
                  <div className="mt-2 rounded-md bg-error/10 p-2 text-sm leading-6 text-error">
                    <span className="font-semibold">错在哪里：</span>
                    {review.diagnosis}
                  </div>
                )}
                {review && review.correctAnswer && (
                  <div className="mt-2 rounded-md bg-success/10 p-2 text-sm leading-6 text-success">
                    <span className="font-semibold">参考答案：</span>
                    {review.correctAnswer}
                  </div>
                )}
                {review && review.explanation && (
                  <div className="mt-2 text-sm leading-7 text-foreground">
                    <span className="font-semibold text-muted-foreground">讲解：</span>
                    {review.explanation}
                  </div>
                )}
              </div>
            );
          })}

          {m.prediction && (
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Badge tone="primary">预测</Badge>
                <span className="text-xs text-muted-foreground">置信度 {m.prediction.confidence}%</span>
                <span className="text-xs text-muted-foreground">· 验证于 {m.prediction.targetDate.slice(0, 10)}</span>
                <Badge tone={m.prediction.status === "PENDING" ? "warning" : "success"}>{m.prediction.status}</Badge>
              </div>
              <p className="mt-2 text-sm leading-7 text-foreground">{m.prediction.content}</p>
              {m.prediction.result && <p className="mt-1 text-xs text-muted-foreground">结果：{m.prediction.result}</p>}
            </div>
          )}

          {m.review && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">AI 复盘</p>
              <p className="mt-1 text-sm leading-7 text-foreground">{m.review.summary}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <ReviewCol title="优势" items={m.review.strength} tone="success" />
                <ReviewCol title="待加强" items={m.review.weakness} tone="warning" />
                <ReviewCol title="建议" items={m.review.suggestion} tone="primary" />
              </div>
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}

function ReviewCol({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warning" | "primary" }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm leading-6 text-foreground">
            <Badge tone={tone}>{i + 1}</Badge>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ArchivePage() {
  const { data, isLoading, isError, error } = useQuery<{ missions: ArchiveMission[] }>({
    queryKey: ["archive"],
    queryFn: () => apiGet("/api/mission/archive"),
  });

  const missions = data?.missions ?? [];
  const groups = groupByNode(missions);

  return (
    <div className="reading-col mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">我的学习档案</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            你所有的回答、思考与预测，按主题完整归档、永不丢失。
          </p>
        </div>
        <ExportButton />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">加载中…</p>}
      {isError && (
        <p className="text-sm text-error">加载失败：{(error as Error)?.message ?? "未知错误"}</p>
      )}

      {!isLoading && missions.length === 0 && (
        <EmptyState
          title="还没有学习记录"
          hint="从「今日」开始你的第一场 Mission，完成的每一题、每一次思考与预测都会被完整保留在这里。"
        />
      )}

      {groups.map((g) => (
        <section key={g.nodeTitle}>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{g.nodeTitle}</h2>
            <span className="text-xs text-muted-foreground">{g.items.length} 场</span>
          </div>
          <div className="space-y-3">
            {g.items.map((m) => (
              <MissionCard key={m.missionId} m={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
