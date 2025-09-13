import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ZagoraError } from "./utils.ts";

export type Schema<I, O = I> = StandardSchemaV1<I, O>;

export type AnySchema = Schema<any, any>;

export type SchemaIssue = StandardSchemaV1.Issue;

export type InferSchemaInput<T extends AnySchema> = T extends StandardSchemaV1<
  infer UInput,
  any
>
  ? UInput
  : never;

export type InferSchemaOutput<T extends AnySchema> = T extends StandardSchemaV1<
  any,
  infer UOutput
>
  ? UOutput
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

export type OverloadedByPrefixes<
  T extends any[],
  R,
> = AllOptional<T> extends false
  ? // If any element is required, only provide the full signature
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
    error: Prettify<Omit<InferSchemaInput<T[K]>, "type">>
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

export type Result<TOutput, TError, TIsDefined extends boolean> = [
  TOutput,
  TError,
  TIsDefined,
] & {
  data: TOutput;
  error: TError;
  isDefined: TIsDefined;
};

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
