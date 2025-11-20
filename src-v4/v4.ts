import type { StandardSchemaV1 } from "@standard-schema/spec";
import { generalValidator, handleError, validateInput } from "../src/utils";

// ===========================================================================
// 1. ZAGORA ERROR
// ===========================================================================

export class ZagoraError extends Error {
  public readonly data: unknown;
  public readonly reason?: string | null;
  public readonly issues?: StandardSchemaV1.Issue[];

  constructor(
    message: string,
    options?: {
      cause?: unknown;
      data?: unknown;
      reason?: string | null;
      issues?: StandardSchemaV1.Issue[];
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "ZagoraError";
    this.data = options?.data;
    this.reason = options?.reason;
    this.issues = options?.issues;
  }

  static fromIssues(
    issues: readonly StandardSchemaV1.Issue[],
    defaultMessage: string,
  ): ZagoraError {
    const message = issues[0]?.message || defaultMessage;
    return new ZagoraError(message, { issues: [...issues] });
  }
}

export const isTypedError = (err: unknown) => {
  return Boolean(
    err &&
      typeof err === "object" &&
      "type" in err &&
      typeof err.type === "string",
  );
};

// ===========================================================================
// 2. TYPE SYSTEM UTILITIES
// ===========================================================================

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

// Helper to detect if a schema is a tuple (has fixed length, spreads args)
export type IsTupleSchema<T extends AnySchema> = T extends StandardSchemaV1<
  infer Input,
  any
>
  ? Input extends readonly [any, ...any[]]
    ? true
    : false
  : false;

// Helper to detect if a schema is an array (variable length, single arg)
export type IsArraySchema<T extends AnySchema> = T extends StandardSchemaV1<
  infer Input,
  any
>
  ? Input extends any[]
    ? Input extends readonly [any, ...any[]]
      ? false
      : true
    : false
  : false;

/**
 * Helper to detect if all elements in a tuple are optional
 */
type IsOptional<T> = undefined extends T ? true : false;
type AllOptional<T extends readonly any[]> = T extends readonly [
  infer H,
  ...infer R,
]
  ? IsOptional<H> extends true
    ? AllOptional<R>
    : false
  : true;

/**
 * [A, B | undefined] -> [A, B?]
 * Makes tuple elements optional when they can be undefined (for defaults).
 */
type MakeUndefinedOptional<T extends readonly any[]> = T extends readonly [
  infer H,
  ...infer Rest,
]
  ? undefined extends H
    ? [H?, ...MakeUndefinedOptional<Rest>]
    : [H, ...MakeUndefinedOptional<Rest>]
  : [];

/**
 * Generate all prefixes of a tuple: [A, B, C] -> [] | [A] | [A, B] | [A, B, C]
 */
type ValuePrefixes<T extends readonly any[]> = T extends readonly [
  infer H,
  ...infer R,
]
  ? [] | [H, ...ValuePrefixes<R>]
  : [];

/**
 * Convert union to intersection (for function overloads)
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

/**
 * Create function overloads for all valid tuple prefixes with optional elements
 */
type OverloadedByPrefixes<
  T extends readonly any[],
  R,
> = AllOptional<T> extends false
  ? undefined extends T[number]
    ? UnionToIntersection<
        ValuePrefixes<MakeUndefinedOptional<T>> extends infer P
          ? P extends readonly any[]
            ? P extends []
              ? AllOptional<MakeUndefinedOptional<T>> extends true
                ? (...args: P) => R
                : never
              : (...args: P) => R
            : never
          : never
      >
    : (...args: T) => R
  : UnionToIntersection<
      ValuePrefixes<T> extends infer P
        ? P extends readonly any[]
          ? P extends []
            ? AllOptional<T> extends true
              ? (...args: P) => R
              : never
            : (...args: P) => R
          : never
        : never
    >;

/**
 * Call-site arguments (what user passes to `.callable()`).
 * Based on SCHEMA INPUT (before defaults applied) + optionalization.
 */
type CallArgsFromSchema<TSchema extends AnySchema | undefined> =
  TSchema extends StandardSchemaV1<infer UInput, any>
    ? UInput extends readonly [any, ...any[]]
      ? MakeUndefinedOptional<UInput> // tuple -> overloaded with optional defaults
      : UInput extends readonly any[]
        ? [UInput] // array -> single arg
        : [UInput] // primitive/object -> single arg
    : [];

/**
 * Callable type that handles both tuple and non-tuple inputs properly.
 */
type CallableType<
  TCallArgs extends readonly any[],
  TOutputSchema extends AnySchema | undefined,
  TErrors extends Record<string, StandardSchemaV1> | undefined,
  TIsAsync extends boolean,
  TIsTuple extends boolean,
> = TIsTuple extends true
  ? OverloadedByPrefixes<
      TCallArgs,
      TIsAsync extends true
        ? Promise<ZagoraResult<TOutputSchema, TErrors>>
        : ZagoraResult<TOutputSchema, TErrors>
    >
  : (
      ...args: TCallArgs
    ) => TIsAsync extends true
      ? Promise<ZagoraResult<TOutputSchema, TErrors>>
      : ZagoraResult<TOutputSchema, TErrors>;

/**
 * Handler arguments (what the handler sees after validation).
 * Based on SCHEMA OUTPUT (after defaults applied).
 */
type HandlerArgsFromSchema<T> = T extends StandardSchemaV1<any, infer TOutput>
  ? TOutput extends readonly any[]
    ? TOutput // tuple output -> spread as-is (defaults applied)
    : [TOutput] // primitive/object -> single arg
  : [];

// isPromise helper
type IsPromise<T> = T extends Promise<any> ? true : false;

// Hybrid [data,error,isDefined] & object
export type ZagoraResult<
  TOutput extends StandardSchemaV1 | undefined = undefined,
  TErrors extends Record<string, StandardSchemaV1> | undefined = undefined,
> = {
  data: TOutput extends StandardSchemaV1 ? InferSchemaOutput<TOutput> : any;
  error: TErrors extends Record<string, StandardSchemaV1>
    ? InferSchemaOutput<TErrors[keyof TErrors]> | ZagoraError | null
    : ZagoraError | null;
  isDefined: boolean;
} & [
  TOutput extends StandardSchemaV1 ? InferSchemaOutput<TOutput> : any,
  (
    | (TErrors extends Record<string, StandardSchemaV1>
        ? InferSchemaOutput<TErrors[keyof TErrors]>
        : never)
    | ZagoraError
    | null
  ),
  boolean,
];

export type ErrorHelpers<T extends Record<string, StandardSchemaV1>> = {
  [K in keyof T]: (data: Omit<InferSchemaInput<T[K]>, "type">) => never;
};

export interface ProcedureOptions<
  TContext,
  TErrors extends Record<string, StandardSchemaV1> | undefined,
> {
  context: TContext;
  errors: TErrors extends Record<string, StandardSchemaV1>
    ? ErrorHelpers<TErrors>
    : undefined;
}

export interface BuilderDef<
  TContext,
  TInputSchema extends AnySchema | undefined,
  TOutputSchema extends AnySchema | undefined,
  TErrors extends Record<string, StandardSchemaV1> | undefined,
> {
  contextType: TContext;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  errorsSchema: TErrors;
}

// ===========================================================================
// 3. RUNTIME UTILITIES
// ===========================================================================

function isAsyncFunction(fn: any): boolean {
  if (typeof fn !== "function") return false;
  return (
    fn.constructor.name === "AsyncFunction" ||
    Function.prototype.toString.call(fn).startsWith("async")
  );
}

function createResult(data: any, error: any, isDefined: boolean): any {
  const res: any = [data, error, isDefined];
  res.data = data;
  res.error = error;
  res.isDefined = isDefined;
  return res;
}

function createErrorHelpers(
  schema: Record<string, StandardSchemaV1>,
  _isAsync: boolean,
) {
  const helpers: any = {};
  for (const key of Object.keys(schema)) {
    helpers[key] = (errorData: any) => ({ type: key, ...errorData });
  }
  return helpers;
}

// ===========================================================================
// 4. BUILDER
// ===========================================================================

export class Builder<
  TContext = undefined,
  TInputSchema extends AnySchema | undefined = undefined,
  TOutputSchema extends AnySchema | undefined = undefined,
  TErrors extends Record<string, StandardSchemaV1> | undefined = undefined,
  TCallArgs extends any[] = CallArgsFromSchema<TInputSchema>,
  THandlerArgs extends any[] = HandlerArgsFromSchema<TInputSchema>,
> {
  constructor(
    private def: Partial<
      BuilderDef<TContext, TInputSchema, TOutputSchema, TErrors>
    > = {},
  ) {}

  $context<TNewContext>(): Builder<
    TNewContext,
    TInputSchema,
    TOutputSchema,
    TErrors,
    TCallArgs,
    THandlerArgs
  > {
    return new Builder({ ...this.def, contextType: undefined as TNewContext });
  }

  input<TSchema extends AnySchema>(
    schema: TSchema,
  ): Builder<
    TContext,
    TSchema,
    TOutputSchema,
    TErrors,
    CallArgsFromSchema<TSchema>,
    HandlerArgsFromSchema<TSchema>
  > {
    return new Builder({ ...this.def, inputSchema: schema });
  }

  output<TSchema extends AnySchema>(
    schema: TSchema,
  ): Builder<
    TContext,
    TInputSchema,
    TSchema,
    TErrors,
    TCallArgs,
    THandlerArgs
  > {
    return new Builder({ ...this.def, outputSchema: schema });
  }

  errors<TErrorsMap extends Record<string, StandardSchemaV1>>(
    errorsMap: TErrorsMap,
  ): Builder<
    TContext,
    TInputSchema,
    TOutputSchema,
    TErrorsMap,
    TCallArgs,
    THandlerArgs
  > {
    return new Builder({ ...this.def, errorsSchema: errorsMap });
  }

  handler<
    TFn extends (
      options: ProcedureOptions<TContext, TErrors>,
      ...args: THandlerArgs
    ) => any,
    TReturn = ReturnType<TFn>,
    TIsAsync extends boolean = IsPromise<TReturn>,
  >(
    fn: TFn,
  ): Procedure<
    TContext,
    TInputSchema,
    TOutputSchema,
    TErrors,
    TCallArgs,
    THandlerArgs,
    TIsAsync
  > {
    return new Procedure({
      contextType: this.def.contextType as TContext,
      inputSchema: this.def.inputSchema as TInputSchema,
      outputSchema: this.def.outputSchema as TOutputSchema,
      errorsSchema: this.def.errorsSchema as TErrors,
      handler: fn as TFn,
    });
  }
}

// ===========================================================================
// 5. PROCEDURE
// ===========================================================================

interface ProcedureDef<
  TContext,
  TInputSchema extends AnySchema | undefined,
  TOutputSchema extends AnySchema | undefined,
  TErrors extends Record<string, StandardSchemaV1> | undefined,
  THandlerArgs extends any[],
> extends BuilderDef<TContext, TInputSchema, TOutputSchema, TErrors> {
  handler: (
    options: ProcedureOptions<TContext, TErrors>,
    ...args: THandlerArgs
  ) => any;
}

export class Procedure<
  TContext,
  TInputSchema extends AnySchema | undefined,
  TOutputSchema extends AnySchema | undefined,
  TErrors extends Record<string, StandardSchemaV1> | undefined,
  TCallArgs extends any[],
  THandlerArgs extends any[],
  TIsAsync extends boolean,
> {
  constructor(
    private def: ProcedureDef<
      TContext,
      TInputSchema,
      TOutputSchema,
      TErrors,
      THandlerArgs
    >,
  ) {}

  callable(
    context?: TContext,
  ): CallableType<
    TCallArgs,
    TOutputSchema,
    TErrors,
    TIsAsync,
    TInputSchema extends StandardSchemaV1<infer UInput, any>
      ? UInput extends readonly [any, ...any[]]
        ? true
        : TInputSchema extends StandardSchemaV1<readonly any[], infer Output>
          ? Output extends readonly [any, ...any[]]
            ? true
            : false
          : false
      : false
  > {
    const { inputSchema, outputSchema, errorsSchema, handler } = this.def;

    const isHandlerAsync = isAsyncFunction(handler);
    const errorHelpers = errorsSchema
      ? createErrorHelpers(errorsSchema, isHandlerAsync)
      : undefined;

    const procOptions: ProcedureOptions<TContext, TErrors> = {
      context: context as TContext,
      errors: errorHelpers as any,
    };

    const schemaAny = inputSchema as any;
    const isTuple =
      schemaAny?._def?.type === "tuple" || schemaAny?.type === "tuple";

    const finalize = (result: any, isException: boolean): any => {
      if (isException) {
        const typedErr = handleError(result, errorsSchema);
        if (typedErr instanceof Promise) {
          return typedErr.then((trs) => {
            if (trs && trs.isDefined) {
              return createResult(null, trs.error, true);
            }
            if (trs && !trs.isDefined && trs.error) {
              return createResult(null, trs.error, false);
            }
          });
        }
        if (typedErr && typedErr.isDefined) {
          return createResult(null, typedErr.error, true);
        }
        if (typedErr && !typedErr.isDefined && typedErr.error) {
          return createResult(null, typedErr.error, false);
        }

        const err =
          result instanceof ZagoraError
            ? result
            : new ZagoraError("Handler threw unknown error", { cause: result });

        return createResult(null, err, false);
      }

      const outputResult = outputSchema
        ? generalValidator(outputSchema, result, null, true)
        : { data: result, error: null, isDefined: false };

      if (outputResult instanceof Promise) {
        return outputResult.then((outRes) => {
          if (outRes.error) {
            return createResult(null, outRes.error, false);
          }
          return createResult(outRes.data, null, false);
        });
      }

      return createResult(outputResult.data, outputResult.error, false);
    };

    return ((...rawArgs: any[]) => {
      const argsToValidate = isTuple ? rawArgs : rawArgs[0];
      let validationRes;

      if (inputSchema) {
        validationRes = validateInput(inputSchema, argsToValidate);
      } else {
        validationRes = { data: null, error: null, isDefined: false };
      }

      const execute = (valResult: any) => {
        if (valResult.error) {
          return createResult(null, valResult.error, false);
        }

        try {
          const handlerArgs = isTuple ? valResult.data : [valResult.data];
          const result = handler(procOptions, ...(handlerArgs as THandlerArgs));

          if (result instanceof Promise) {
            return result
              .then((r) => finalize(r, false))
              .catch((err) => finalize(err, true));
          }
          return finalize(result, false);
        } catch (err) {
          return finalize(err, true);
        }
      };

      if (validationRes instanceof Promise) {
        return validationRes.then(execute);
      }
      return execute(validationRes);
    }) as any;
  }
}

export function zagora() {
  return new Builder();
}
