import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ZagoraResult } from "./types.ts";

export class ZagoraError extends Error {
  readonly type = "ZAGORA_ERROR" as const;
  readonly issues?: readonly StandardSchemaV1.Issue[];
  override readonly cause?: unknown;
  readonly reason: string;

  constructor(
    message: string,
    options?: {
      issues?: readonly StandardSchemaV1.Issue[];
      cause?: unknown;
      reason?: string;
    }
  ) {
    super(message);
    this.name = "ZagoraError";
    this.issues = options?.issues;
    this.cause = options?.cause;
    this.reason = options?.reason || "Unknown or internal error";
  }

  static fromIssues(issues: readonly StandardSchemaV1.Issue[]) {
    const message = issues.map((issue) => issue.message).join(", ");
    return new ZagoraError(message, {
      issues,
      reason: "Failure caused by validation",
    });
  }

  static fromCaughtError(caught: unknown, reason?: string) {
    const message = caught instanceof Error ? caught.message : String(caught);
    return new ZagoraError(reason || message, { cause: caught, reason });
  }
}

export function createDualResult<TData, TErr, TIsDefined extends boolean>(
  data: TData,
  error: TErr,
  isDefined: TIsDefined
): ZagoraResult<TData, TErr, TIsDefined> {
  const tuple = [data, error, isDefined] as [TData, TErr, TIsDefined];
  const result = tuple as ZagoraResult<TData, TErr, TIsDefined>;
  result.data = data;
  result.error = error;
  result.isDefined = isDefined;
  return result;
}
