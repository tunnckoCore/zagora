import type { StandardSchemaV1 } from "@standard-schema/spec";
import type z from "zod";

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

export type ErrorSchema<K extends string> = z.ZodObject<{
  kind: z.ZodLiteral<K>;
  [key: string]: z.ZodTypeAny;
}>;

export type UppercaseKeys<T> = {
  [K in keyof T as Uppercase<string & K>]: T[K];
};

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

// ============================================================================
// SPREADABLE TUPLE - Convert tuple type to function overloads with valid param order
// ============================================================================

export type IsOptional<T> = undefined extends T ? true : false;

export type SpreadTuple<T extends readonly any[], R> = T extends readonly [
  infer A,
]
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
  TErrorsMap extends Record<string, AnySchema> | undefined,
  TResolvedResult,
  IsTypedError = TErrorsMap extends Record<string, any> ? true : false,
> = TResolvedResult extends { readonly ok: true }
  ? {
      readonly ok: true;
      data: TOutput;
      readonly error: undefined;
    }
  : {
      readonly ok: false;
      readonly isTypedError: IsTypedError;
      readonly error: TErrorsMap extends Record<string, any>
        ?
            | Prettify<Readonly<TErrorsMap[keyof TErrorsMap]>>
            | InternalError
            | ValidationError<keyof TErrorsMap>
        : InternalError | ValidationError<never>;
    };

export type InternalError = Prettify<ReturnType<typeof createInternalError>>;

export type ValidationError<ErrorKindNames = never> = Prettify<
  Readonly<{
    kind: "VALIDATION_ERROR";
    message: string;
    issues: readonly SchemaIssue[];
    key?: ErrorKindNames;
  }>
>;

export type DefinedError<T> = Prettify<{ readonly kind: string } & T>;

export function createValidationError<ErrorKindNames = never>(
  mode: "input" | "output" | "error data",
  issues: SchemaIssue[],
  key?: ErrorKindNames,
) {
  const modeName = mode.charAt(0).toUpperCase() + mode.slice(1);
  const str = key ? ` for ${(key as string).toUpperCase()}` : "";
  const issuesMsg = issues
    // strip "input" cuz it can be confusing when we are schema validating output and errors too
    .map((issue) => {
      const key = issue.path?.join(".");
      const message = issue.message.replace("Invalid input: ", "");
      return `${key} => ${message}`;
    })
    .join("; ");

  return {
    kind: "VALIDATION_ERROR" as const,
    message: `${modeName} validation failed${str}: ${issuesMsg}`,
    key,
    issues: issues as SchemaIssue[],
  } as const;
}

export function isValidationError(val: any): val is ValidationError {
  return Boolean(
    val &&
      val.kind === "VALIDATION_ERROR" &&
      val.issues &&
      Array.isArray(val.issues) &&
      val.message &&
      typeof val.message === "string",
  );
}
export function isInternalError(val: any): val is InternalError {
  return Boolean(
    val &&
      val.kind === "UNKNOWN_ERROR" &&
      val.message &&
      typeof val.message === "string" &&
      val.cause,
  );
}
export function isDefinedError<T>(val: any): val is DefinedError<T> {
  return Boolean(
    val &&
      val.kind &&
      typeof val.kind === "string" &&
      val.kind.length > 0 &&
      val.kind === val.kind.toUpperCase(),
  );
}

// const foo = { kind: "sas", auth: "barry" } as const;
// if (isDefinedError(foo)) {
//   foo;
// } else {
//   foo;
// }

export function createInternalError(msg: string, cause?: Error) {
  return {
    kind: "UNKNOWN_ERROR" as const,
    message: msg,
    cause,
    stack: cause?.stack,
  } as const;
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
      return { kind: key, ...data };
    };
  }
  return helpers;
}

// ============================================================================
// BUILDER
// ============================================================================

export interface ZagoraDef<
  // TIsHandlerAsync,
  // THandlerFn,
  TContext,
  TInputSchema extends AnySchema | undefined,
  TOutputSchema extends AnySchema | undefined,
  TErrorsMap extends Record<string, AnySchema> | undefined,
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
  TErrorsMap extends Record<string, AnySchema> | undefined,
> = TErrorsMap extends Record<string, AnySchema>
  ? {
      [K in keyof TErrorsMap]: (
        data: Prettify<Omit<InferSchemaInput<TErrorsMap[K]>, "kind">>,
      ) => never;
    }
  : never;

export type ErrorsMapResolved<
  TErrorsMap extends Record<string, AnySchema> | undefined,
> = TErrorsMap extends Record<string, AnySchema>
  ? Readonly<{ [K in keyof TErrorsMap]: InferSchemaOutput<TErrorsMap[K]> }>
  : undefined;

export type ResolveErrorKindNames<TErrorsMap> = TErrorsMap extends Record<
  string,
  AnySchema
>
  ? keyof TErrorsMap
  : undefined;

export interface ProcedureOptions<
  TContext,
  TErrorsMap extends Record<string, AnySchema> | undefined,
> {
  context: TContext;
  errors: TErrorsMap extends Record<string, AnySchema>
    ? ErrorHelpers<TErrorsMap>
    : undefined;
}

export class Zagora<
  TIsHandlerAsync,
  THandlerFn,
  TContext extends any | undefined = undefined,
  TInputSchema extends AnySchema = never,
  TOutputSchema extends AnySchema = never,
  TErrorsMap extends Record<string, AnySchema> | undefined = undefined,
> {
  constructor(
    private def: Partial<
      ZagoraDef<TContext, TInputSchema, TOutputSchema, TErrorsMap>
    > = {},
  ) {}

  input<TInput extends AnySchema>(
    inputSchema: TInput,
  ): Zagora<
    TIsHandlerAsync,
    THandlerFn,
    TContext,
    TInput,
    TOutputSchema,
    TErrorsMap
  > {
    return new Zagora({
      ...this.def,
      inputSchema: inputSchema,
    });
  }

  output<TOutput extends AnySchema>(
    outputSchema: TOutput,
  ): Zagora<
    TIsHandlerAsync,
    THandlerFn,
    TContext,
    TInputSchema,
    TOutput,
    TErrorsMap
  > {
    return new Zagora({
      ...this.def,
      outputSchema: outputSchema,
    });
  }

  context<TNewContext>(
    initialContext?: TNewContext,
  ): Zagora<
    TIsHandlerAsync,
    THandlerFn,
    TNewContext,
    TInputSchema,
    TOutputSchema,
    TErrorsMap
  > {
    return new Zagora({
      ...this.def,
      initialContext,
    }) as any;
  }

  errors<TErrors extends Record<string, AnySchema>>(
    errorsMap: TErrors & UppercaseKeys<TErrors>,
  ): Zagora<
    TIsHandlerAsync,
    THandlerFn,
    TContext,
    TInputSchema,
    TOutputSchema,
    TErrors
  > {
    return new Zagora({
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
  ): Zagora<TIsAsync, TFn, TContext, TInputSchema, TOutputSchema, TErrorsMap> {
    return new Zagora({
      ...this.def,
      handler: fn as any,
    });
  }

  callable<
    TNewContext extends TContext,
    TKindNames extends ResolveErrorKindNames<TErrorsMap>,
    // TResult = TIsHandlerAsync extends true
    //   ? Promise<
    //       ZagoraResult<
    //         InferSchemaOutput<TOutputSchema>,
    //         ErrorsMapResolved<TErrorsMap>
    //       >
    //     >
    //   : ZagoraResult<
    //       InferSchemaOutput<TOutputSchema>,
    //       ErrorsMapResolved<TErrorsMap>
    //     >,
  >(context?: TNewContext) {
    // : InferSchemaInput<TInputSchema> extends readonly any[]
    //   ? SpreadTuple<InferSchemaInput<TInputSchema>, TResult>
    //   : (arg: InferSchemaOutput<TInputSchema>) => TResult

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

    const procedure = createProcedure<TKindNames>({
      inputSchema,
      outputSchema,
      errorsMap,
      options,
      handlerFn,
    });

    type TResolvedResult = Awaited<ReturnType<typeof procedure>>;

    type TResult = TIsHandlerAsync extends true
      ? Promise<
          ZagoraResult<
            InferSchemaOutput<TOutputSchema>,
            ErrorsMapResolved<TErrorsMap>,
            TResolvedResult
          >
        >
      : ZagoraResult<
          InferSchemaOutput<TOutputSchema>,
          ErrorsMapResolved<TErrorsMap>,
          TResolvedResult
        >;

    return procedure as InferSchemaInput<TInputSchema> extends readonly any[]
      ? SpreadTuple<InferSchemaInput<TInputSchema>, TResult>
      : (arg: InferSchemaOutput<TInputSchema>) => TResult;
  }
}

export function createProcedure<TKindNames>({
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

    const processor = (mode: "input" | "output", schema: any, data: any) => {
      if (schema) {
        return validateInputOutput(mode, schema, data);
      }
      return createResult(data, null, false);
    };

    const processInput = (inputData: any) => {
      const handlerArgs = isTuple
        ? handleTupleDefaults(inputSchema, inputData as any)
        : [inputData];

      const state = executeHandler(handlerFn, [options, ...handlerArgs]);
      if (state.error) {
        return validateError<TKindNames>(errorsMap, state.error, state.isAsync);
      }
      const handlerResult =
        state.result ??
        executeHandler(handlerFn, [options, ...handlerArgs]).result;

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
  const key = fn.toString();
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

export function zagora() {
  return new Zagora();
}
