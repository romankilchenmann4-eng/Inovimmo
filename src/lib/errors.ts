/**
 * Safe error wrapper for server actions and API routes.
 *
 * Prevents internal Supabase error messages (table names, column names,
 * constraint names) from leaking to the client. Known internal patterns
 * are sanitized to a generic message.
 */

const INTERNAL_PATTERNS = [
  "duplicate key value",
  "violates foreign key constraint",
  "violates unique constraint",
  "violates check constraint",
  "permission denied",
  "policy",
  "relation",
  "column",
  "does not exist",
];

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly internal?: string;

  constructor(message: string, statusCode: number = 500, internal?: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.internal = internal;
  }
}

/**
 * Convert an unknown error into a safe AppError.
 * Internal database errors are sanitized to a generic message.
 */
export function sanitizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const message = error instanceof Error ? error.message : "Ein Fehler ist aufgetreten";

  const isInternal = INTERNAL_PATTERNS.some((keyword) =>
    message.toLowerCase().includes(keyword)
  );

  if (isInternal) {
    console.error("Internal error sanitized:", message);
    return new AppError(
      "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
      500,
      message
    );
  }

  return new AppError(message);
}