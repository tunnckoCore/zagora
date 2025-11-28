import nodeCrypto from "node:crypto";
import { createInternalError, createValidationError } from "./errors";
import type { AnySchema, CacheAdapter } from "./types";

export function getCacheHash(data: string) {
  return nodeCrypto.createHash("sha256").update(data).digest("hex");
}

// TEST: with expect-type
export function validateInputOutputOrEnv(
  mode: "input" | "output" | "env",
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

// TEST: with expect-type
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

export function processHandler(
  handlerFn: any,
  args: any[],
  cacheAdapter: any,
  incoming: any, // inputSchema, outputSchema, errorsMapSchema, envVarsMapSchema
) {
  const key = cacheAdapter
    ? getCacheHash(
        JSON.stringify({ ...incoming, fnStr: handlerFn.toString(), args }),
      )
    : "";

  if (cacheAdapter) {
    const ret = tryCatch(() => cacheAdapter.has?.(key), false, "has");
    /* v8 ignore next -- @preserve */
    if (ret instanceof Promise) {
      return ret.then((r) => {
        if (r.ok) {
          // r.data is the result of the `cache.has`
          return r.data
            ? tryCatch(() => cacheAdapter.get?.(key), false, "get")
            : executeHandler(args, { handlerFn, cacheAdapter, key });
        }
        return r;
      });
    }

    if (ret.ok) {
      // ret.data is the result of the `cache.has`
      return ret.data
        ? tryCatch(() => cacheAdapter.get?.(key), false, "get")
        : executeHandler(args, { handlerFn, cacheAdapter, key });
    }
    return ret;
  }

  return executeHandler(args, { handlerFn, cacheAdapter, key });
}

export function executeHandler(
  argz: any,
  {
    handlerFn,
    cacheAdapter,
    key,
  }: { handlerFn: any; cacheAdapter: CacheAdapter; key: string },
) {
  const handlerResult = tryCatch(() => handlerFn(...argz), true);
  if (handlerResult instanceof Promise) {
    return handlerResult.then((handlerResolved) => {
      if (handlerResolved.ok) {
        // NOTE: no need to await (if cache adapter is async to begin with)
        // NOTE: we only store successful results in cache
        // cache?.set(key, result.data);

        const resp = tryCatch(
          // NOTE: that `?` and `?.` are important here because `processor` can in both cases,
          // whether there is cacheAdapter or not.
          () => cacheAdapter?.set?.(key, handlerResolved.data),
          false,
          "set",
        );
        if (resp instanceof Promise) {
          /* v8 ignore next -- @preserve */
          return resp.then((resolved) =>
            resolved.ok ? handlerResolved : resolved,
          );
        }
        return resp.ok ? handlerResolved : resp;
      }

      return handlerResolved;
    });
  }

  if (handlerResult.ok) {
    // NOTE: no need to await (if cache adapter is async to begin with)
    // NOTE: we only store successful results in cache
    // cache?.set(key, handlerResult.data);
    const resp = tryCatch(
      // NOTE: that `?` and `?.` are important here because `processor` can in both cases,
      // whether there is cacheAdapter or not.
      () => cacheAdapter?.set?.(key, handlerResult.data),
      false,
      "set",
    );
    if (resp instanceof Promise) {
      return resp.then((resolved) => (resolved.ok ? handlerResult : resolved));
    }
    return resp.ok ? handlerResult : resp;
  }
  return handlerResult;
}

export function tryCatch(fn: any, isHandler: boolean, method: string = "") {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then((data) => createResult(data, null, false))
        .catch((error) => {
          if (isHandler) {
            const res = createResult(null, error, false);
            return { ...res, handlerFailed: true, isAsync: true };
          }
          return createResult(
            null,
            createInternalError(
              `Failure in async CacheAdapter.${method} method`,
              error,
            ),
            false,
          );
        });
    }
    return createResult(res, null, false);
  } catch (error: unknown) {
    if (isHandler) {
      const res = createResult(null, error, false);
      return { ...res, handlerFailed: true, isAsync: false };
    }

    return createResult(
      null,
      createInternalError(`Failure in CacheAdapter.${method} method`, error),
      false,
    );
  }
}

// TEST: with expect-type
export function createResult(data: any, error: any, isTypedError: boolean) {
  if (error) {
    return { ok: false, isTypedError, error: Object.freeze(error) } as const;
  }

  return { ok: true, data } as const;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: it's fine
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
