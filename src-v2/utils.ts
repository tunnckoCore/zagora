import type { StandardSchemaV1 } from "@standard-schema/spec";
import { ZagoraError } from "./error";
import type {
  AnyContext,
  AnySchema,
  InferSchemaInput,
  StoredMiddleware,
} from "./types";

export const isZagoraTypedError = (error: unknown): error is ZagoraError => {
  return Boolean(
    error instanceof Error &&
      error.name === "ZagoraError" &&
      (error as any).data !== undefined,
  );
};

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

  if ((result as any).issues) {
    let error = ZagoraError.fromIssues(
      (result as any).issues,
      `${isOutputValidation ? "Output" : "Options"} validation failed`,
    );

    if (originalError) {
      const key = (originalError?.data as any)?.type || "___";
      const issues = (result as any).issues
        .map((issue: StandardSchemaV1.Issue) => issue.message)
        .join(", ");

      error = new ZagoraError(`Invalid error data for ${key}: ${issues}`, {
        issues: (result as any).issues,
        data: value as InferSchemaInput<typeof schema>,
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
    return { data: null, error: (result as any).value, isDefined: true };
  }

  return { data: (result as any).value, error: null, isDefined: false };
}

export function validateInput(
  schema: StandardSchemaV1,
  rawArgs: unknown[],
):
  | { data: unknown[]; error: null; isDefined: boolean }
  | { data: null; error: ZagoraError; isDefined: boolean }
  | Promise<
      | { data: unknown[]; error: null; isDefined: boolean }
      | { data: null; error: ZagoraError; isDefined: boolean }
    > {
  const processedArgs = handleTupleDefaults(schema, rawArgs);

  const processResult = (res: any) => {
    if (!res.issues) {
      return { data: res.value, error: null, isDefined: false };
    }

    return {
      data: null,
      error: ZagoraError.fromIssues(res.issues, "Input validation failed"),
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

  let args = processedArgs as any;

  if (isPrimitiveSchema || isArraySchema) {
    args = args[0];
  }

  const result = schema["~standard"].validate(args);

  if (result instanceof Promise) {
    return result.then((res) => processResult(res));
  }

  return processResult(result);
}

export function createResult(data: any, error: any, isDefined: boolean) {
  const res = [data, error, isDefined] as any;
  res.data = data;
  res.error = error;
  res.isDefined = isDefined;
  return res;
}

function handleTupleDefaults(
  schema: StandardSchemaV1,
  rawArgs: unknown[],
): unknown[] {
  const schemaAny = schema as any;
  const isZodTuple = schemaAny._def && schemaAny._def.type === "tuple";
  const isValibotTuple = schemaAny.type === "tuple" && !isZodTuple;

  if (isZodTuple || isValibotTuple) {
    const tupleItems = schemaAny?._def?.items || schemaAny.items;

    if (tupleItems && Array.isArray(tupleItems)) {
      const result = [...rawArgs];

      for (let i = rawArgs.length; i < tupleItems.length; i++) {
        const itemSchema = tupleItems[i];

        if (itemSchema && itemSchema.type === "default" && itemSchema._def) {
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
          result[i] = itemSchema.default;
        }
      }

      return result;
    }
  }

  return rawArgs;
}

export function createErrorHelpers(schema: Record<string, StandardSchemaV1>) {
  const helpers: any = {};
  for (const [key] of Object.entries(schema)) {
    helpers[key] = (errorData: any) => {
      return { type: key, ...errorData };
    };
  }
  return helpers;
}

export const handleError = (
  err: any,
  errorsSchema: Record<string, StandardSchemaV1> | undefined,
) => {
  if (!errorsSchema) return null;

  if (
    err &&
    typeof err === "object" &&
    "type" in err &&
    typeof err.type === "string" &&
    !isZagoraTypedError(err)
  ) {
    const errorType = err.type;
    if (errorType in errorsSchema) {
      const schema = errorsSchema[errorType] as any;
      const result = schema["~standard"].validate(err);

      if (result instanceof Promise) {
        return result.then((res: any) => {
          if (res.issues) {
            return {
              data: null,
              error: ZagoraError.fromIssues(
                res.issues,
                `Invalid error data for ${errorType}`,
              ),
              isDefined: false,
            };
          }
          return { data: null, error: res.value, isDefined: true };
        });
      }

      if ((result as any).issues) {
        return {
          data: null,
          error: ZagoraError.fromIssues(
            (result as any).issues,
            `Invalid error data for ${errorType}`,
          ),
          isDefined: false,
        };
      }

      return { data: null, error: (result as any).value, isDefined: true };
    }
  }

  return null;
};

export async function executeMiddlewares<TContext extends AnyContext>(
  middlewares: StoredMiddleware<any, any, any, any>[],
  initialContext: TContext,
  fullInput?: any,
  errors?: any,
): Promise<TContext> {
  if (middlewares.length === 0) {
    return initialContext;
  }

  let currentContext = initialContext;
  let currentInput = fullInput;
  let index = 0;

  const next = async (args?: {
    context?: TContext;
    input?: any;
  }): Promise<void> => {
    if (args?.context !== undefined) {
      currentContext = args.context;
    }
    if (args?.input !== undefined) {
      currentInput = args.input;
    }
    index++;

    if (index < middlewares.length && middlewares[index]) {
      await executeSingleMiddleware(
        middlewares[index]!,
        currentContext,
        currentInput,
        errors,
        next,
      );
    }
  };

  const firstMw = middlewares[0];
  if (firstMw) {
    await executeSingleMiddleware(
      firstMw,
      currentContext,
      currentInput,
      errors,
      next,
    );
  }

  return currentContext;
}

async function executeSingleMiddleware<TContext extends AnyContext>(
  stored: StoredMiddleware<any, any, any, any>,
  context: TContext,
  fullInput: any,
  errors: any,
  next: (args?: { context?: TContext; input?: any }) => any,
): Promise<void> {
  // Apply input mapper if present
  const mappedInput = stored.inputMapper
    ? stored.inputMapper(fullInput)
    : fullInput;

  const result = stored.fn({
    context,
    input: mappedInput,
    errors,
    next,
  });

  // Handle both sync and async middlewares
  if (result instanceof Promise) {
    await result;
  }
}
