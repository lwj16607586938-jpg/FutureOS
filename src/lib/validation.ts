import { z } from "zod";

// Input validation (doc 09). Zod v4.
export const answerInputSchema = z.object({
  missionId: z.string().min(1),
  order: z.coerce.number().int().min(0).max(2),
  answer: z.string().min(1, "作答不能为空").max(4000),
});

export const predictionInputSchema = z.object({
  missionId: z.string().min(1),
  content: z.string().min(1, "预测内容不能为空").max(2000),
  confidence: z.coerce.number().int().min(0).max(100),
  targetDate: z.string().min(1, "targetDate 必填"),
  tag: z.string().max(50).nullable().optional(),
});

export const completeInputSchema = z.object({
  missionId: z.string().min(1),
});

export const verifyInputSchema = z.object({
  status: z.enum(["VERIFIED", "FAILED"]),
  result: z.string().max(2000).nullable().optional(),
});

export const drillAnswerInputSchema = z.object({
  missionId: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      answer: z.string().min(1),
    })
  ),
});
