import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ZagoraError } from "./error.ts";

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

// Helper to generate tuple spread overloads with proper mutable array handling
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

// convert union -> intersection helper
export type UnionToIntersection<U> = (
  U extends any
    ? (k: U) => void
    : never
) extends (k: infer I) => void
  ? I
  : never;

/* Given `T` a tuple type, produce an intersection of function
    types that act as overloads for each prefix of T. */
export type IsOptional<T> = undefined extends T ? true : false;
export type AllOptional<T extends any[]> = T extends [infer H, ...infer R]
  ? IsOptional<H> extends true
    ? AllOptional<R>
    : false
  : true;

/* prefixes of a value-tuple (mutable) */
export type ValuePrefixes<T extends any[]> = T extends [infer H, ...infer R]
  ? [] | [H, ...ValuePrefixes<R>]
  : [];

// NOTE: possible fix
// export type OverloadedByPrefixes<T extends any[], R> = UnionToIntersection<
//   ValuePrefixes<T> extends infer P
//     ? P extends any[]
//       ? P extends []
//         ? AllOptional<T> extends true
//           ? (...args: P) => R
//           : never
//         : (...args: P) => R
//       : never
//     : never
// >;

// Helper to make undefined elements optional in tuple (for Valibot compatibility)
export type MakeUndefinedOptional<T extends any[]> = T extends [
  infer H,
  ...infer Rest,
]
  ? undefined extends H
    ? [H?, ...MakeUndefinedOptional<Rest>]
    : [H, ...MakeUndefinedOptional<Rest>]
  : [];

export type OverloadedByPrefixes<
  T extends any[],
  R,
> = AllOptional<T> extends false
  ? // If any element is required, check if we have undefined elements (Valibot case)
    // Convert undefined to optional for callsite
    undefined extends T[number]
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
    : // No undefined elements, use original logic
      (...args: T) => R
  : // If all optional, provide all prefixes
    UnionToIntersection<
      ValuePrefixes<T> extends infer P
        ? P extends any[]
          ? P extends []
            ? AllOptional<T> extends true
              ? (...args: P) => R
              : never
            : (...args: P) => R
          : never
        : never
    >;

export type ZagoraErrorHelpers<T extends Record<string, StandardSchemaV1>> = {
  [K in keyof T]: (
    error: Prettify<Omit<InferSchemaInput<T[K]>, "type">>,
  ) => [null, InferSchemaOutput<T[K]>];
};

export type ZagoraDef<
  TInputSchema extends AnySchema | undefined = undefined,
  TOutputSchema extends AnySchema | undefined = undefined,
  TErrorsSchema extends
    | Record<string, StandardSchemaV1>
    | undefined = undefined,
> = {
  inputSchema?: TInputSchema;
  outputSchema?: TOutputSchema;
  errorsSchema?: TErrorsSchema;
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
