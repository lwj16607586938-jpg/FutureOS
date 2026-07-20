"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetcher";
import { Card, CardTitle, Badge, Skeleton, EmptyState } from "@/components/ui";
import type { WorldView, NodeDetailView } from "@/lib/types";
import { useState, useMemo } from "react";

const RELATION_COLOR: Record<string, string> = {
  CAUSE: "#ef4444",
  DEPEND_ON: "#f97316",
  ENABLE: "#22c55e",
  PART_OF: "#3b82f6",
  COMPARE: "#a855f7",
  OPPOSITE: "#ec4899",
  EXTENDS: "#14b8a6",
  PREREQUISITE: "#eab308",
};
const RELATION_LABEL: Record<string, string> = {
  CAUSE: "导致",
  DEPEND_ON: "依赖",
  ENABLE: "促成",
  PART_OF: "属于",
  COMPARE: "对比",
  OPPOSITE: "对立",
  EXTENDS: "扩展",
  PREREQUISITE: "前提",
};

const W = 1000;
const H = 720;

export default function WorldPage() {
  const { data, isLoading, isError } = useQuery<WorldView>({
    queryKey: ["world"],
    queryFn: () => apiGet("/api/world"),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useQuery<NodeDetailView>({
    queryKey: ["world-node", selectedId],
    queryFn: () => apiGet(`/api/world/${selectedId}`),
    enabled: !!selectedId,
  });

  const positions = useMemo(() => {
    if (!data) return new Map<string, { x: number; y: number }>();
    const n = data.nodes.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const cellW = W / cols;
    const cellH = H / rows;
    const map = new Map<string, { x: number; y: number }>();
    data.nodes.forEach((node, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      map.set(node.id, {
        x: cellW * (c + 0.5),
        y: cellH * (r + 0.5),
      });
    });
    return map;
  }, [data]);

  if (isLoading) return <Skeleton className="h-[720px] w-full" />;
  if (isError) return <EmptyState title="世界图谱加载失败" />;
  if (!data || data.nodes.length === 0) return <EmptyState title="概念图谱为空" hint="完成 Mission 将逐步点亮概念。" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="p-0 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[720px] w-full">
          {data.edges.map((e) => {
            const s = positions.get(e.sourceNodeId);
            const t = positions.get(e.targetNodeId);
            if (!s || !t) return null;
            const color = RELATION_COLOR[e.relation] ?? "#94a3b8";
            return (
              <line
                key={e.id}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.5}
              />
            );
          })}
          {data.nodes.map((node) => {
            const p = positions.get(node.id)!;
            const active = selectedId === node.id;
            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onClick={() => setSelectedId(node.id)}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={active ? 10 : 7}
                  fill={active ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.55)"}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
                <text
                  x={p.x}
                  y={p.y - 14}
                  textAnchor="middle"
                  className="fill-foreground"
                  style={{ fontSize: 12, fontWeight: active ? 600 : 400 }}
                >
                  {node.title}
                </text>
              </g>
            );
          })}
        </svg>
      </Card>

      <div className="space-y-3">
        <Card>
          <CardTitle>关系图例</CardTitle>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {Object.entries(RELATION_LABEL).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: RELATION_COLOR[k] }} />
                <span className="text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
        </Card>

        {selectedId && (
          <Card className="fos-fade-in">
            {detail.isLoading && <Skeleton className="h-40 w-full" />}
            {detail.data && (
              <>
                <div className="flex items-center justify-between">
                  <CardTitle>{detail.data.title}</CardTitle>
                  <Badge tone={detail.data.learningStatus === "LEARNED" || detail.data.learningStatus === "MASTERED" ? "success" : "neutral"}>
                    {detail.data.learningStatus}
                  </Badge>
                </div>
                {detail.data.category && (
                  <p className="mt-1 text-xs text-muted-foreground">分类：{detail.data.category} · 难度 {detail.data.difficulty}/5</p>
                )}
                <article className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {detail.data.description}
                </article>
                {detail.data.relatedNodes.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">关联概念</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.data.relatedNodes.map((r) => (
                        <span key={r.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                          <span className="h-2 w-2 rounded-full" style={{ background: RELATION_COLOR[r.relation] ?? "#94a3b8" }} />
                          {r.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {!selectedId && (
          <Card>
            <p className="text-sm text-muted-foreground">点击左侧任意概念节点，查看其资料、关联与学习状态。</p>
          </Card>
        )}
      </div>
    </div>
  );
}
