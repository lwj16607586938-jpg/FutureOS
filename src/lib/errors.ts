// Unified error model (doc 08 §15 / doc 16 §14). Never throw raw strings.
export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "MISSION_NOT_FOUND"
  | "MISSION_COMPLETED"
  | "MISSION_EXISTS"
  | "PREDICTION_EXISTS"
  | "KNOWLEDGE_NOT_FOUND"
  | "DATABASE_ERROR"
  | "AI_TIMEOUT"
  | "AI_ERROR"
  | "UNKNOWN_ERROR";

export class AppError extends Error {
  code: AppErrorCode;
  status: number;
  constructor(code: AppErrorCode, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(code: AppErrorCode, message: string) {
    super(code, message, 404);
  }
}

export class BusinessError extends AppError {
  constructor(code: AppErrorCode, message: string) {
    super(code, message, 409);
  }
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  return new AppError("UNKNOWN_ERROR", e instanceof Error ? e.message : "Unknown error", 500);
}
