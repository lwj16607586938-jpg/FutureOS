import type {
  AIProvider,
  AIContext,
  AITaskType,
  VerificationOutput,
} from "./types";
import type {
  MissionAIOutput,
  ReviewAIOutput,
  DrillAIOutput,
  PredictionAssistanceOutput,
  QuestionReviewItem,
} from "@/lib/types";

// Deterministic, offline provider. No network, no key. Returns spec-compliant JSON.
// Also serves as the FALLBACK when the real provider fails (doc 11 §14 / 决策 D1).
export class MockProvider implements AIProvider {
  readonly name = "mock";

  async generateMission(ctx: AIContext): Promise<MissionAIOutput> {
    const { concept } = ctx;
    const title = concept.title.trim();
    const estimatedMinutes = 5 + Math.min(Math.max(concept.difficulty, 1), 5);
    // req1: well-structured Markdown so the reading material is clear (## headings,
    // **bold** key terms, - lists, paragraph spacing).
    const content = [
      `## 定义`,
      `**${title}**：${concept.description}`,
      ``,
      `## 为什么重要`,
      `- 它是理解整个产业链供需与景气度的支点。`,
      `- 需求与供给的变化会沿概念图谱向下游传导，影响价格与库存周期。`,
      ``,
      `## 关键要点`,
      `- **需求**：市场愿意且能够购买的数量，决定产业景气度的方向。`,
      `- **供给**：产能、技术与资源的约束，决定弹性与瓶颈。`,
      `- **节奏**：供需错配制造周期，理解节奏才能做出可验证的判断。`,
      ``,
    ].join("\n");
    return {
      theme: title,
      learning: {
        title,
        content,
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
      `明天建议继续深耕「${theme}」相关的下一层级内容，吃透单个知识点再推进。`,
      `回顾你今天写下的预测，明确它什么时候、以什么标准可被验证。`,
      `若某道题答得吃力，说明对应能力偏weak，可让系统优先安排相关主题。`,
    ];

    const summary =
      `今天你围绕「${theme}」完成了一次完整认知训练：阅读核心资料、回答理解/推理/连接三类问题` +
      `${hasPrediction ? "、并提出一项预测" : ""}。整体聚焦且向前推进，持续积累将完善你的世界模型。`;

    // req3/req4: per-question coaching — explicit verdict, pointed error location,
    // reference answer, and a self-contained explanation (no "回看材料").
    const questionReviews = (ctx.mission?.answers ?? []).map((a, i) => {
      const userAnswer = a.answer && a.answer.trim() ? a.answer.trim() : null;
      const verdict: QuestionReviewItem["verdict"] = !userAnswer
        ? "wrong"
        : userAnswer.length >= 12
          ? "correct"
          : "partial";
      const correctAnswer =
        `**${theme}** 是产业链中连接「需求—供给—价格」的核心节点：它既代表一类具体的产业活动 / 资源 / 技术，也决定了上下游景气度如何传导。` +
        `当 ${theme} 的需求上升而供给短期无法跟上时，相关价格与景气度趋于上行；反之则下行。` +
        `判断 ${theme} 时，应同时看它的定义、它在链条中的位置，以及它会怎样改变上下游的需求、供给与价格，并用一个具体例子来验证。`;
      const diagnosis = !userAnswer
        ? `你未作答（或回答为空），缺少对「${a.question}」的关键推理。`
        : verdict === "partial"
          ? `你的回答方向对，但偏短、缺少「因为…所以…」的推理链条，未把「${theme}」与具体现象联系起来。`
          : "";
      const explanation =
        `**解析**：理解「${theme}」的关键有三点——(1) 它的定义是什么；(2) 它在产业链中处于什么位置、连接哪些上下游；` +
        `(3) 当它的需求或供给变化时，会如何沿「需求—供给—价格」链条传导，改变相关价格与景气度。` +
        `把这三点串成一条可验证的判断，就是该题的得分要点。`;
      return {
        order: i + 1,
        type: (["EXPLAIN", "REASON", "CONNECT"].includes(a.type) ? a.type : "EXPLAIN") as QuestionReviewItem["type"],
        question: a.question,
        userAnswer,
        verdict,
        diagnosis,
        correctAnswer,
        explanation,
      };
    });

    return { summary, strength, weakness, suggestion, questionReviews };
  }

  async generateDrill(ctx: AIContext): Promise<DrillAIOutput> {
    const theme = ctx.mission?.theme ?? ctx.concept.title;
    const weak = (ctx.mission?.questionReviews ?? []).filter((q) => q.verdict !== "correct");
    const target = weak.length > 0 ? weak[0] : { question: `请判断关于「${theme}」的表述`, explanation: "" };
    return {
      questions: [
        {
          id: "dq-1",
          type: "MCQ",
          question: `关于「${theme}」的核心定义，以下哪项最准确？`,
          options: [
            `A. ${theme} 是产业链中独立存在、不影响上下游的静态标签。`,
            `B. ${theme} 是与需求、供给、价格相互传导的动态机制。`,
            `C. ${theme} 仅指它的字面含义，与产业分析无关。`,
            `D. ${theme} 是一种不可验证的主观判断。`,
          ],
          correctAnswer: "B",
          explanation: `正确答案是 B。${theme} 的真正价值在于它连接需求与供给，并通过价格/景气信号传导；A、C、D 都把它当成孤立或主观的概念，忽略了产业链位置。`,
        },
        {
          id: "dq-2",
          type: "TF",
          question: `判断：当 ${theme} 的需求上升而供给短期刚性时，通常会推动相关价格或景气度上行。`,
          correctAnswer: "true",
          explanation: `正确。需求增加而供给短期无法跟上，会造成供不应求，价格与景气度趋于上行；这正是 ${theme} 影响产业链的核心路径。`,
        },
      ],
    };
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

  // Streaming: emit the SAME structured JSON the service expects to parse
  // (parseMission/parseReview call JSON.parse on the accumulated text). This
  // keeps the mock provider spec-compliant with the streaming contract while
  // still yielding in chunks for the live typewriter. The UI swaps to the
  // clean parsed content once the stream completes.
  async *streamGenerateMission(ctx: AIContext): AsyncIterable<string> {
    const m = await this.generateMission(ctx);
    yield* this.chunk(JSON.stringify(m), 24);
  }

  async *streamGenerateReview(ctx: AIContext): AsyncIterable<string> {
    const r = await this.generateReview(ctx);
    yield* this.chunk(JSON.stringify(r), 24);
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
