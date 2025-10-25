import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { AnySchema, ZagoraResult } from "./zagora-v3-types.ts";

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

export const isZagoraTypedError = (error: unknown): error is ZagoraError => {
  return Boolean(
    error instanceof Error &&
      error.name === "ZagoraError" &&
      (error as any).data !== undefined,
  );
};

export function toPascalCase(str: string) {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

interface DefaultAnySchema extends StandardSchemaV1<any, any> {
  type: "any";
  message: string;
}

export function defaultAnySchema(
  message = "Invalid any value",
): DefaultAnySchema {
  return {
    type: "any",
    message,
    "~standard": {
      version: 1,
      vendor: "zagora",
      validate(value) {
        return { value, issues: undefined };
      },
    },
  };
}

// note: basic, but coverting a lot, if not just use `is-async-function` in future
export function isAsyncFunction(fn: any) {
  if (typeof fn !== "function") {
    return false;
  }

  const str = Function.prototype.toString.call(fn);

  if (str.startsWith("async")) {
    return true;
  }

  const obj = Object.prototype.toString.call(fn);

  if (obj === "[object AsyncFunction]") {
    return true;
  }

  try {
    const result = fn();
    return result instanceof Promise;
  } catch (_err: unknown) {
    return false;
  }
}

// biome-ignore lint/nursery/useMaxParams: bruh
export function generalValidator(
  schema: StandardSchemaV1,
  value: unknown,
  internal?: any,
  isOutputValidation = false,
  originalError?: ZagoraError,
):
  | { data: unknown; error: null; isDefined: boolean }
  | { data: null; error: ZagoraError; isDefined: boolean }
  | Promise<
      | { data: unknown; error: null; isDefined: boolean }
      | { data: null; error: ZagoraError; isDefined: boolean }
    > {
  const result = internal ?? schema["~standard"].validate(value);
  if (result instanceof Promise) {
    return result.then((res) => {
      return generalValidator(
        schema,
        res,
        res,
        isOutputValidation,
        originalError,
      );
    });
  }

  if (result.issues) {
    let error = ZagoraError.fromIssues(
      result.issues,
      `${isOutputValidation ? "Output" : "Options"} validation failed`,
    );

    if (originalError) {
      const key = (originalError?.data as any)?.type || "___";
      const issues = result.issues
        .map((issue: StandardSchemaV1.Issue) => issue.message)
        .join(", ");

      error = new ZagoraError(`Invalid error data for ${key}: ${issues}`, {
        issues: result.issues,
        data: value,
        // cause: originalError,
        reason: originalError.reason || originalError.message,
      });
    }

    return {
      data: null,
      error,
      isDefined: false,
    };
  }

  if (originalError) {
    // Rewrite the passed error data to the processed after validation,
    // so that it can respect defaults and options set in error schemas.
    // (originalError as any).data = result.value;

    return { data: null, error: result.value, isDefined: true };
  }

  return { data: result.value, error: null, isDefined: false };
}

export function validateInput(
  schema: StandardSchemaV1,
  rawArgs: unknown[],
  processed?: unknown[],
):
  | { data: unknown[]; error: null; isDefined: boolean }
  | { data: null; error: ZagoraError; isDefined: boolean }
  | Promise<
      | { data: unknown[]; error: null; isDefined: boolean }
      | { data: null; error: ZagoraError; isDefined: boolean }
    > {
  // Handle tuple defaults if needed
  const processedArgs = handleTupleDefaults(schema, rawArgs);
  // console.log("valibot processed tuple defaults:::", processedArgs);

  const processResult = (res: any) => {
    if (!res.issues) {
      // const validatedValue = res.value;
      // const args = Array.isArray(validatedValue)
      //   ? validatedValue
      //   : [validatedValue];

      return { data: res.value, error: null, isDefined: false };
    }

    return {
      data: null,
      error: ZagoraError.fromIssues(res.issues, "Input validation failed..."),
      isDefined: false,
    };
  };

  const schemaAny = schema as any;
  const isTupleSchema =
    (schemaAny._def && schemaAny._def.type === "tuple") ||
    schemaAny.type === "tuple";

  const isArraySchema =
    (schemaAny._def && schemaAny._def.type === "array") ||
    schemaAny.type === "array";

  const isPrimitiveSchema = !isTupleSchema;

  // console.log({
  //   isTupleSchema,
  //   isArraySchema,
  //   isPrimitiveSchema,
  // });
  let args = processedArgs as any;

  // NOTE: if z.array() then it should allow func([1,2,3]);
  // NOTE: if z.string() then func('foo');
  // NOTE: if z.tuple(z.string(), z.number()) then func('foo', 123);
  if (isPrimitiveSchema || isArraySchema) {
    args = args[0];
  }

  // Try tuple validation first
  const result = schema["~standard"].validate(args);
  if (result instanceof Promise) {
    return result.then((res) => processResult(res));
  }

  return processResult(result);
}

export function createResult<
  TOutputSchema extends AnySchema,
  TErrorsSchema extends Record<string, AnySchema>,
>(data: any, error: any, isDefined: boolean) {
  const res = [data, error, isDefined] as unknown as ZagoraResult<
    TOutputSchema,
    TErrorsSchema
  >;

  res.data = data;
  res.error = error;
  res.isDefined = isDefined;

  return res;
}

export function handleTupleDefaults(
  schema: StandardSchemaV1,
  rawArgs: unknown[],
): unknown[] {
  // Check if this might be a tuple schema by examining the schema structure
  const schemaAny = schema as any;
  const isZodTuple = schemaAny._def && schemaAny._def.type === "tuple";
  const isValibotTuple = schemaAny.type === "tuple";
  // console.log("is tuple when valibot tuple", schemaAny);

  // Try to detect if this is a StandardSchema tuple schema
  if (isZodTuple || isValibotTuple) {
    const tupleItems = schemaAny?._def?.items || schemaAny.items;

    if (tupleItems && Array.isArray(tupleItems)) {
      const result = [...rawArgs];

      // Fill in defaults for missing elements
      for (let i = rawArgs.length; i < tupleItems.length; i++) {
        const itemSchema = tupleItems[i];

        if (itemSchema && itemSchema.type === "default" && itemSchema._def) {
          // console.log("only zod");
          const defaultValue =
            typeof itemSchema._def.defaultValue === "function"
              ? itemSchema._def.defaultValue()
              : itemSchema._def.defaultValue;

          result[i] = defaultValue;
        } else if (
          itemSchema &&
          isValibotTuple &&
          itemSchema.type === "optional"
        ) {
          // console.log("only valibot");

          result[i] = itemSchema.default;
        }
      }

      // console.log("handle tuples...", result);
      return result;
    }
  }

  return rawArgs;
}

export function createErrorHelpers(
  schema: Record<string, StandardSchemaV1>,
  isAsync: boolean,
) {
  const helpers: any = {};
  for (const [key, errorSchema] of Object.entries(schema)) {
    helpers[key] = createHelper(key, errorSchema, isAsync);
  }
  return helpers;
}

export function createHelper(
  key: string,
  errorSchema: StandardSchemaV1,
  isAsync: boolean,
) {
  return (errorData: any) => {
    // NOTE: error helpers CAN also just return the error,
    // since we are handling that case too.
    // throw ZagoraError.fromTypedError(key, { type: key, ...errorData });
    return ZagoraError.fromTypedError(key, { type: key, ...errorData });
  };
}

export const handleError = (
  err: any,
  errorsSchema: Record<string, StandardSchemaV1> | undefined,
) => {
  if (errorsSchema && isZagoraTypedError(err)) {
    const key = (err.data as any).type;
    // console.log("error schema", errorsSchema[key].def.shape);
    return generalValidator(
      errorsSchema[key] as StandardSchemaV1,
      err.data,
      null,
      false,
      err,
    );
  }

  return null;
};
