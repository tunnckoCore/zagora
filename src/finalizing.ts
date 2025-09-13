import type { StandardSchemaV1 } from "@standard-schema/spec";
import z from "zod";
import {
  createErrorHelpers,
  createResult,
  generalValidator,
  handleError,
  isAsyncFunction,
  validateInput,
  ZagoraError,
} from "./utils.ts";
import type {
  AnySchema,
  InferSchemaInput,
  InferSchemaOutput,
  OverloadedByPrefixes,
  ZagoraDef,
  ZagoraErrorHelpers,
  ZagoraResult,
} from "./zagora-v3-types.ts";

// zagora()
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

  handler<
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
              return (
                handleError(data, errorsSchema) ??
                (outputSchema
                  ? generalValidator(outputSchema, data)
                  : { data, error: null, isDefined: false })
              );
            })
            .catch((error) => {
              return (
                handleError(error, errorsSchema) ?? {
                  data: null,
                  error: ZagoraError.fromCaughtError(
                    error,
                    "An async handler threw unknown error"
                  ),
                  isDefined: false,
                }
              );
            });
        }

        const returnedError = handleError(rawResult, errorsSchema);
        if (returnedError) {
          return returnedError;
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
        return (
          handleError(error, errorsSchema) ?? {
            data: null,
            error: ZagoraError.fromCaughtError(
              error,
              "Synchronous handler threw unknown error"
            ),
            isDefined: false,
          }
        );
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
      : ((arg: SingleArg) => HandlerResult) &
          OverloadedByPrefixes<[SingleArg], HandlerResult>;
    // : SingleArg extends Record<string, any>
    //   ? ((arg: SingleArg) => HandlerResult) &
    //       OverloadedByPrefixes<[SingleArg], HandlerResult>
    //   : ((arg: SingleArg) => HandlerResult) &
    //       OverloadedByPrefixes<[SingleArg], HandlerResult>;

    type ForwardWithHandler<T> = {
      "~zagora": ZagoraDef<
        TInputSchema,
        TOutputSchema,
        TOptionsSchema,
        TErrorsSchema
      > & { handler: T };
    };

    const forwardImpl = ((...args: any[]) => {
      const resp = wrapper(...(args as unknown[]));

      if (resp instanceof Promise) {
        return resp.then((x) => createResult(x.data, x.error, x.isDefined));
      }

      return createResult(resp.data, resp.error, resp.isDefined);
    }) as unknown as ForwardType;

    const forward =
      forwardImpl as unknown as ForwardType as typeof forwardImpl &
        ForwardWithHandler<typeof forwardImpl>;

    forward["~zagora"] = { ...this["~zagora"], handler: forward };

    return forward;
  }
}

// ===== EXAMPLE USAGES

const zagora = new Zagora();

const foo = zagora
  .input(z.tuple([z.number(), z.string().default("barry")]))
  // .input(z.string())
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
  //
  // TODO: doesn't seem to work properly, when defined
  // you can't get options in the handler (all args are typed as any)
  // Gotta be something to do with the ForwardType, TupleArgs and so on.
  // Tho, it doesn't work even if `.input(z.string())` so it's not only tuple related.
  //
  // .options(z.object({
  //   foo: z.string().default("bar"),
  // }))
  .handler((num, mode, errors) => {
    if (mode === "login") {
      return errors.AUTH_ERROR({
        userId: crypto.randomUUID(),
        // sasa: 121,
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

// NOTE (works): should type error when there is a second required argument,
// defined in the tuple input schema.
// NOTE (works): should not type error when there's second arg but has set as optional/default.
const bar = foo(123);

console.log("foo::::", bar.error, "<<<");
