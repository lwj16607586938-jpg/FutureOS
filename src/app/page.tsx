"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, streamPost } from "@/lib/fetcher";
import { todayStr } from "@/lib/utils";
import { Button, Card, CardTitle, Badge, Textarea, Input, Skeleton, EmptyState } from "@/components/ui";
import type { MissionView, QuestionView, QuestionReviewItem, DrillQuestion } from "@/lib/types";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const STAGE_LABEL: Record<string, string> = {
  CREATED: "未开始",
  STARTED: "已生成",
  LEARNING: "阅读",
  THINKING: "思考",
  PREDICTION: "预测",
  REVIEW: "复盘",
  COMPLETED: "已完成",
};

export default function TodayPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery<MissionView>({
    queryKey: ["today"],
    queryFn: () => apiGet("/api/mission/today"),
  });

  const refetch = () => qc.invalidateQueries({ queryKey: ["today"] });

  // Live "typewriter" state for streaming generation (start / complete).
  const [stream, setStream] = useState<{ phase: "mission" | "review"; text: string } | null>(null);

  const handleStart = async () => {
    setStream({ phase: "mission", text: "" });
    try {
      await streamPost("/api/mission/start/stream", {}, (d) =>
        setStream((s) => (s ? { ...s, text: s.text + d } : s))
      );
    } catch {
      try {
        await apiSend("/api/mission/start", "POST", {});
      } catch {
        /* ignore */
      }
    } finally {
      setStream(null);
      refetch();
    }
  };

  const handleComplete = async (missionId: string) => {
    setStream({ phase: "review", text: "" });
    try {
      await streamPost("/api/mission/complete/stream", { missionId }, (d) =>
        setStream((s) => (s ? { ...s, text: s.text + d } : s))
      );
    } catch {
      try {
        await apiSend("/api/mission/complete", "POST", { missionId });
      } catch {
        /* ignore */
      }
    } finally {
      setStream(null);
      refetch();
    }
  };

  const thinking = useMutation({
    mutationFn: (missionId: string) => apiSend("/api/mission/thinking", "POST", { missionId }),
    onSuccess: refetch,
  });
  const answer = useMutation({
    mutationFn: (b: { missionId: string; order: number; answer: string }) =>
      apiSend("/api/mission/answer", "POST", b),
    onSuccess: refetch,
  });
  const predict = useMutation({
    mutationFn: (b: { missionId: string; content: string; confidence: number; targetDate: string }) =>
      apiSend("/api/mission/prediction", "POST", b),
    onSuccess: refetch,
  });

  if (isLoading) return <TodaySkeleton />;
  if (isError) return <EmptyState title="加载失败" hint={(error as Error).message} />;
  if (!data) return null;

  const m = data;

  // 跨天续作：若这场任务还没完成、且创建日期不是今天，说明是「上次没做完的」。
  const today = todayStr();
  const isResuming = m.status !== "COMPLETED" && m.date && m.date !== today;
  const resumeHint = isResuming ? `起始于 ${m.date}，你还没做完` : null;

  // Burst mode: while streaming a fresh mission, show the typewriter regardless
  // of the latest mission's status (which may still be COMPLETED from a prior round).
  if (stream?.phase === "mission") {
    return <ThoughtStream text={stream.text} label="AI 正在生成新一场 Mission…" />;
  }

  if (m.status === "COMPLETED") {
    return <CompletedView mission={m} onAgain={handleStart} />;
  }

  if (m.stage === "DRILL") {
    return <DrillView mission={m} onChange={refetch} />;
  }

  if (m.stage === "CREATED" || m.stage === "STARTED") {
    return (
      <div className="reading-col mx-auto">
        {resumeHint && <ResumeBanner date={m.date} />}
        <Card className="fos-fade-in">
          <CardTitle>{resumeHint ? "继续上次的 Mission" : "今天的 Mission"}</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            一次聚焦式认知训练：阅读一个概念，回答理解 / 推理 / 连接三类问题，做出一项预测，并获得 AI 复盘。状态好可连做多场。
          </p>
          <Button className="mt-4" size="lg" onClick={() => handleStart()}>
            {resumeHint ? "继续上次的练习 →" : "开始一场 Mission"}
          </Button>
        </Card>
      </div>
    );
  }

  // LEARNING
  if (m.stage === "LEARNING" && m.learning) {
    return (
      <div className="reading-col mx-auto">
        <Card className="fos-fade-in">
          <div className="flex items-center justify-between">
            <CardTitle>{m.learning.title}</CardTitle>
            <Badge tone="primary">约 {m.learning.estimatedMinutes} 分钟</Badge>
          </div>
          {/* req1: render learning material as structured Markdown */}
          <article className="prose-reading mt-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.learning.content}</ReactMarkdown>
          </article>
          <Button className="mt-5" size="lg" onClick={() => thinking.mutate(m.missionId)} disabled={thinking.isPending}>
            读完，开始思考 →
          </Button>
        </Card>
      </div>
    );
  }

  // THINKING / PREDICTION (question + prediction flow)
  return (
    <ThinkingFlow
      mission={m}
      onAnswer={(order, ans) => answer.mutate({ missionId: m.missionId, order, answer: ans })}
      answering={answer.isPending}
      onPredict={(content, confidence, targetDate) =>
        predict.mutate({ missionId: m.missionId, content, confidence, targetDate })
      }
      predicting={predict.isPending}
      onComplete={() => handleComplete(m.missionId)}
      completing={stream?.phase === "review"}
      streamText={stream?.phase === "review" ? stream.text : ""}
    />
  );
}

function ThinkingFlow({
  mission,
  onAnswer,
  answering,
  onPredict,
  predicting,
  onComplete,
  completing,
  streamText,
}: {
  mission: MissionView;
  onAnswer: (order: number, answer: string) => void;
  answering: boolean;
  onPredict: (content: string, confidence: number, targetDate: string) => void;
  predicting: boolean;
  onComplete: () => void;
  completing: boolean;
  streamText?: string;
}) {
  const qs: QuestionView[] = mission.questions ?? [];
  const answeredCount = qs.filter((q) => q.answer && q.answer.trim()).length;
  const activeIndex = Math.min(qs.findIndex((q) => !q.answer || !q.answer.trim()), qs.length - 1);
  // req2: prediction is only required at the final tier; earlier tiers go
  // straight to "finish" (complete without prediction).
  const showPrediction = (mission.tier ?? 1) >= (mission.tierCount ?? 1);
  const phase: "questions" | "predict" | "finish" =
    answeredCount >= 3 || mission.stage === "PREDICTION" || mission.stage === "REVIEW"
      ? showPrediction
        ? "predict"
        : "finish"
      : "questions";

  const [draft, setDraft] = useState("");
  const [pred, setPred] = useState("");
  const [confidence, setConfidence] = useState(60);
  const [target, setTarget] = useState(() => {
    const d = new Date(Date.now() + 30 * 86400000);
    return d.toISOString().slice(0, 10);
  });

  return (
    <div className="reading-col mx-auto space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge tone="primary">{STAGE_LABEL[mission.stage]}</Badge>
        <span>
          进度 {answeredCount}/{qs.length} 题 · L{mission.tier ?? 1}/{mission.tierCount ?? 1}
          {mission.prediction ? " · 已预测" : ""}
        </span>
      </div>

      {phase === "questions" && qs[activeIndex] && (
        <Card className="fos-fade-in">
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{qs[activeIndex].type}</Badge>
            <span className="text-xs text-muted-foreground">第 {activeIndex + 1} / {qs.length} 题</span>
          </div>
          <p className="mt-3 text-[15px] leading-7 text-foreground">{qs[activeIndex].question}</p>
          <Textarea
            className="mt-4 min-h-28"
            placeholder="写下你的思考…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button
            className="mt-3"
            disabled={answering || draft.trim().length === 0}
            onClick={() => {
              onAnswer(qs[activeIndex].order, draft.trim());
              setDraft("");
            }}
          >
            {answering ? "保存中…" : activeIndex < qs.length - 1 ? "下一题 →" : "完成思考 →"}
          </Button>
        </Card>
      )}

      {phase === "predict" && (
        <Card className="fos-fade-in">
          <CardTitle>做出一项预测</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            AI 不替你预测。基于今天的主题「{mission.theme}」，写下你对其未来走向的判断，并设定可验证的时间点。
          </p>
          <Textarea
            className="mt-3 min-h-24"
            placeholder="例如：到 2026 年底，HBM 供给仍将偏紧，三大厂产能利用率维持高位。"
            value={pred}
            onChange={(e) => setPred(e.target.value)}
          />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">置信度：{confidence}%</label>
              <input
                type="range"
                min={0}
                max={100}
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="w-full accent-[hsl(var(--primary))]"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">验证日期</label>
              <Input type="date" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1" />
            </div>
          </div>
          {completing ? (
            <ThoughtStream text={streamText ?? ""} label="AI 正在生成复盘…" />
          ) : (
            <div className="mt-4 flex gap-2">
              <Button
                disabled={predicting || pred.trim().length === 0}
                onClick={() => onPredict(pred.trim(), confidence, target)}
              >
                {predicting ? "提交中…" : "提交预测 →"}
              </Button>
              {mission.prediction && (
                <Button variant="secondary" onClick={onComplete}>
                  完成 Mission
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {phase === "finish" && (
        <Card className="fos-fade-in">
          <CardTitle>完成本场 Mission</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {showPrediction
              ? "已提交预测，可以生成复盘并完成。"
              : `本级别（L${mission.tier ?? 1}）为基础层级，无需预测。完成后系统会继续带你吃透「${mission.theme}」的下一层级（L${(mission.tier ?? 1) + 1}）。`}
          </p>
          {completing ? (
            <ThoughtStream text={streamText ?? ""} label="AI 正在生成复盘…" />
          ) : (
            <div className="mt-4 flex gap-2">
              <Button onClick={onComplete}>完成 Mission</Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function ResumeBanner({ date }: { date: string }) {
  return (
    <div className="fos-fade-in mb-4 flex items-start gap-3 rounded-xl border-l-4 border-primary bg-primary/10 p-4">
      <span className="text-lg">🔁</span>
      <div>
        <p className="text-sm font-semibold text-foreground">你有一场没做完的练习</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          它起始于 <span className="font-medium text-foreground">{date}</span>。进度已自动保存，无需从头开始——
          点「继续」就能接着往下做，做完才算完成。
        </p>
      </div>
    </div>
  );
}

function CompletedView({ mission, onAgain }: { mission: MissionView; onAgain?: () => void }) {
  return (
    <div className="reading-col mx-auto space-y-4">
      <Card className="fos-fade-in border-success/40">
        <div className="flex items-center gap-2">
          <Badge tone="success">已完成</Badge>
          <span className="text-sm text-muted-foreground">{mission.date}</span>
          <Link href="/archive" className="ml-auto text-xs font-medium text-primary hover:underline">
            查看我的全部档案 →
          </Link>
        </div>
        <CardTitle className="mt-2">本场主题：{mission.theme}</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          一次完整的认知训练已记录。能力模型与世界模型已更新，可在「成长」查看；你的全部回答/思考/预测已归档于「档案」。
        </p>
      </Card>

      {mission.review && (
        <Card>
          <CardTitle>AI 复盘</CardTitle>
          <p className="mt-2 text-sm leading-7 text-foreground">{mission.review.summary}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <ReviewCol title="优势" items={mission.review.strength} tone="success" />
            <ReviewCol title="待加强" items={mission.review.weakness} tone="warning" />
            <ReviewCol title="建议" items={mission.review.suggestion} tone="primary" />
          </div>
        </Card>
      )}

      {mission.questionReviews && mission.questionReviews.length > 0 && (
        <Card>
          <CardTitle>逐题讲评</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            每道题都给出你的答案、判定、参考答案与完整讲解（无需回看材料）。
          </p>
          <div className="mt-3 space-y-4">
            {mission.questionReviews.map((qr) => (
              <QuestionReviewCard key={qr.order} item={qr} />
            ))}
          </div>
        </Card>
      )}

      {mission.prediction && (
        <Card>
          <CardTitle>你的预测</CardTitle>
          <p className="mt-2 text-sm leading-7 text-foreground">{mission.prediction.content}</p>
          <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
            <span>置信度 {mission.prediction.confidence}%</span>
            <span>· 验证于 {mission.prediction.targetDate.slice(0, 10)}</span>
            <Badge tone={mission.prediction.status === "PENDING" ? "warning" : "success"}>
              {mission.prediction.status}
            </Badge>
          </div>
        </Card>
      )}

      {onAgain && (
        <Card className="fos-fade-in border-primary/30">
          <p className="text-sm text-muted-foreground">
            状态不错，再来一场？教练会挑一个你还没吃透的概念，连做多场成长更快。
          </p>
          <Button className="mt-3" size="lg" onClick={onAgain}>
            再来一场 →
          </Button>
        </Card>
      )}
    </div>
  );
}

function ReviewCol({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warning" | "primary" }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1.5">
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

function QuestionReviewCard({ item }: { item: QuestionReviewItem }) {
  const verdictMeta = {
    correct: { label: "答对", tone: "success" as const },
    partial: { label: "部分正确", tone: "warning" as const },
    wrong: { label: "答错", tone: "error" as const },
  }[item.verdict];
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{item.type}</Badge>
        <span className="text-sm font-medium text-foreground">第 {item.order} 题</span>
        <Badge tone={verdictMeta.tone}>{verdictMeta.label}</Badge>
      </div>
      <p className="mt-3 text-[15px] font-medium leading-7 text-foreground">{item.question}</p>

      <div className="mt-3 rounded-lg bg-muted/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">你的答案</p>
        <p className="mt-1 text-sm leading-6 text-foreground">
          {item.userAnswer && item.userAnswer.trim() ? item.userAnswer : "（未作答）"}
        </p>
      </div>

      {item.verdict !== "correct" && item.diagnosis && (
        <div className="mt-3 rounded-lg border-l-4 border-error bg-error/10 p-3 text-sm leading-6 text-error">
          <span className="font-semibold">错在哪里：</span>
          {item.diagnosis}
        </div>
      )}

      <div className="mt-3 rounded-lg border-l-4 border-primary bg-background p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">参考答案</p>
        <div className="prose-reading mt-1 text-sm leading-6 text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.correctAnswer || "（暂无参考答案）"}</ReactMarkdown>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">讲解</p>
        <div className="prose-reading mt-1 text-sm leading-6 text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.explanation || "暂无讲解。"}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function DrillView({ mission, onChange }: { mission: MissionView; onChange: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    mission.drillQuestions.forEach((q) => {
      if (q.userAnswer) init[q.id] = q.userAnswer;
    });
    return init;
  });
  const submit = useMutation({
    mutationFn: (b: { missionId: string; answers: { questionId: string; answer: string }[] }) =>
      apiSend("/api/mission/drill", "POST", b),
    onSuccess: onChange,
  });

  const questions = mission.drillQuestions;
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]?.trim());
  const hasSubmitted = questions.some((q) => q.isCorrect != null);

  const handleSubmit = () => {
    submit.mutate({
      missionId: mission.missionId,
      answers: questions.map((q) => ({ questionId: q.id, answer: answers[q.id] || "" })),
    });
  };

  const isResuming = !!mission.date && mission.date !== todayStr();
  return (
    <div className="reading-col mx-auto space-y-4">
      {isResuming && <ResumeBanner date={mission.date} />}
      <Card className="fos-fade-in border-warning/40">
        <div className="flex items-center gap-2">
          <Badge tone="warning">需要再练练</Badge>
          <span className="text-sm text-muted-foreground">{mission.date}</span>
        </div>
        <CardTitle className="mt-2">先吃透「{mission.theme}」，再完成本场</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          下面是你刚才的复盘，以及针对薄弱点的选择题/判断题。全部答对即可通关。
        </p>
      </Card>

      {mission.review && (
        <Card>
          <CardTitle>AI 复盘</CardTitle>
          <p className="mt-2 text-sm leading-7 text-foreground">{mission.review.summary}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <ReviewCol title="优势" items={mission.review.strength} tone="success" />
            <ReviewCol title="待加强" items={mission.review.weakness} tone="warning" />
            <ReviewCol title="建议" items={mission.review.suggestion} tone="primary" />
          </div>
        </Card>
      )}

      {mission.questionReviews.length > 0 && (
        <Card>
          <CardTitle>逐题讲评</CardTitle>
          <div className="mt-3 space-y-4">
            {mission.questionReviews.map((qr) => (
              <QuestionReviewCard key={qr.order} item={qr} />
            ))}
          </div>
        </Card>
      )}

      <Card className="fos-fade-in border-primary/30">
        <CardTitle>追问练习</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">每道题只有一个最佳选项，答错会显示解析，请修改后继续。</p>
        <div className="mt-4 space-y-5">
          {questions.map((q, idx) => (
            <DrillQuestionCard
              key={q.id}
              index={idx + 1}
              q={q}
              value={answers[q.id] || ""}
              onSelect={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
            />
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={handleSubmit} disabled={!allAnswered || submit.isPending}>
            {submit.isPending ? "提交中…" : hasSubmitted ? "继续追问" : "提交答案"}
          </Button>
          {!allAnswered && <span className="text-xs text-muted-foreground">请先答完所有题目</span>}
        </div>
      </Card>
    </div>
  );
}

function DrillQuestionCard({
  index,
  q,
  value,
  onSelect,
}: {
  index: number;
  q: DrillQuestion;
  value: string;
  onSelect: (v: string) => void;
}) {
  const isLocked = q.isCorrect === true;
  const showError = q.isCorrect === false;
  return (
    <div className={`rounded-xl border p-4 ${showError ? "border-error bg-error/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2">
        <Badge tone={isLocked ? "success" : showError ? "error" : "primary"}>Q{index}</Badge>
        <span className="text-sm font-medium text-foreground">{q.question}</span>
      </div>
      {q.type === "MCQ" && q.options && (
        <div className="mt-3 space-y-2">
          {q.options.map((opt) => {
            const letter = opt.trim().charAt(0);
            const selected = value.toUpperCase() === letter.toUpperCase();
            return (
              <label
                key={opt}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  selected ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted/50"
                } ${isLocked ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <input
                  type="radio"
                  name={q.id}
                  value={letter}
                  checked={selected}
                  disabled={isLocked}
                  onChange={() => onSelect(letter)}
                  className="mt-1"
                />
                <span className="text-sm leading-6 text-foreground">{opt}</span>
              </label>
            );
          })}
        </div>
      )}
      {q.type === "TF" && (
        <div className="mt-3 flex gap-3">
          {[
            { label: "正确", v: "true" },
            { label: "错误", v: "false" },
          ].map(({ label, v }) => {
            const selected = value.toLowerCase() === v;
            return (
              <Button
                key={v}
                variant={selected ? "primary" : "outline"}
                disabled={isLocked}
                onClick={() => onSelect(v)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      )}
      {showError && q.explanation && (
        <div className="mt-3 text-sm leading-6 text-error">
          <span className="font-semibold">解析：</span>
          {q.explanation}
        </div>
      )}
    </div>
  );
}

function ThoughtStream({ text, label }: { text: string; label: string }) {
  // Strip markdown code fences the model sometimes wraps around its JSON.
  const clean = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  return (
    <div className="reading-col mx-auto">
      <Card className="fos-fade-in border-primary/30">
        <div className="flex items-center gap-2">
          <Badge tone="primary">{label}</Badge>
          <span className="text-xs text-muted-foreground">实时生成中</span>
        </div>
        <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-foreground/90">
          {clean}
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
        </pre>
      </Card>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="reading-col mx-auto space-y-4">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
