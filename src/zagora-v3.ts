import type { StandardSchemaV1 } from "@standard-schema/spec";
import z from "zod";
import {
  createErrorHelpers,
  createResult,
  generalValidator,
  isAsyncFunction,
  isZagoraTypedError,
  validateInput,
  ZagoraError,
} from "./utils.ts";

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

export type ZagoraErrorHelpers<T extends Record<string, StandardSchemaV1>> = {
  [K in keyof T]: (
    error: Omit<InferSchemaInput<T[K]>, "type">
  ) => [null, InferSchemaOutput<T[K]>];
};

export type ZagoraDef<
  TInputSchema extends AnySchema | undefined = undefined,
  TOutputSchema extends AnySchema | undefined = undefined,
  TOptionsSchema extends AnySchema | undefined = undefined,
  TErrorsSchema extends
    | Record<string, StandardSchemaV1>
    | undefined = undefined,
> = {
  inputSchema?: TInputSchema;
  outputSchema?: TOutputSchema;
  optionsSchema?: TOptionsSchema;
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
type Prettify<T> = {
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

// zagora(config: { errorsFirst: false })
// .input(schema: StandardSchema)
// .output(schema: StandardSchema)
// .options(schema: StandardSchema)
// .errors(errs: Record<string, StandardSchema>)
// .handler - async and sync

export class Zagora<
  TInputSchema extends AnySchema | undefined = undefined,
  TOutputSchema extends AnySchema | undefined = undefined,
  TOptionsSchema extends AnySchema | undefined = undefined,
  TErrorsSchema extends
    | Record<string, StandardSchemaV1>
    | undefined = undefined,
> {
  "~zagora": ZagoraDef<
    TInputSchema,
    TOutputSchema,
    TOptionsSchema,
    TErrorsSchema
  >;

  constructor(
    def?: ZagoraDef<TInputSchema, TOutputSchema, TOptionsSchema, TErrorsSchema>
  ) {
    this["~zagora"] = def || {};
  }

  input<TSchema extends AnySchema>(
    schema: TSchema
  ): Zagora<TSchema, TOutputSchema, TOptionsSchema, TErrorsSchema> {
    return new Zagora({
      ...this["~zagora"],
      inputSchema: schema,
    });
  }

  output<TSchema extends AnySchema>(
    schema: TSchema
  ): Zagora<TInputSchema, TSchema, TOptionsSchema, TErrorsSchema> {
    return new Zagora({
      ...this["~zagora"],
      outputSchema: schema,
    });
  }

  options<TSchema extends AnySchema>(
    schema: TSchema
  ): Zagora<TInputSchema, TOutputSchema, TSchema, TErrorsSchema> {
    return new Zagora({
      ...this["~zagora"],
      optionsSchema: schema,
    });
  }

  errors<TErrorsSchemaMap extends Record<string, StandardSchemaV1>>(
    errorsMap: TErrorsSchemaMap
  ): Zagora<TInputSchema, TOutputSchema, TOptionsSchema, TErrorsSchemaMap> {
    return new Zagora({
      ...this["~zagora"],
      errorsSchema: errorsMap,
    });
  }

  // handler<UFuncOutput extends InferSchemaInput<TOutputSchema>>(
  //     handler: ProcedureHandler<
  //       TCurrentContext,
  //       InferSchemaOutput<TInputSchema>,
  //       UFuncOutput
  //     >
  //   ):
  handler<
    // TFuncInput extends InferSchemaInput<TInputSchema extends StandardSchemaV1 ? TInputSchema : AnySchema>,
    TFuncInput extends StandardSchemaV1 = TInputSchema extends undefined
      ? never
      : TInputSchema,
    OutArgs = InferSchemaInput<TFuncInput>,
  >(
    impl: TErrorsSchema extends Record<string, StandardSchemaV1>
      ? OutArgs extends readonly any[]
        ? (...args: [...OutArgs, ZagoraErrorHelpers<TErrorsSchema>]) => any
        : (arg: OutArgs, errors: ZagoraErrorHelpers<TErrorsSchema>) => any
      : OutArgs extends readonly any[]
        ? (...args: OutArgs) => any
        : (arg: OutArgs) => any
  ) {
    const isAsync = isAsyncFunction(impl);

    const inputSchema = this["~zagora"].inputSchema || undefined;
    const outputSchema = this["~zagora"].outputSchema || undefined;
    const optionsSchema = this["~zagora"].optionsSchema || undefined;
    const errorsSchema = this["~zagora"].errorsSchema || undefined;

    let processedOptionsValidation: unknown;
    let processedInputValidation: unknown[];

    const wrapper = (...rawArgs: unknown[]) => {
      const lastArg = rawArgs.at(-1);

      // if last passed param is an object and there is defined schema (not the default zagoraAnySchema)
      if (
        lastArg &&
        processedOptionsValidation === undefined &&
        typeof lastArg === "object" &&
        optionsSchema &&
        optionsSchema["~standard"]
      ) {
        const options = lastArg as Record<string, unknown>;
        const optionsResult = generalValidator(optionsSchema, options);

        if (optionsResult instanceof Promise) {
          return optionsResult.then((res): any => {
            if (res.error) {
              return res;
            }

            processedOptionsValidation = res.data;
            return wrapper(...rawArgs.slice(0, -1));
          });
        }

        if (optionsResult.error) {
          return optionsResult;
        }

        processedOptionsValidation = optionsResult.data;
        return wrapper(...rawArgs.slice(0, -1));
      }

      if (
        processedInputValidation === undefined &&
        inputSchema &&
        inputSchema["~standard"]
      ) {
        console.log("inside input validation...", rawArgs);
        const inputResult = validateInput(inputSchema, rawArgs);

        if (inputResult instanceof Promise) {
          return inputResult.then((res): any => {
            if (res.error) {
              return res;
            }

            processedInputValidation = res.data;
            return wrapper(...rawArgs);
          });
        }

        if (inputResult.error) {
          return inputResult;
        }
        processedInputValidation = inputResult.data;
        return wrapper(...rawArgs);
      }

      try {
        const finalArgs = [
          ...processedInputValidation,
          processedOptionsValidation ?? null,
          errorsSchema ? createErrorHelpers(errorsSchema, isAsync) : null,
        ].filter(Boolean);

        const rawResult = (impl as any)(...finalArgs);

        if (rawResult instanceof Promise) {
          return rawResult
            .then((data) => {
              return outputSchema
                ? generalValidator(outputSchema, data)
                : { data, error: null, isDefined: false };
            })
            .catch((error) => {
              if (
                errorsSchema &&
                error instanceof ZagoraError &&
                (error as any).data
              ) {
                const { type: key, ...data } = (error as any).data;

                return generalValidator(
                  errorsSchema[key] as StandardSchemaV1,
                  { type: key, ...data },
                  null,
                  false,
                  error
                );
              }

              return {
                data: null,
                error: ZagoraError.fromCaughtError(
                  error,
                  "An async handler threw unknown error"
                ),
                isDefined: false,
              };
            });
        }

        const outputResult = outputSchema
          ? (generalValidator(outputSchema, rawResult) as
              | {
                  data: InferSchemaOutput<typeof outputSchema>;
                  error: null;
                  isDefined: boolean;
                }
              | { data: null; error: ZagoraError; isDefined: boolean })
          : { data: rawResult, error: null, isDefined: false };

        if (outputResult.error) {
          return outputResult;
        }

        return outputResult;
      } catch (error: unknown) {
        if (errorsSchema && isZagoraTypedError(error)) {
          const key = (error.data as any).type;
          // console.log("error schema", errorsSchema[key].def.shape);
          return generalValidator(
            errorsSchema[key] as StandardSchemaV1,
            error.data,
            null,
            false,
            error
          );
        }

        return {
          data: null,
          error: ZagoraError.fromCaughtError(
            error,
            "Synchronous handler threw unknown error"
          ),
          isDefined: false,
        };
      }
    };

    type HandlerResult = ReturnType<typeof wrapper> extends Promise<infer R>
      ? Promise<
          ZagoraResult<
            TOutputSchema extends undefined ? AnySchema : TOutputSchema,
            TErrorsSchema
          >
        >
      : ZagoraResult<TOutputSchema, TErrorsSchema>;

    // Forward (call-site) signatures
    type InputArgs = InferSchemaInput<TFuncInput>;
    type SingleArg = InputArgs extends readonly any[] ? never : InputArgs;
    type TupleArgs = InputArgs extends readonly any[] ? InputArgs : never;

    type ForwardType = InputArgs extends readonly any[]
      ? OverloadedByPrefixes<
          TupleArgs extends readonly any[] ? [...TupleArgs] : never,
          HandlerResult
        > &
          ((...args: TupleArgs) => HandlerResult)
      : SingleArg extends Record<string, any>
        ? ((arg: SingleArg) => HandlerResult) &
            OverloadedByPrefixes<[SingleArg], HandlerResult>
        : ((arg: SingleArg) => HandlerResult) &
            OverloadedByPrefixes<[SingleArg], HandlerResult>;

    const forwardImpl = (...args: any[]) => {
      const resp = wrapper(...(args as unknown[]));

      if (resp instanceof Promise) {
        return resp.then((x) => createResult(x.data, x.error, x.isDefined));
      }

      return createResult(resp.data, resp.error, resp.isDefined);
    };
    const forward = forwardImpl as unknown as ForwardType;

    return forward;
  }
}

// ===== EXAMPLE USAGES

const zagora = new Zagora();

const foo = zagora
  .input(z.tuple([z.number(), z.string()]))
  .output(z.string())
  .errors({
    AUTH_ERROR: z.object({
      type: z.literal("AUTH_ERROR"),
      userId: z.uuid(),
      email: z.email().default("sasa@example.com"),
    }),
    RATE_LIMIT_ERROR: z.object({
      type: z.literal("RATE_LIMIT_ERROR"),
      userId: z.uuid(),
      email: z.email().default("sasa@example.com"),
      retryAfter: z.number().min(300),
      attempts: z.number().min(10),
    }),
  })
  .handler((num, mode, errors) => {
    if (mode === "login") {
      return errors.AUTH_ERROR({
        userId: crypto.randomUUID(),
        // email: "sasa@example.com",
      });
    }

    if (mode === "auth") {
      return errors.RATE_LIMIT_ERROR({
        userId: crypto.randomUUID(),
        email: "random@user.com",
        retryAfter: 300,
        attempts: 10,
      });
    }

    return `foo-${num}`;
  });

const bar = foo(123);

console.log("foo::::", bar.error, "<<<");
