import { createInternalError, createValidationError } from "./errors";
import type { AnySchema } from "./types";

export function createProcedure<TKindNames>({
  inputSchema,
  outputSchema,
  handlerFn,
  errorsMap,
  options,
  disableOptions,
}: any) {
  return (...args: unknown[]) => {
    const schemaAny = inputSchema as any;
    const isTuple =
      schemaAny?._def?.type === "tuple" || schemaAny?.type === "tuple";

    const processor = (mode: "input" | "output", schema: any, data: any) => {
      if (schema) {
        return validateInputOutput(mode, schema, data);
      }
      return createResult(data, null, false);
    };

    const processInput = (inputData: any) => {
      // NOTE: isTuple is safe/enough here cuz it's based on the inputSchema,
      // thus if inputSchema is not defined, then it would be isTuple=false too.
      const handlerArgs = isTuple
        ? handleTupleDefaults(inputSchema, inputData as any)
        : [inputData];

      const executionArgs = disableOptions
        ? handlerArgs
        : [options, ...handlerArgs];

      const state = executeHandler(handlerFn, executionArgs);
      if (state.error) {
        return validateError<TKindNames>(errorsMap, state.error, state.isAsync);
      }
      const handlerResult =
        state.result ?? executeHandler(handlerFn, executionArgs).result;

      if (handlerResult instanceof Promise) {
        return handlerResult
          .then((outputResult) =>
            processor("output", outputSchema, outputResult),
          )
          .catch((err) => {
            return validateError<TKindNames>(errorsMap, err, state.isAsync);
          });
      }

      const res = processor("output", outputSchema, handlerResult);
      return res;
    };

    const inputArgs = isTuple ? args : args[0];

    const inputResult = inputSchema
      ? validateInputOutput("input", inputSchema, inputArgs)
      : ({ ok: true, data: inputArgs } as const);

    if (inputResult instanceof Promise) {
      return inputResult.then((resultObj) =>
        resultObj.error ? resultObj : processInput(resultObj.data),
      );
    }

    return inputResult.error ? inputResult : processInput(inputResult.data);
  };
}

export function validateInputOutput(
  mode: "input" | "output",
  schema: any,
  data: any,
) {
  const result = schema["~standard"].validate(data);
  if (result instanceof Promise) {
    return result.then((or) =>
      or.issues
        ? createResult(null, createValidationError(mode, or.issues), false)
        : createResult(or.value, null, false),
    );
  }

  return result.issues
    ? createResult(null, createValidationError(mode, result.issues), false)
    : createResult(result.value, null, false);
}

export function validateError<TKindNames>(
  errorsMap: Record<string, AnySchema>,
  error: any,
  isAsync: boolean,
) {
  if (!errorsMap) {
    return createResult(
      null,
      createInternalError(
        `${isAsync ? "Async" : "Sync"} handler threw unknown error`,
        error,
      ),
      false,
    );
  }

  const kind = error?.kind;
  if (kind in errorsMap) {
    const kindName = kind as TKindNames;
    const schema = errorsMap[kindName as any] as any;
    const { kind: _, ...cleanedError } = error;
    const result = schema["~standard"].validate(cleanedError);
    const processError = (res: any) =>
      res.issues
        ? createResult(
            null,
            createValidationError<TKindNames>(
              "error data",
              res.issues,
              kindName,
            ),
            false,
          )
        : createResult(null, { kind, ...res.value } as const, true);

    if (result instanceof Promise) {
      return result.then(processError);
    }
    return processError(result);
  }

  return createResult(
    null,
    createInternalError(`Typed Error ${kind} is not defined in errors map`),
    false,
  );
}

const EXECUTION_CACHE = new Map();

export function executeHandler(fn: any, args: any[]) {
  const key = JSON.stringify({ key: fn.toString(), args });
  if (EXECUTION_CACHE.has(key)) {
    return EXECUTION_CACHE.get(key);
  }

  const isAsync =
    Function.prototype.toString.call(fn).startsWith("async") ||
    Object.prototype.toString.call(fn) === "[object AsyncFunction]";

  let res = { isAsync } as any;
  try {
    const result = fn(...args);
    res = { isAsync: result instanceof Promise, result };
  } catch (error: unknown) {
    res = { isAsync, result: null, error };
  }

  EXECUTION_CACHE.set(key, res);
  return res;
}

export function createResult(data: any, error: any, isTypedError: boolean) {
  if (error) {
    return { ok: false, isTypedError, error: Object.freeze(error) } as const;
  }

  return { ok: true, data } as const;
}

export function handleTupleDefaults(
  schema: AnySchema,
  rawArgs: unknown[],
): unknown[] {
  // Check if this might be a tuple schema by examining the schema structure
  const schemaAny = schema as any;
  const isZodTuple = schemaAny._def && schemaAny._def.type === "tuple";
  const isValibotTuple = schemaAny.type === "tuple" && !isZodTuple;

  // Try to detect if this is a StandardSchema tuple schema
  if (isZodTuple || isValibotTuple) {
    const tupleItems = schemaAny?._def?.items || schemaAny.items;

    if (tupleItems && Array.isArray(tupleItems)) {
      const result = [...rawArgs];

      // Fill in defaults for missing elements
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

export function deepMerge(target: any, source: any): any {
  if (source == null || typeof source !== "object") return source;
  if (target == null || typeof target !== "object") return source;
  const result = Array.isArray(target) ? [...target] : { ...target };
  for (const key in source) {
    if (key in source) {
      if (typeof source[key] === "object" && source[key] !== null) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  return result;
}
