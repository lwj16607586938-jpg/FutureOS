"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetcher";
import { Card, CardTitle, Badge, Skeleton, EmptyState } from "@/components/ui";
import type { WorldView, WorldNodeView, NodeDetailView } from "@/lib/types";
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

const STATUS_COLOR: Record<string, string> = {
  UNKNOWN: "#cbd5e1",
  LEARNING: "#f59e0b",
  LEARNED: "#22c55e",
  MASTERED: "#15803d",
};
const STATUS_LABEL: Record<string, string> = {
  UNKNOWN: "未接触",
  LEARNING: "学习中",
  LEARNED: "已掌握",
  MASTERED: "已精通",
};

const W = 1000;
const H = 720;

/**
 * 按分类聚类的确定性布局：同一 category 的概念聚成一簇，簇中心沿大圆环排布，
 * 簇内节点用三角数环（sunflower）铺开。相比方格网，相关概念相邻、连线交叉大幅减少。
 */
function computeClusteredLayout(nodes: WorldNodeView[]) {
  const groups = new Map<string, WorldNodeView[]>();
  for (const n of nodes) {
    const key = n.category ?? "其他";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }
  const cats = [...groups.keys()];
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) * 0.3;
  const margin = 48;
  const clamp = (v: number, max: number) => Math.max(margin, Math.min(max - margin, v));
  const positions = new Map<string, { x: number; y: number }>();
  const centers: { cat: string; x: number; y: number }[] = [];

  cats.forEach((cat, ci) => {
    const members = groups.get(cat)!;
    const k = members.length;
    const angle = cats.length === 1 ? 0 : (ci / cats.length) * Math.PI * 2 - Math.PI / 2;
    const ccx = cats.length === 1 ? cx : cx + R * Math.cos(angle);
    const ccy = cats.length === 1 ? cy : cy + R * Math.sin(angle);
    centers.push({ cat, x: ccx, y: ccy });
    members.forEach((m, i) => {
      if (k === 1) {
        positions.set(m.id, { x: ccx, y: ccy });
        return;
      }
      const ring = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2);
      const idxInRing = i - (ring * (ring + 1)) / 2;
      const ringCap = ring + 1;
      const a = (idxInRing / ringCap) * Math.PI * 2 + ring * 0.5;
      const rr = 18 + ring * 28;
      positions.set(m.id, {
        x: clamp(ccx + rr * Math.cos(a), W),
        y: clamp(ccy + rr * Math.sin(a), H),
      });
    });
  });

  return { positions, centers };
}

export default function WorldPage() {
  const { data, isLoading, isError } = useQuery<WorldView>({
    queryKey: ["world"],
    queryFn: () => apiGet("/api/world"),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const detail = useQuery<NodeDetailView>({
    queryKey: ["world-node", selectedId],
    queryFn: () => apiGet(`/api/world/${selectedId}`),
    enabled: !!selectedId,
  });

  const { positions, centers } = useMemo(() => {
    if (!data) return { positions: new Map<string, { x: number; y: number }>(), centers: [] as { cat: string; x: number; y: number }[] };
    return computeClusteredLayout(data.nodes);
  }, [data]);

  const focusId = hoveredId ?? selectedId;
  const neighbors = useMemo(() => {
    const set = new Set<string>();
    if (!focusId || !data) return set;
    set.add(focusId);
    for (const e of data.edges) {
      if (e.sourceNodeId === focusId) set.add(e.targetNodeId);
      if (e.targetNodeId === focusId) set.add(e.sourceNodeId);
    }
    return set;
  }, [focusId, data]);

  if (isLoading) return <Skeleton className="h-[720px] w-full" />;
  if (isError) return <EmptyState title="世界图谱加载失败" />;
  if (!data || data.nodes.length === 0) return <EmptyState title="概念图谱为空" hint="完成 Mission 将逐步点亮概念。" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="p-0 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[720px] w-full">
          {/* 分类中心标签 */}
          {centers.map((c) => (
            <text
              key={`cat-${c.cat}`}
              x={c.x}
              y={c.y}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 13, fontWeight: 600, opacity: 0.5, pointerEvents: "none" }}
            >
              {c.cat}
            </text>
          ))}

          {/* 关系连线 */}
          {data.edges.map((e) => {
            const s = positions.get(e.sourceNodeId);
            const t = positions.get(e.targetNodeId);
            if (!s || !t) return null;
            const connected = focusId && (e.sourceNodeId === focusId || e.targetNodeId === focusId);
            const dim = focusId && !connected;
            const color = RELATION_COLOR[e.relation] ?? "#94a3b8";
            return (
              <line
                key={e.id}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={color}
                strokeWidth={connected ? 2 : 1.3}
                strokeOpacity={dim ? 0.06 : connected ? 0.85 : 0.32}
              />
            );
          })}

          {/* 概念节点 */}
          {data.nodes.map((node) => {
            const p = positions.get(node.id)!;
            const active = selectedId === node.id;
            const inFocus = !focusId || neighbors.has(node.id);
            const fill = active ? "hsl(var(--primary))" : STATUS_COLOR[node.learningStatus] ?? "#cbd5e1";
            const showLabel = node.learningStatus !== "UNKNOWN" || active;
            return (
              <g
                key={node.id}
                className="cursor-pointer"
                opacity={inFocus ? 1 : 0.22}
                onClick={() => setSelectedId(node.id)}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={active ? 11 : 7}
                  fill={fill}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
                {showLabel && (
                  <text
                    x={p.x}
                    y={p.y - 14}
                    textAnchor="middle"
                    className="fill-foreground"
                    style={{ fontSize: 12, fontWeight: active ? 600 : 400 }}
                  >
                    {node.title}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </Card>

      <div className="space-y-3">
        <Card>
          <CardTitle>学习状态</CardTitle>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[k] }} />
                <span className="text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            彩色节点是你已接触 / 掌握的概念，灰色为尚未学习的领域。悬停任一节点可高亮其关联网络。
          </p>
        </Card>

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
                    {STATUS_LABEL[detail.data.learningStatus] ?? detail.data.learningStatus}
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
                        <span key={`${r.id}-${r.relation}`} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
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
