import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  ErrorHelpers,
  ErrorsMapPlain,
  ErrorsMapResolved,
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

export type InferSchemaInputSafe<T> = T extends AnySchema
  ? InferSchemaInput<T>
  : unknown;

export type UppercaseKeys<T> = {
  [K in keyof T as Uppercase<string & K>]: T[K];
};

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type IsOptional<T> = undefined extends T ? true : false;
export type IsPromise<T> = T extends Promise<infer _>
  ? T extends string
    ? false
    : T extends number
      ? false
      : number
  : T extends any
    ? string
    : false;

// export type DefinedErrorsUnion<TErrorsMap> = TErrorsMap extends Record<
//   string,
//   AnySchema
// >
//   ? Prettify<Readonly<ErrorsMapPlain<TErrorsMap>[keyof TErrorsMap]>>
//   : never;

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
  : TErrorsMap extends Record<string, any>
    ? {
        readonly ok: false;
        readonly isTypedError: IsTypedError;
        readonly error:
          | Prettify<Readonly<TErrorsMap[keyof TErrorsMap]>>
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
> {
  disableOptions?: boolean;
  initialContext: any;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  errorsMap: TErrorsMap;
  handler?: (
    options: { context: TContext; errors: any },
    ...args: unknown[]
  ) => any;
}

export interface ResolveHandlerOptions<
  TContext,
  TErrorsMap extends Record<string, AnySchema> | undefined,
> {
  context: TContext;
  errors: TErrorsMap extends Record<string, AnySchema>
    ? ErrorHelpers<TErrorsMap>
    : undefined;
}

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
