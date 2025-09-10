import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ZagoraError } from "./utils.ts";

export type ZagoraMetadata<THandler = unknown> = {
  inputSchema: StandardSchemaV1 | null;
  outputSchema: StandardSchemaV1 | null;
  errorSchema: Record<string, StandardSchemaV1> | null;
  handlerFn: THandler;
};

export type ZagoraConfig = {
  errorsFirst?: boolean;
};

/* Dual return format that supports both object and tuple destructuring */
export type ZagoraResult<TData, TErr, TIsDefined extends boolean> = [
  TData,
  TErr,
  TIsDefined,
] & {
  data: TData;
  error: TErr;
  isDefined: TIsDefined;
};

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

export type OverloadedByPrefixes<T extends any[], R> = UnionToIntersection<
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

export type ValidateOutput = [unknown, null] | [null, ZagoraError];
export type MaybeAsyncValidateOutput<TIsSync extends boolean> =
  TIsSync extends true ? ValidateOutput : Promise<ValidateOutput>;

export type ValidateError = { error: unknown; isTyped: boolean };
export type MaybeAsyncValidateError<TIsSync extends boolean> =
  TIsSync extends true ? ValidateError : Promise<ValidateError>;

/* prefixes of a value-tuple (mutable) */
export type ValuePrefixes<T extends any[]> = T extends [infer H, ...infer R]
  ? [] | [H, ...ValuePrefixes<R>]
  : [];

/* Helper types for StandardSchema */
export type ZagoraInferInput<T extends StandardSchemaV1> =
  StandardSchemaV1.InferInput<T>;
export type ZagoraInferOutput<T extends StandardSchemaV1> =
  StandardSchemaV1.InferOutput<T>;

/* Error helper type - creates functions that return [null, error] tuples */
export type ZagoraErrorHelpers<T extends Record<string, StandardSchemaV1>> = {
  [K in keyof T]: (
    error: Omit<ZagoraInferInput<T[K]>, "type">
  ) => [null, ZagoraInferOutput<T[K]>];
};

export type ZagoraBaseResult<
  Output extends StandardSchemaV1 | null = null,
  ErrSchema extends Record<string, StandardSchemaV1> | null = null,
> = ErrSchema extends Record<string, StandardSchemaV1>
  ?
      | ZagoraResult<
          Output extends StandardSchemaV1 ? ZagoraInferOutput<Output> : unknown,
          null,
          false
        > // success
      | ZagoraResult<
          null,
          {
            [K in keyof ErrSchema]: ZagoraInferOutput<ErrSchema[K]>;
          }[keyof ErrSchema],
          true
        > // typed error
      | ZagoraResult<null, ZagoraError, false> // untyped error
  :
      | ZagoraResult<
          Output extends StandardSchemaV1 ? ZagoraInferOutput<Output> : unknown,
          null,
          false
        > // success
      | ZagoraResult<null, ZagoraError, false>; // untyped error
