import type {
  AIProvider,
  AIContext,
  AITaskType,
  VerificationOutput,
} from "./types";
import type {
  MissionAIOutput,
  ReviewAIOutput,
  PredictionAssistanceOutput,
} from "@/lib/types";

// Deterministic, offline provider. No network, no key. Returns spec-compliant JSON.
// Also serves as the FALLBACK when the real provider fails (doc 11 §14 / 决策 D1).
export class MockProvider implements AIProvider {
  readonly name = "mock";

  async generateMission(ctx: AIContext): Promise<MissionAIOutput> {
    const { concept } = ctx;
    const title = concept.title.trim();
    const estimatedMinutes = 5 + Math.min(Math.max(concept.difficulty, 1), 5);
    return {
      theme: title,
      learning: {
        title,
        content: concept.description,
        estimatedMinutes,
      },
      questions: this.buildQuestions(title),
    };
  }

  async generateQuestions(ctx: AIContext): Promise<MissionAIOutput["questions"]> {
    return this.buildQuestions(ctx.concept.title.trim());
  }

  async generateReview(ctx: AIContext): Promise<ReviewAIOutput> {
    const theme = ctx.mission?.theme ?? ctx.concept.title;
    const answered = ctx.mission?.answers.filter((a) => a.answer && a.answer.trim()) ?? [];
    const hasPrediction = !!ctx.mission?.prediction;

    const strength: string[] = [
      `围绕单一主题「${theme}」完成聚焦式认知训练，符合 FutureOS 的深度学习原则。`,
      `完成了「理解—推理—连接」三阶思考，共作答 ${answered.length} 道问题。`,
    ];
    if (hasPrediction) strength.push(`敢于对「${theme}」形成可验证的预测，这是 Predict 能力的主动训练。`);

    const weakness: string[] = [
      `连接（Connect）维度仍可加强：尝试把「${theme}」与你更远的领域（如经济、社会、历史）建立关系。`,
      `推理（Reason）链条可更具体：多用「因为…所以…」的结构支撑结论。`,
    ];

    const suggestion: string[] = [
      `明天建议学习与「${theme}」相邻的下一概念，沿概念图谱向前推进。`,
      `回顾你今天写下的预测，明确它什么时候、以什么标准可被验证。`,
      `若某道题答得吃力，说明对应能力偏weak，可让系统优先安排相关主题。`,
    ];

    const summary =
      `今天你围绕「${theme}」完成了一次完整认知训练：阅读核心资料、回答理解/推理/连接三类问题` +
      `${hasPrediction ? "、并提出一项预测" : ""}。整体聚焦且向前推进，持续积累将完善你的世界模型。`;

    return { summary, strength, weakness, suggestion };
  }

  async generateSuggestion(ctx: AIContext): Promise<string[]> {
    const theme = ctx.mission?.theme ?? ctx.concept.title;
    return [
      `继续沿「${theme}」向外扩展：找出它的上游依赖与下游影响。`,
      `用一个生活或工作中的例子解释「${theme}」，检验是否真正理解。`,
    ];
  }

  async assistPrediction(ctx: AIContext): Promise<PredictionAssistanceOutput> {
    const recent = ctx.recentThemes.filter(Boolean);
    const historyNotes =
      recent.length > 0
        ? [`你最近围绕这些主题学习过：${recent.slice(0, 5).join("、")}。预测可与之呼应或形成对比。`]
        : [`这是你较早的学习阶段，预测可以大胆一些，重点是建立「可验证」的意识。`];

    const riskHints = [
      `好预测应在明确的时间点前可被验证（建议 targetDate 在 30–180 天内）。`,
      `区分「事实预测」（可证伪）与「价值判断」（见仁见智），前者更利于训练 Predict 能力。`,
      `写下你做出该预测的隐含前提，未来验证时即可判断是预测错还是前提变。`,
    ];
    return { historyNotes, riskHints };
  }

  // Streaming: emit the deterministic text in small chunks so the UI still
  // shows a live typewriter even fully offline.
  async *streamGenerateMission(ctx: AIContext): AsyncIterable<string> {
    const m = await this.generateMission(ctx);
    const text =
      `主题：${m.theme}\n\n` +
      `${m.learning.content}\n\n` +
      m.questions.map((q, i) => `Q${i + 1}[${q.type}] ${q.content}`).join("\n");
    yield* this.chunk(text, 24);
  }

  async *streamGenerateReview(ctx: AIContext): AsyncIterable<string> {
    const r = await this.generateReview(ctx);
    const text =
      `${r.summary}\n\n` +
      `优势：\n${r.strength.map((s) => `- ${s}`).join("\n")}\n\n` +
      `待加强：\n${r.weakness.map((s) => `- ${s}`).join("\n")}\n\n` +
      `建议：\n${r.suggestion.map((s) => `- ${s}`).join("\n")}`;
    yield* this.chunk(text, 24);
  }

  // Offline: cannot judge a real prediction, so return null → caller skips.
  async generateVerification(_ctx: AIContext): Promise<VerificationOutput | null> {
    return null;
  }

  private async *chunk(text: string, size: number): AsyncIterable<string> {
    for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
  }

  private buildQuestions(title: string): MissionAIOutput["questions"] {
    return [
      {
        type: "EXPLAIN",
        content: `请用你自己的话解释「${title}」是什么，它的核心作用或定义是什么？`,
      },
      {
        type: "REASON",
        content: `为什么「${title}」重要？它的存在解决了什么问题，或带来了哪些关键变化？`,
      },
      {
        type: "CONNECT",
        content: `「${title}」与你已知的哪些概念相关？它们之间是依赖、促成、因果还是对比关系？`,
      },
    ];
  }
}

export const _TASK_TYPES: AITaskType[] = [
  "MISSION",
  "QUESTION",
  "REVIEW",
  "SUGGESTION",
  "PREDICTION_ASSISTANCE",
];
