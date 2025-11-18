import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ZagoraError } from "./error";

export type Schema<I, O = I> = StandardSchemaV1<I, O>;

export type AnySchema = Schema<any, any>;

export type SchemaIssue = StandardSchemaV1.Issue;

export type InferSchemaInput<T extends AnySchema> = T extends StandardSchemaV1<
  infer UInput,
  any
>
  ? UInput
  : never;

// Helper to detect if a schema is a tuple (has fixed length, spreads args)
// Handles both Zod tuples [T1, T2] and Valibot tuples with optional elements [T1, T2 | undefined]
export type IsTupleSchema<T extends AnySchema> = T extends StandardSchemaV1<
  infer Input,
  any
>
  ? Input extends readonly any[]
    ? // Check if it's a fixed-length tuple by seeing if it has numeric literal keys
      Input extends readonly [any, ...any[]]
      ? true
      : Input extends [any, ...any[]]
        ? true
        : false
    : false
  : false;

// Helper to detect if a schema is an array (variable length, single arg)
export type IsArraySchema<T extends AnySchema> = T extends StandardSchemaV1<
  infer Input,
  any
>
  ? Input extends readonly any[]
    ? Input extends readonly [any, ...any[]]
      ? false
      : Input extends [any, ...any[]]
        ? false
        : true
    : false
  : false;

export type InferSchemaOutput<T extends AnySchema> = T extends StandardSchemaV1<
  any,
  infer UOutput
>
  ? UOutput
  : never;

// Helper: Convert readonly tuple to mutable for proper overload matching
export type Mutable<T> = T extends readonly (infer U)[]
  ? U[]
  : T extends readonly [
        infer A,
        infer B,
        infer C,
        infer D,
        infer E,
        ...infer Rest,
      ]
    ? [A, B, C, D, E, ...Rest]
    : T extends readonly [infer A, infer B, infer C, infer D]
      ? [A, B, C, D]
      : T extends readonly [infer A, infer B, infer C]
        ? [A, B, C]
        : T extends readonly [infer A, infer B]
          ? [A, B]
          : T extends readonly [infer A]
            ? [A]
            : T extends readonly []
              ? []
              : never;

export type TupleForwardOverloads<
  TInputArgs extends readonly any[],
  THandlerResult,
> = TInputArgs extends readonly []
  ? () => THandlerResult
  : TInputArgs extends readonly [infer A]
    ? UnionToIntersection<(() => THandlerResult) | ((a: A) => THandlerResult)>
    : TInputArgs extends readonly [infer A, infer B]
      ? UnionToIntersection<
          | (() => THandlerResult)
          | ((a: A) => THandlerResult)
          | ((a: A, b: B) => THandlerResult)
        >
      : TInputArgs extends readonly [infer A, infer B, infer C]
        ? UnionToIntersection<
            | (() => THandlerResult)
            | ((a: A) => THandlerResult)
            | ((a: A, b: B) => THandlerResult)
            | ((a: A, b: B, c: C) => THandlerResult)
          >
        : TInputArgs extends readonly [infer A, infer B, infer C, infer D]
          ? UnionToIntersection<
              | (() => THandlerResult)
              | ((a: A) => THandlerResult)
              | ((a: A, b: B) => THandlerResult)
              | ((a: A, b: B, c: C) => THandlerResult)
              | ((a: A, b: B, c: C, d: D) => THandlerResult)
            >
          : TInputArgs extends readonly [
                infer A,
                infer B,
                infer C,
                infer D,
                infer E,
              ]
            ? UnionToIntersection<
                | (() => THandlerResult)
                | ((a: A) => THandlerResult)
                | ((a: A, b: B) => THandlerResult)
                | ((a: A, b: B, c: C) => THandlerResult)
                | ((a: A, b: B, c: C, d: D) => THandlerResult)
                | ((a: A, b: B, c: C, d: D, e: E) => THandlerResult)
              >
            : never;

export type UnionToIntersection<U> = (
  U extends any
    ? (k: U) => void
    : never
) extends (k: infer I) => void
  ? I
  : never;

// Convert object types (function overloads) to intersections
export type ObjectToIntersection<T> = T extends object
  ? UnionToIntersection<T[keyof T]>
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

// Helper to make undefined elements optional in tuple (for Valibot compatibility)
// Valibot uses [T | undefined] for optional elements, convert to [T?] for proper typing
export type MakeUndefinedOptional<T extends any[]> = T extends [
  infer H,
  ...infer Rest,
]
  ? H extends any | undefined
    ? undefined extends H
      ? [Exclude<H, undefined>?, ...MakeUndefinedOptional<Rest>]
      : [H, ...MakeUndefinedOptional<Rest>]
    : [H, ...MakeUndefinedOptional<Rest>]
  : [];

export type OverloadedByPrefixes<T extends any[], R> = T extends readonly [
  infer A,
  infer B,
  infer C,
  infer D,
  infer E,
]
  ? UnionToIntersection<
      | (() => R)
      | ((a: A) => R)
      | ((a: A, b: B) => R)
      | ((a: A, b: B, c: C) => R)
      | ((a: A, b: B, c: C, d: D) => R)
      | ((a: A, b: B, c: C, d: D, e: E) => R)
    >
  : T extends readonly [infer A, infer B, infer C, infer D]
    ? UnionToIntersection<
        | (() => R)
        | ((a: A) => R)
        | ((a: A, b: B) => R)
        | ((a: A, b: B, c: C) => R)
        | ((a: A, b: B, c: C, d: D) => R)
      >
    : T extends readonly [infer A, infer B, infer C]
      ? UnionToIntersection<
          | (() => R)
          | ((a: A) => R)
          | ((a: A, b: B) => R)
          | ((a: A, b: B, c: C) => R)
        >
      : T extends readonly [infer A, infer B]
        ? UnionToIntersection<(() => R) | ((a: A) => R) | ((a: A, b: B) => R)>
        : T extends readonly [infer A]
          ? UnionToIntersection<(() => R) | ((a: A) => R)>
          : T extends readonly []
            ? () => R
            : never;

export type ZagoraErrorHelpers<T extends Record<string, StandardSchemaV1>> = {
  [K in keyof T]: (
    error: Prettify<Omit<InferSchemaInput<T[K]>, "type">>,
  ) => { type: K } & Prettify<Omit<InferSchemaInput<T[K]>, "type">>;
};

export type AnyContext = Record<string, any>;

/**
 * Middleware function that can be sync or async
 * Receives context, input (typed by mapper or schema), errors, and a next function
 * The input type TInput is what the middleware actually receives (after mapper applied)
 */
export type MiddlewareFunction<
  TContext extends AnyContext,
  TInput,
  TErrors,
> = (args: {
  context: TContext;
  input: TInput;
  errors: TErrors;
  next: (args?: { context?: TContext; input?: TInput }) => any;
}) => any;

/**
 * Stored middleware with optional input mapper
 * TMappedInput is what the middleware actually receives after mapper is applied
 */
export type StoredMiddleware<
  TContext extends AnyContext,
  TOriginalInput,
  TMappedInput,
  TErrors,
> = {
  fn: MiddlewareFunction<TContext, TMappedInput, TErrors>;
  inputMapper?: (fullInput: TOriginalInput) => TMappedInput;
};

export type ZagoraDef<
  TInputSchema extends AnySchema | undefined = undefined,
  TOutputSchema extends AnySchema | undefined = undefined,
  TErrorsSchema extends
    | Record<string, StandardSchemaV1>
    | undefined = undefined,
  TContext extends AnyContext | undefined = undefined,
> = {
  inputSchema?: TInputSchema;
  outputSchema?: TOutputSchema;
  errorsSchema?: TErrorsSchema;
  contextType?: TContext;
  middlewares?: StoredMiddleware<any, any, any, any>[];
};

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
        >
      | Result<
          null,
          {
            [K in keyof TErrors]: InferSchemaOutput<TErrors[K]>;
          }[keyof TErrors],
          true
        >
      | Result<null, ZagoraError, false>
  :
      | Result<
          TOutput extends StandardSchemaV1
            ? InferSchemaOutput<TOutput>
            : unknown,
          null,
          false
        >
      | Result<null, ZagoraError, false>;

export type HandlerArg<
  TInputSchema extends AnySchema | undefined,
  TContext extends AnyContext | undefined,
  TErrorsSchema extends Record<string, StandardSchemaV1> | undefined,
> = TContext extends AnyContext
  ? {
      input: TInputSchema extends AnySchema
        ? InferSchemaInput<TInputSchema>
        : undefined;
      context: TContext;
    }
  : TInputSchema extends AnySchema
    ? InferSchemaInput<TInputSchema>
    : unknown;
