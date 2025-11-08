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
}
