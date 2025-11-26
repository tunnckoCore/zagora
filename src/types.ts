import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  ErrorHelpers,
  ErrorsMapPlain,
  InternalError,
  ValidationError,
} from "./errors";

export * from "./is-promise";

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

export type InferSchemaOutputSafe<T> = T extends AnySchema
  ? InferSchemaOutput<T>
  : unknown;

// Infer output type from either output schema or handler return type
export type InferOutput<
  TOutputSchema extends AnySchema | undefined,
  THandlerFn extends (...args: any[]) => any,
> = TOutputSchema extends AnySchema
  ? InferSchemaOutput<TOutputSchema>
  : Awaited<ReturnType<THandlerFn>>;

export type InferSchemaInputSafe<T> = T extends AnySchema
  ? InferSchemaInput<T>
  : unknown;

// TEST: with expect-type
export type UppercaseKeys<T> = {
  [K in keyof T as Uppercase<string & K>]: T[K];
};

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

// TEST: with expect-type
export type IsOptional<T> = undefined extends T ? true : false;

export type ObjectToUnion<T> = T[keyof T];

export type CacheAdapter =
  | {
      has(key: string): boolean;
      get(key: string): unknown;
      set(key: string, value: unknown): any;
    }
  | {
      has(key: string): Promise<boolean>;
      get(key: string): Promise<unknown>;
      // NOTE: if we gotta be strict, it should be Promise<any> or Promise<void>
      // but it's fine, cuz we don't really care and we never await it anyway
      // NOTE: Making it the same as the "sync version" above
      // allows end users to provide CacheAdapters with mixed sync & async methods,
      // without reporting them an error, because we allow and handle
      // ALL the cases at runtime anyway
      set(key: string, value: unknown): any;
    };

// TEST: with expect-type
export type ZagoraResult<
  TOutput,
  TErrorsMap extends Record<string, AnySchema> | any,
  TResolvedResult,
  IsTypedError = TErrorsMap extends Record<string, any> ? true : false,
> = TResolvedResult extends { readonly ok: true }
  ? {
      readonly ok: true;
      data: TOutput;
      readonly error: undefined;
    }
  : TErrorsMap extends Record<string, any>
    ? {
        readonly ok: false;
        readonly isTypedError: IsTypedError;
        readonly error:
          | Prettify<
              Readonly<Prettify<ObjectToUnion<ErrorsMapPlain<TErrorsMap>>>>
            >
          | ValidationError<keyof TErrorsMap>
          | InternalError;
      }
    : {
        readonly ok: false;
        readonly isTypedError: IsTypedError;
        readonly error: InternalError | ValidationError<never>;
      };

export interface ZagoraDef<
  TContext,
  TInputSchema extends AnySchema | undefined,
  TOutputSchema extends AnySchema | undefined,
  TErrorsMap extends Record<string, AnySchema> | undefined,
  TCacheAdapter extends CacheAdapter | undefined = undefined,
> {
  disableOptions?: boolean;
  autoCallable?: boolean;
  initialContext: any;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  errorsMap: TErrorsMap;
  cacheAdapter: TCacheAdapter;
  handler?: (
    options: { context: TContext; errors: any },
    ...args: unknown[]
  ) => any;
}

// TEST: with expect-type
export interface ResolveHandlerOptions<
  TContext,
  TErrorsMap extends Record<string, AnySchema> | undefined,
> {
  context: TContext;
  errors: TErrorsMap extends Record<string, AnySchema>
    ? ErrorHelpers<TErrorsMap>
    : undefined;
}

// TEST: with expect-type
export type ResolveProcedure<
  TDisableOptions extends boolean,
  TContext,
  TInputSchema extends AnySchema | undefined,
  TErrorsMap extends Record<string, AnySchema> | undefined,
> = TDisableOptions extends true
  ? TInputSchema extends AnySchema
    ? InferSchemaOutput<TInputSchema> extends readonly any[]
      ? SpreadTuple<InferSchemaOutput<TInputSchema>, any>
      : (arg: InferSchemaOutput<TInputSchema>) => any
    : () => any
  : TInputSchema extends AnySchema
    ? InferSchemaOutput<TInputSchema> extends readonly any[]
      ? SpreadTuple<
          [
            Prettify<ResolveHandlerOptions<TContext, TErrorsMap>>,
            ...InferSchemaOutput<TInputSchema>,
          ],
          any
        >
      : (
          options: Prettify<ResolveHandlerOptions<TContext, TErrorsMap>>,
          arg: InferSchemaOutput<TInputSchema>,
        ) => any
    : (options: Prettify<ResolveHandlerOptions<TContext, TErrorsMap>>) => any;

// TEST: with expect-type
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
