export class AppError extends Error {
  readonly cause?: unknown;

  constructor(
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.cause = cause;
  }
}

export function toAppError(error: unknown, fallbackMessage: string): AppError {
  if (error instanceof AppError) return error;
  return new AppError(fallbackMessage, error);
}
