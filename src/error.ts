import type { StandardSchemaV1 } from "@standard-schema/spec";

export class ZagoraError extends Error {
  readonly issues?: readonly StandardSchemaV1.Issue[];
  override readonly cause?: unknown;
  readonly data?: unknown;
  readonly reason: string;

  constructor(
    message: string,
    options?: {
      issues?: readonly StandardSchemaV1.Issue[];
      cause?: unknown;
      data?: unknown;
      reason?: string;
    },
  ) {
    super(message);
    this.name = "ZagoraError";
    this.issues = options?.issues;
    this.cause = options?.cause;
    this.data = options?.data;
    this.reason = options?.reason || "Unknown or internal error";
  }

  static fromIssues(
    issues: readonly StandardSchemaV1.Issue[],
    reason?: string,
    error?: any,
  ) {
    const message = issues.map((issue) => issue.message).join(", ");
    return new ZagoraError(message, {
      issues,
      reason: reason || "Failure caused by validation",
    });
  }

  static fromCaughtError(caught: unknown, reason?: string) {
    const message = caught instanceof Error ? caught.message : String(caught);
    return new ZagoraError(message, { cause: caught, reason });
  }

  static fromTypedError(key: string, errorPassedData: unknown) {
    return new ZagoraError(`Handler threw typed ${key} error`, {
      data: errorPassedData,
      reason: `Typed error thrown: ${key}`,
    });
  }
}
