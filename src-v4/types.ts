import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ZagoraError } from "../src/error";

export type AnySchema = StandardSchemaV1<any, any>;

export type InferSchemaOutput<T extends AnySchema | undefined> =
  T extends StandardSchemaV1<any, infer UOutput> ? UOutput : never;

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
  ? Input extends readonly any[]
    ? // Check if it's a fixed-length tuple by seeing if it has numeric literal keys
      Input extends readonly [any, ...any[]]
      ? true
      : false
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

export type ZagoraFunction<Input, R> = Input extends [any, ...any[]]
  ? (...args: Input) => R
  : (arg: Input) => R;

// -- SIMPLIFIED ARGUMENT RESOLUTION --

/**
 * Converts a Schema into an array of arguments for a function.
 * - If undefined: empty array []
 * - If Tuple: returns the input tuple type itself [A, B]
 * - If Primitive/Object: returns a tuple containing that single type [T]
 */
export type ResolveArgs<TInputSchema extends AnySchema | undefined> =
  TInputSchema extends AnySchema
    ? IsTupleSchema<TInputSchema> extends true
      ? InferSchemaInput<TInputSchema>
      : [InferSchemaInput<TInputSchema>]
    : [];

// ------------------------------------

export type InputArgs<TInputSchema extends AnySchema | undefined> =
  TInputSchema extends AnySchema
    ? InferSchemaOutput<TInputSchema> extends [any, ...any[]]
      ? InferSchemaOutput<TInputSchema>
      : [InferSchemaOutput<TInputSchema>]
    : [];

// Types for generating overloads (adapted from original)
export type UnionToIntersection<U> = (
  U extends any
    ? (k: U) => void
    : never
) extends (k: infer I) => void
  ? I
  : never;

export type IsOptional<T> = undefined extends T ? true : false;

export type AllOptional<T extends any[]> = T extends [infer H, ...infer R]
  ? IsOptional<H> extends true
    ? AllOptional<R>
    : false
  : true;

export type ValuePrefixes<T extends any[]> = T extends [infer H, ...infer R]
  ? [] | [H, ...ValuePrefixes<R>]
  : [];

export type MakeUndefinedOptional<T extends any[]> = T extends [
  infer H,
  ...infer Rest,
]
  ? undefined extends H
    ? [H?, ...MakeUndefinedOptional<Rest>]
    : [H, ...MakeUndefinedOptional<Rest>]
  : [];

export type TupleForwardOverloads<
  TInputArgs extends readonly any[],
  THandlerResult,
> = TInputArgs extends readonly any[]
  ? UnionToIntersection<
      | ((
          ...args: TInputArgs extends readonly (infer E)[] ? E[] : never
        ) => THandlerResult)
      | (TInputArgs extends readonly (infer MutableArgs)[]
          ? ValuePrefixes<MutableArgs[]> extends infer P
            ? P extends readonly any[]
              ? P extends readonly []
                ? never
                : (
                    ...args: P extends readonly (infer E)[] ? E[] : never
                  ) => THandlerResult
              : never
            : never
          : never)
    >
  : never;

export type OverloadedByPrefixes<
  T extends any[],
  R,
> = AllOptional<T> extends false
  ? undefined extends T[number]
    ? AllOptional<MakeUndefinedOptional<T>> extends false
      ? (...args: MakeUndefinedOptional<T>) => R
      : UnionToIntersection<
          ValuePrefixes<MakeUndefinedOptional<T>> extends infer P
            ? P extends any[]
              ? P extends []
                ? AllOptional<MakeUndefinedOptional<T>> extends true
                  ? (...args: P) => R
                  : never
                : (...args: P) => R
              : never
            : never
        >
    : UnionToIntersection<
        ValuePrefixes<T> extends infer P
          ? P extends any[]
            ? P extends []
              ? never
              : (...args: P) => R
            : never
          : never
      >
  : (...args: T) => R;

export type IsOnlyPromise<T> = [T] extends [never]
  ? false
  : Exclude<T, Promise<any>> extends never
    ? true
    : false;

export type CallableType<
  TInputSchema extends AnySchema | undefined,
  TResult,
> = TInputSchema extends AnySchema
  ? InferSchemaOutput<TInputSchema> extends [any, ...any[]]
    ? TupleForwardOverloads<InferSchemaOutput<TInputSchema>, TResult>
    : (arg: InferSchemaOutput<TInputSchema>) => TResult
  : () => TResult;

export type ZagoraErrorHelpers<T extends Record<string, StandardSchemaV1>> = {
  [K in keyof T]: (
    error: Prettify<Omit<InferSchemaInput<T[K]>, "type">>,
  ) => [null, InferSchemaOutput<T[K]>];
};

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

export interface ProcedureDef<
  TContext,
  TInputSchema extends AnySchema | undefined,
  TOutputSchema extends AnySchema | undefined,
  TErrors extends Record<string, StandardSchemaV1> | undefined,
> extends BuilderDef<TContext, TInputSchema, TOutputSchema, TErrors> {
  handler: (
    options: ProcedureOptions<TContext, TErrors>,
    ...args: InputArgs<TInputSchema>
  ) =>
    | Promise<InferSchemaOutput<TOutputSchema>>
    | InferSchemaOutput<TOutputSchema>;
}

export type ResultObj<TOutput, TError, TIsDefined extends boolean> = {
  data: TOutput;
  error: TError;
  isDefined: TIsDefined;
};

export type Result<TOutput, TError, TIsDefined extends boolean> = [
  TOutput,
  TError,
  TIsDefined,
] &
  Prettify<ResultObj<TOutput, TError, TIsDefined>>;

// typescript prettify type
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type ZagoraResult<
  TOutput extends StandardSchemaV1 | undefined = undefined,
  TErrors extends Record<string, StandardSchemaV1> | undefined = undefined,
> = TErrors extends Record<string, StandardSchemaV1>
  ?
      | Result<
          TOutput extends StandardSchemaV1
            ? InferSchemaOutput<TOutput>
            : unknown,
          null,
          false
        > // success
      | Result<
          null,
          {
            [K in keyof TErrors]: InferSchemaOutput<TErrors[K]>;
          }[keyof TErrors],
          true
        > // typed error
      | Result<null, ZagoraError, false> // untyped error
  :
      | Result<
          TOutput extends StandardSchemaV1
            ? InferSchemaOutput<TOutput>
            : unknown,
          null,
          false
        > // success
      | Result<null, ZagoraError, false>; // untyped error
