"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend } from "@/lib/fetcher";
import { Card, CardTitle, Badge, Button, Textarea, Skeleton, EmptyState } from "@/components/ui";
import type { PredictionListResult, PredictionView } from "@/lib/types";
import { useState } from "react";

const FILTERS = [
  { key: null as string | null, label: "全部" },
  { key: "PENDING", label: "待验证" },
  { key: "VERIFIED", label: "已验证" },
  { key: "FAILED", label: "未命中" },
];

const STATUS_TONE: Record<string, "warning" | "success" | "error"> = {
  PENDING: "warning",
  VERIFIED: "success",
  FAILED: "error",
};

export default function PredictionsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState("");

  const list = useQuery<PredictionListResult>({
    queryKey: ["predictions", filter],
    queryFn: () => apiGet(`/api/predictions${filter ? `?status=${filter}` : ""}`),
  });

  const detail = useQuery<PredictionView>({
    queryKey: ["prediction", selectedId],
    queryFn: () => apiGet(`/api/predictions/${selectedId}`),
    enabled: !!selectedId,
  });

  const verify = useMutation({
    mutationFn: (status: "VERIFIED" | "FAILED") =>
      apiSend(`/api/predictions/${selectedId}/verify`, "PATCH", { status, result: result || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["predictions", filter] });
      qc.invalidateQueries({ queryKey: ["prediction", selectedId] });
      qc.invalidateQueries({ queryKey: ["growth"] });
      setResult("");
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {list.isLoading && <Skeleton className="h-24 w-full" />}
        {list.data && list.data.items.length === 0 && <EmptyState title="暂无预测" hint="在「今日」完成 Mission 后可写下预测。" />}
        {list.data?.items.map((p) => (
          <Card
            key={p.id}
            className={`cursor-pointer transition-colors hover:border-primary/40 ${
              selectedId === p.id ? "border-primary/60" : ""
            }`}
            onClick={() => setSelectedId(p.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-2 text-sm leading-6 text-foreground">{p.content}</p>
              <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
            </div>
            <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
              <span>置信度 {p.confidence}%</span>
              <span>验证于 {p.targetDate.slice(0, 10)}</span>
            </div>
          </Card>
        ))}
      </div>

      <div>
        {!selectedId && (
          <Card>
            <p className="text-sm text-muted-foreground">选择一条预测查看详情，并在到期后进行手动验证。</p>
          </Card>
        )}
        {selectedId && detail.data && (
          <Card className="fos-fade-in space-y-3">
            <CardTitle>预测详情</CardTitle>
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{detail.data.content}</p>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>置信度 {detail.data.confidence}%</span>
              <span>验证于 {detail.data.targetDate.slice(0, 10)}</span>
              <Badge tone={STATUS_TONE[detail.data.status]}>{detail.data.status}</Badge>
            </div>
            {detail.data.result && (
              <p className="text-sm text-muted-foreground">验证结论：{detail.data.result}</p>
            )}

            {detail.data.status === "PENDING" && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">手动验证（V1）</p>
                <Textarea
                  placeholder="验证结论（可选）：发生了什么？预测为何命中/未命中？"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => verify.mutate("VERIFIED")} disabled={verify.isPending}>
                    验证命中
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => verify.mutate("FAILED")} disabled={verify.isPending}>
                    未命中
                  </Button>
                </div>
              </div>
            )}
            {detail.data.status !== "PENDING" && detail.data.verifiedAt && (
              <p className="text-xs text-muted-foreground">已于 {detail.data.verifiedAt.slice(0, 10)} 验证</p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
