import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  ErrorHelpers,
  InferSchemaMapPlain,
  InternalError,
  ValidationError,
} from "./errors";
import type { IsPromise } from "./is-promise";

export * from "./is-promise";

export type Schema<I, O = I> = StandardSchemaV1<I, O>;

export type AnySchema = Schema<any, any>;

// TEST: with expect-type
export type IsAsyncSchema<T> = [T] extends [never]
  ? false
  : T extends { readonly async: infer TAsync }
    ? [TAsync] extends [true]
      ? true
      : true extends TAsync
        ? boolean
        : false
    : false;

type SchemaMapAsyncState<T> = T extends Record<string, AnySchema>
  ? true extends {
      [K in keyof T]: [IsAsyncSchema<T[K]>] extends [true] ? true : false;
    }[keyof T]
    ? true
    : true extends {
          [K in keyof T]: true extends IsAsyncSchema<T[K]> ? true : false;
        }[keyof T]
      ? boolean
      : false
  : false;

type IsDefinitelyAsync<T extends boolean> = [T] extends [true] ? true : false;
type IsPossiblyAsync<T extends boolean> = true extends T ? true : false;

// TEST: with expect-type
export type HasAsyncSchema<TInputSchema, TOutputSchema, TErrorsMap> =
  true extends
    | IsDefinitelyAsync<IsAsyncSchema<TInputSchema>>
    | IsDefinitelyAsync<IsAsyncSchema<TOutputSchema>>
    | IsDefinitelyAsync<SchemaMapAsyncState<TErrorsMap>>
    ? true
    : true extends
          | IsPossiblyAsync<IsAsyncSchema<TInputSchema>>
          | IsPossiblyAsync<IsAsyncSchema<TOutputSchema>>
          | IsPossiblyAsync<SchemaMapAsyncState<TErrorsMap>>
      ? boolean
      : false;

// TEST: with expect-type
export type ConditionalSchemaAsync<
  TAsync extends boolean,
  TSync,
  TAsyncResult,
> = TAsync extends true ? TAsyncResult : TSync;

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

export type ZagoraEnvVars =
  | Record<string, string>
  | NodeJS.ProcessEnv
  | Record<string, string | undefined>;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

// TEST: with expect-type
export type IsOptional<T> = undefined extends T ? true : false;

export type ObjectToUnion<T> = T[keyof T];

export type CacheAdapter = {
  has(key: string): boolean | Promise<boolean>;
  get(key: string): unknown;
  set(key: string, value: unknown): any;
};

// TEST: with expect-type
export type HasAsyncCache<TCache> = TCache extends {
  has(key: string): infer THas;
  get(key: string): infer TGet;
  set(key: string, value: unknown): infer TSet;
}
  ? true extends
      | IsDefinitelyAsync<IsPromise<THas>>
      | IsDefinitelyAsync<IsPromise<TGet>>
      | IsDefinitelyAsync<IsPromise<TSet>>
    ? true
    : true extends
          | IsPossiblyAsync<IsPromise<THas>>
          | IsPossiblyAsync<IsPromise<TGet>>
          | IsPossiblyAsync<IsPromise<TSet>>
      ? boolean
      : false
  : false;

// Cache methods run only on the paths that need them, so even a definitely
// async method makes the procedure possibly async rather than always async.
export type ConditionalCacheAsync<TCache, TResult> = [
  HasAsyncCache<TCache>,
] extends [false]
  ? TResult
  : TResult | Promise<Awaited<TResult>>;

// TEST: with expect-type
export type ZagoraResult<
  TOutput,
  TErrorsMap extends Record<string, AnySchema> | any,
  TResolvedResult,
  IsTypedError = TErrorsMap extends Record<string, any> ? boolean : false,
> = TResolvedResult extends { readonly ok: true }
  ? {
      readonly ok: true;
      data: TOutput;
      readonly error: undefined;
    }
  : IsTypedError extends true
    ? TErrorsMap extends Record<string, AnySchema>
      ? {
          readonly ok: false;
          readonly isTypedError: true;
          readonly error: Prettify<
            Readonly<
              Prettify<ObjectToUnion<InferSchemaMapPlain<TErrorsMap, true>>>
            >
          >;
        }
      : never
    : {
        readonly ok: false;
        readonly isTypedError: false;
        readonly error:
          | InternalError
          | ValidationError<
              TErrorsMap extends Record<string, AnySchema>
                ? keyof TErrorsMap
                : never
            >;
      };

export interface ZagoraDef<
  TContext,
  TInputSchema extends AnySchema | undefined,
  TOutputSchema extends AnySchema | undefined,
  TErrorsMap extends Record<string, AnySchema> | undefined,
  TEnvVarsMap extends AnySchema | undefined,
  TCacheAdapter extends CacheAdapter | undefined = undefined,
> {
  disableOptions?: boolean;
  autoCallable?: boolean;
  initialContext: any;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  errorsMap: TErrorsMap;
  envVarsMapSchema: TEnvVarsMap;
  envVars: ZagoraEnvVars;
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
  TEnvVarsMap extends AnySchema | undefined,
> {
  context: TContext;
  errors: TErrorsMap extends Record<string, AnySchema>
    ? ErrorHelpers<TErrorsMap>
    : undefined;
  env: InferSchemaOutputSafe<TEnvVarsMap>;
}

// TEST: with expect-type
export type ResolveProcedure<
  TDisableOptions extends boolean,
  TContext,
  TInputSchema extends AnySchema | undefined,
  TErrorsMap extends Record<string, AnySchema> | undefined,
  TEnvVarsMap extends AnySchema | undefined,
> = TDisableOptions extends true
  ? TInputSchema extends AnySchema
    ? InferSchemaOutput<TInputSchema> extends readonly [any, ...any[]]
      ? SpreadTuple<InferSchemaOutput<TInputSchema>, any>
      : (arg: InferSchemaOutput<TInputSchema>) => any
    : () => any
  : TInputSchema extends AnySchema
    ? InferSchemaOutput<TInputSchema> extends readonly [any, ...any[]]
      ? SpreadTuple<
          [
            Prettify<ResolveHandlerOptions<TContext, TErrorsMap, TEnvVarsMap>>,
            ...InferSchemaOutput<TInputSchema>,
          ],
          any
        >
      : (
          options: Prettify<
            ResolveHandlerOptions<TContext, TErrorsMap, TEnvVarsMap>
          >,
          arg: InferSchemaOutput<TInputSchema>,
        ) => any
    : (
        options: Prettify<
          ResolveHandlerOptions<TContext, TErrorsMap, TEnvVarsMap>
        >,
      ) => any;

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
                  | ((arg1: A, arg2: B, arg3: C, arg4: D) => R)
                  | ((arg1: A, arg2: B, arg3: C) => R)
                  | ((arg1: A, arg2: B) => R)
                  | ((arg1: A) => R)
        : (...args: T) => R;

// TEST: with expect-type
export type ResolvedProcedure<
  TInputSchema extends AnySchema | undefined,
  TFinalResult,
> = TInputSchema extends AnySchema
  ? InferSchemaInput<TInputSchema> extends readonly [any, ...any[]]
    ? SpreadTuple<InferSchemaInput<TInputSchema>, TFinalResult>
    : (arg: InferSchemaInput<TInputSchema>) => TFinalResult
  : () => TFinalResult;
