import type { StandardSchemaV1 } from "@standard-schema/spec";
import { ZagoraError } from "../src/error";

export type Schema<I, O = I> = StandardSchemaV1<I, O>;

export type AnySchema = Schema<any, any>;

export type SchemaIssue = StandardSchemaV1.Issue;

export type InferSchemaOutput<T extends AnySchema> = T extends StandardSchemaV1<
  any,
  infer UOutput
>
  ? UOutput
  : never;

export type InferSchemaInput<T extends AnySchema> = T extends StandardSchemaV1<
  infer UInput,
  any
>
  ? UInput
  : never;

// ============================================================================
// SPREADABLE TUPLE - Convert tuple type to function overloads with valid param order
// ============================================================================
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

type IsOptional<T> = undefined extends T ? true : false;

type SpreadTuple<T extends readonly any[], R> = T extends readonly [infer A]
  ? (arg: A) => R
  : T extends readonly [infer A, infer B]
    ? IsOptional<B> extends true
      ? ((arg1: A, arg2?: B) => R) | ((arg1: A) => R)
      : ((arg1: A, arg2: B) => R) | ((arg1: A) => R)
    : T extends readonly [infer A, infer B, infer C]
      ? IsOptional<B> extends true
        ? IsOptional<C> extends true
          ?
              | ((arg1: A, arg2?: B, arg3?: C) => R)
              | ((arg1: A, arg2?: B) => R)
              | ((arg1: A) => R)
          :
              | ((arg1: A, arg2?: B, arg3?: C) => R)
              | ((arg1: A, arg2?: B) => R)
              | ((arg1: A) => R)
        : IsOptional<C> extends true
          ?
              | ((arg1: A, arg2: B, arg3?: C) => R)
              | ((arg1: A, arg2: B) => R)
              | ((arg1: A) => R)
          :
              | ((arg1: A, arg2: B, arg3: C) => R)
              | ((arg1: A, arg2: B) => R)
              | ((arg1: A) => R)
      : T extends readonly [infer A, infer B, infer C, infer D]
        ? IsOptional<B> extends true
          ? IsOptional<C> extends true
            ? IsOptional<D> extends true
              ?
                  | ((arg1: A, arg2?: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2?: B, arg3?: C) => R)
                  | ((arg1: A, arg2?: B) => R)
                  | ((arg1: A) => R)
              :
                  | ((arg1: A, arg2?: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2?: B, arg3?: C) => R)
                  | ((arg1: A, arg2?: B) => R)
                  | ((arg1: A) => R)
            : IsOptional<D> extends true
              ?
                  | ((arg1: A, arg2?: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2?: B, arg3?: C) => R)
                  | ((arg1: A, arg2?: B) => R)
                  | ((arg1: A) => R)
              :
                  | ((arg1: A, arg2?: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2?: B, arg3?: C) => R)
                  | ((arg1: A, arg2?: B) => R)
                  | ((arg1: A) => R)
          : IsOptional<C> extends true
            ? IsOptional<D> extends true
              ?
                  | ((arg1: A, arg2: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2: B, arg3?: C) => R)
                  | ((arg1: A, arg2: B) => R)
                  | ((arg1: A) => R)
              :
                  | ((arg1: A, arg2: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2: B, arg3?: C) => R)
                  | ((arg1: A, arg2: B) => R)
                  | ((arg1: A) => R)
            : IsOptional<D> extends true
              ?
                  | ((arg1: A, arg2: B, arg3: C, arg4?: D) => R)
                  | ((arg1: A, arg2: B, arg3: C) => R)
                  | ((arg1: A, arg2: B) => R)
                  | ((arg1: A) => R)
              :
                  | ((arg1: A, arg2: B, arg3: C, arg4?: D) => R)
                  | ((arg1: A, arg2: B, arg3: C) => R)
                  | ((arg1: A, arg2: B) => R)
                  | ((arg1: A) => R)
        : (...args: T) => R;

export type ZagoraResult<
  TOutput,
  TErrors extends Record<string, any> | undefined = undefined,
> = {
  data: TOutput;
  error: TErrors extends Record<string, any>
    ? TErrors[keyof TErrors] | ZagoraError | null
    : ZagoraError | null;
  isTypedError: boolean;
};

export function handleTupleDefaults(
  schema: StandardSchemaV1,
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

// ============================================================================
// UTILITIES
// ============================================================================

function deepMerge(target: any, source: any): any {
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

// export const isTypedError = (val: any) => {
//   return Boolean(
//     val !== null &&
//       typeof val === "object" &&
//       "error" in val &&
//       "isTypedError" in val &&
//       val.isTypedError === true &&
//       val.error !== null &&
//       typeof val.error === "object" &&
//       !(val.error instanceof Error) &&
//       "type" in val.error,
//   );
// };

function createErrorHelpers(errorMap: any): Record<string, (data: any) => any> {
  const helpers: any = {};
  for (const key in errorMap) {
    const schema = errorMap[key];
    if (!schema) continue;

    helpers[key] = (data: any) => {
      return { type: key, ...data };
    };
  }
  return helpers;
}

// ============================================================================
// BUILDER
// ============================================================================

export interface BuilderDef<
  // TIsHandlerAsync,
  // THandlerFn,
  TContext,
  TInputSchema extends AnySchema | undefined,
  TOutputSchema extends AnySchema | undefined,
  TErrorsMap extends Record<string, StandardSchemaV1> | undefined,
> {
  initialContext: any;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  errorsMap: TErrorsMap;
  handler?: (
    options: { context: TContext; errors: any },
    ...args: unknown[]
  ) => any;
}

export type IsPromise<T> = T extends Promise<any> ? true : false;

export type ErrorHelpers<
  TErrorsMap extends Record<string, StandardSchemaV1> | undefined,
> = TErrorsMap extends Record<string, StandardSchemaV1>
  ? {
      [K in keyof TErrorsMap]: (
        data: Prettify<
          Omit<StandardSchemaV1.InferInput<TErrorsMap[K]>, "type">
        >,
      ) => never;
    }
  : never;

export type ErrorsMapResolved<
  TErrorsMap extends Record<string, StandardSchemaV1> | undefined,
> = TErrorsMap extends Record<string, StandardSchemaV1>
  ? { [K in keyof TErrorsMap]: StandardSchemaV1.InferInput<TErrorsMap[K]> }
  : undefined;

export interface ProcedureOptions<
  TContext,
  TErrorsMap extends Record<string, StandardSchemaV1> | undefined,
> {
  context: TContext;
  errors: TErrorsMap extends Record<string, StandardSchemaV1>
    ? ErrorHelpers<TErrorsMap>
    : undefined;
}

class Builder<
  TIsHandlerAsync,
  THandlerFn,
  TContext extends any | undefined = undefined,
  TInputSchema extends AnySchema = never,
  TOutputSchema extends AnySchema = never,
  TErrorsMap extends Record<string, StandardSchemaV1> | undefined = undefined,
> {
  constructor(
    private def: Partial<
      BuilderDef<TContext, TInputSchema, TOutputSchema, TErrorsMap>
    > = {},
  ) {}

  input<TInput extends AnySchema>(
    inputSchema: TInput,
  ): Builder<
    TIsHandlerAsync,
    THandlerFn,
    TContext,
    TInput,
    TOutputSchema,
    TErrorsMap
  > {
    return new Builder({
      ...this.def,
      inputSchema: inputSchema,
    });
  }

  output<TOutput extends AnySchema>(
    outputSchema: TOutput,
  ): Builder<
    TIsHandlerAsync,
    THandlerFn,
    TContext,
    TInputSchema,
    TOutput,
    TErrorsMap
  > {
    return new Builder({
      ...this.def,
      outputSchema: outputSchema,
    });
  }

  context<TNewContext>(
    initialContext?: TNewContext,
  ): Builder<
    TIsHandlerAsync,
    THandlerFn,
    TNewContext,
    TInputSchema,
    TOutputSchema,
    TErrorsMap
  > {
    return new Builder({
      ...this.def,
      initialContext,
    }) as any;
  }

  errors<TErrors extends Record<string, StandardSchemaV1>>(
    errorsMap: TErrors,
  ): Builder<
    TIsHandlerAsync,
    THandlerFn,
    TContext,
    TInputSchema,
    TOutputSchema,
    TErrors
  > {
    return new Builder({
      ...this.def,
      errorsMap,
    });
  }

  handler<
    TFn extends InferSchemaOutput<TInputSchema> extends readonly any[]
      ? SpreadTuple<
          [
            Prettify<ProcedureOptions<TContext, TErrorsMap>>,
            ...InferSchemaOutput<TInputSchema>,
          ],
          any
        >
      : (
          options: Prettify<ProcedureOptions<TContext, TErrorsMap>>,
          arg: InferSchemaOutput<TInputSchema>,
        ) => any,
    TReturn = ReturnType<TFn>,
    TIsAsync extends boolean = IsPromise<TReturn>,
  >(
    fn: TFn,
  ): Builder<TIsAsync, TFn, TContext, TInputSchema, TOutputSchema, TErrorsMap> {
    return new Builder({
      ...this.def,
      handler: fn as any,
    });
  }

  callable<
    TNewContext extends TContext,
    TSpread extends SpreadTuple<
      InferSchemaInput<TInputSchema>,
      ZagoraResult<
        InferSchemaOutput<TOutputSchema>,
        ErrorsMapResolved<TErrorsMap>
      >
    >,
    TProcReturn extends InferSchemaInput<TInputSchema> extends readonly any[]
      ? TSpread
      : (
          arg: InferSchemaOutput<TInputSchema>,
        ) => ZagoraResult<
          InferSchemaOutput<TOutputSchema>,
          ErrorsMapResolved<TErrorsMap>
        >,
  >(context?: TNewContext): TProcReturn {
    const { initialContext, errorsMap } = this.def;
    const handlerFn = this.def.handler as any; // todo: fix, return internal error if not defined (thru createResult)
    const inputSchema = this.def.inputSchema as TInputSchema;
    const outputSchema = this.def.outputSchema as TOutputSchema;

    const mergedContext = context
      ? deepMerge(initialContext, context)
      : initialContext;

    const errors = errorsMap ? createErrorHelpers(errorsMap as any) : undefined;
    const options = {
      errors: errors,
      context: mergedContext,
    } as Prettify<
      ProcedureOptions<Prettify<TNewContext & TContext>, TErrorsMap>
    >;

    const procedure = createProcedure({
      inputSchema,
      outputSchema,
      errorsMap,
      options,
      handlerFn,
    });

    return procedure as any;
  }
}

export function createProcedure({
  inputSchema,
  outputSchema,
  handlerFn,
  errorsMap,
  options,
}: any) {
  return (...args: unknown[]) => {
    const schemaAny = inputSchema as any;
    const isTuple =
      schemaAny?._def?.type === "tuple" || schemaAny?.type === "tuple";

    const inputArgs = isTuple ? args : args[0];

    const result = inputSchema
      ? schemaAny["~standard"].validate(inputArgs)
      : { value: inputArgs };

    const parsed = (result as any).value;

    const handlerArgs = isTuple
      ? handleTupleDefaults(inputSchema, parsed)
      : [parsed];

    const state = executeHandler(handlerFn, [options, ...handlerArgs]);
    if (state.error) {
      return validateError(errorsMap, state.error, state.isAsync);
    }
    const handlerResult = state.result;

    const processResult = (res: any) => {
      if (outputSchema) {
        return validateOutput(outputSchema, res, "Output validation failed");
      }
      return createResult(res, null, false);
    };

    if (handlerResult instanceof Promise) {
      return handlerResult.then(processResult).catch((err) => {
        return validateError(errorsMap, err, state.isAsync);
      });
    }

    return processResult(handlerResult);
  };
}

export function validateOutput(schema: any, data: any, validationMsg: string) {
  const outputResult = schema["~standard"].validate(data);
  if (outputResult instanceof Promise) {
    return outputResult.then((or) =>
      or.issues
        ? createResult(
            null,
            ZagoraError.fromIssues(or.issues, validationMsg),
            false,
          )
        : createResult(or.value, null, false),
    );
  } else {
    return outputResult.issues
      ? createResult(
          null,
          ZagoraError.fromIssues(outputResult.issues, validationMsg),
          false,
        )
      : createResult(outputResult.value, null, false);
  }
}

export function validateError(errorsMap: any, error: any, isAsync: boolean) {
  if (!errorsMap) {
    return createResult(
      null,
      error instanceof ZagoraError
        ? error
        : new ZagoraError(
            `${isAsync ? "Async" : "Sync"} handler threw unknown error`,
            { cause: error },
          ),
      false,
    );
  }

  const kind = error?.kind;
  if (kind in errorsMap) {
    const schema = errorsMap[kind] as any;
    const result = schema["~standard"].validate(error);
    const processError = (res: any) =>
      res.issues
        ? createResult(
            null,
            ZagoraError.fromIssues(
              res.issues,
              `Error data validation failed for ${kind}`,
            ),
            false,
          )
        : createResult(null, { kind, ...res.value }, true);

    if (result instanceof Promise) {
      return result.then(processError);
    }
    return processError(result);
  }

  return createResult(
    null,
    new ZagoraError(`Typed Error ${kind} not found in errorsMap`),
    false,
  );
}

const EXECUTION_CACHE = new Map();

// note: basic, but coverting a lot, if not just use `is-async-function` in future
export function executeHandler(fn: any, args: any[]) {
  const key = fn.toString();
  if (EXECUTION_CACHE.has(key)) {
    return EXECUTION_CACHE.get(key);
  }

  let res;

  if (Function.prototype.toString.call(fn).startsWith("async")) {
    res = { isAsync: true, result: null };
  } else if (Object.prototype.toString.call(fn) === "[object AsyncFunction]") {
    res = { isAsync: true, result: null };
  }
  if (res) {
    EXECUTION_CACHE.set(key, res);
    return res;
  }

  try {
    const result = fn(...args);
    res = { isAsync: result instanceof Promise, result };
  } catch (error: unknown) {
    res = { isAsync: false, result: null, error };
  }

  EXECUTION_CACHE.set(key, res);
  return res;
}

export function createResult(data: any, error: any, isTypedError: boolean) {
  const res = { data, error, isTypedError };

  return res;
}

export function zagora() {
  return new Builder();
}
