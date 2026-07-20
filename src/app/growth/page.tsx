"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/fetcher";
import { Card, CardTitle, Skeleton, EmptyState } from "@/components/ui";
import type { GrowthView, AbilityScores } from "@/lib/types";

const DIMS: { key: keyof AbilityScores; label: string }[] = [
  { key: "observe", label: "观察" },
  { key: "understand", label: "理解" },
  { key: "connect", label: "连接" },
  { key: "reason", label: "推理" },
  { key: "predict", label: "预测" },
  { key: "update", label: "修正" },
];

export default function GrowthPage() {
  const { data, isLoading, isError } = useQuery<GrowthView>({
    queryKey: ["growth"],
    queryFn: () => apiGet("/api/growth"),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError) return <EmptyState title="成长数据加载失败" />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="认知成长分 CGS" value={String(data.cgs)} highlight />
        <Stat label="已完成 Mission" value={String(data.missionCount)} />
        <Stat label="当前连续天数" value={String(data.currentStreak)} />
        <Stat label="最长连续天数" value={String(data.longestStreak)} />
        <Stat label="预测总数" value={String(data.predictionCount)} />
        <Stat label="已掌握概念" value={String(data.knowledgeCount)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>能力雷达</CardTitle>
          <RadarChart ability={data.ability} />
        </Card>
        <Card>
          <CardTitle>CGS 趋势</CardTitle>
          <TrendChart trend={data.trend} />
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40" : ""}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    </Card>
  );
}

function RadarChart({ ability }: { ability: AbilityScores }) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 36;
  const n = DIMS.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, r: number) => ({
    x: cx + Math.cos(angle(i)) * r,
    y: cy + Math.sin(angle(i)) * r,
  });
  const grid = [0.25, 0.5, 0.75, 1].map((g) =>
    DIMS.map((_, i) => point(i, R * g)).map((p) => `${p.x},${p.y}`).join(" ")
  );
  const dataPts = DIMS.map((d, i) => point(i, (R * Math.max(0, Math.min(100, ability[d.key]))) / 100))
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto mt-2 h-[280px] w-[280px]">
      {grid.map((g, i) => (
        <polygon key={i} points={g} fill="none" stroke="hsl(var(--border))" strokeWidth={1} />
      ))}
      {DIMS.map((d, i) => {
        const p = point(i, R);
        const lp = point(i, R + 16);
        return (
          <g key={d.key}>
            <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="hsl(var(--border))" strokeWidth={1} />
            <text x={lp.x} y={lp.y} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
              {d.label}
            </text>
            <text x={lp.x} y={lp.y + 13} textAnchor="middle" className="fill-foreground" style={{ fontSize: 10, fontWeight: 600 }}>
              {ability[d.key]}
            </text>
          </g>
        );
      })}
      <polygon points={dataPts} fill="hsl(var(--primary) / 0.25)" stroke="hsl(var(--primary))" strokeWidth={2} />
    </svg>
  );
}

function TrendChart({ trend }: { trend: { date: string; cgs: number }[] }) {
  const w = 520;
  const h = 240;
  const pad = 32;
  if (!trend || trend.length === 0) return <p className="mt-4 text-sm text-muted-foreground">暂无趋势数据。</p>;
  const max = 100;
  const min = 0;
  const n = trend.length;
  const x = (i: number) => pad + ((w - pad * 2) * i) / Math.max(1, n - 1);
  const y = (v: number) => h - pad - ((h - pad * 2) * (v - min)) / (max - min);
  const line = trend.map((t, i) => `${x(i)},${y(t.cgs)}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${x(n - 1)},${h - pad}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-[240px] w-full">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={pad} y1={y(v)} x2={w - pad} y2={y(v)} stroke="hsl(var(--border))" strokeWidth={1} />
          <text x={4} y={y(v) + 4} className="fill-muted-foreground" style={{ fontSize: 10 }}>
            {v}
          </text>
        </g>
      ))}
      <polygon points={area} fill="hsl(var(--primary) / 0.12)" />
      <polyline points={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
      {trend.map((t, i) =>
        i % Math.ceil(n / 6) === 0 ? (
          <text key={i} x={x(i)} y={h - 10} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9 }}>
            {t.date.slice(5)}
          </text>
        ) : null
      )}
    </svg>
  );
}
