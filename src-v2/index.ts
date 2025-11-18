import type { StandardSchemaV1 } from "@standard-schema/spec";
import { ZagoraError } from "./error";
import type {
  AnyContext,
  AnySchema,
  HandlerArg,
  InferSchemaInput,
  InferSchemaOutput,
  IsArraySchema,
  IsTupleSchema,
  MiddlewareFunction,
  OverloadedByPrefixes,
  StoredMiddleware,
  TupleForwardOverloads,
  ZagoraDef,
  ZagoraErrorHelpers,
  ZagoraResult,
} from "./types";

import {
  createErrorHelpers,
  createResult,
  executeMiddlewares,
  generalValidator,
  handleError,
  validateInput,
} from "./utils";

export * from "./error";
export * from "./types";
export * from "./utils";

export const zagora = () => {
  return new Zagora();
};

export class Zagora<
  TInputSchema extends AnySchema | undefined = undefined,
  TOutputSchema extends AnySchema | undefined = undefined,
  TErrorsSchema extends
    | Record<string, StandardSchemaV1>
    | undefined = undefined,
  TContext extends AnyContext | undefined = undefined,
> {
  "~zagora": ZagoraDef<TInputSchema, TOutputSchema, TErrorsSchema, TContext>;

  constructor(
    def?: ZagoraDef<TInputSchema, TOutputSchema, TErrorsSchema, TContext>,
  ) {
    this["~zagora"] = def || {};
  }

  input<TSchema extends AnySchema>(
    schema: TSchema,
  ): Zagora<TSchema, TOutputSchema, TErrorsSchema, TContext> {
    return new Zagora({
      ...this["~zagora"],
      inputSchema: schema,
    });
  }

  output<TSchema extends AnySchema>(
    schema: TSchema,
  ): Zagora<TInputSchema, TSchema, TErrorsSchema, TContext> {
    return new Zagora({
      ...this["~zagora"],
      outputSchema: schema,
    });
  }

  errors<TErrorsSchemaMap extends Record<string, StandardSchemaV1>>(
    errorsMap: TErrorsSchemaMap,
  ): Zagora<TInputSchema, TOutputSchema, TErrorsSchemaMap, TContext> {
    return new Zagora({
      ...this["~zagora"],
      errorsSchema: errorsMap,
    });
  }

  $context<TCtx extends AnyContext = Record<string, never>>(): Zagora<
    TInputSchema,
    TOutputSchema,
    TErrorsSchema,
    TCtx
  > {
    return new Zagora({
      ...this["~zagora"],
      contextType: {} as TCtx,
      middlewares: [],
    });
  }

  middleware<
    TMWInput = TInputSchema extends AnySchema
      ? InferSchemaInput<TInputSchema>
      : undefined,
  >(
    fn: (args: {
      context: TContext extends AnyContext ? TContext : never;
      input: TMWInput;
      errors: TErrorsSchema extends Record<string, StandardSchemaV1>
        ? ZagoraErrorHelpers<TErrorsSchema>
        : undefined;
      next: (args?: {
        context?: TContext extends AnyContext ? TContext : never;
        input?: TMWInput;
      }) => any;
    }) => any,
  ): MiddlewareFunction<
    TContext extends AnyContext ? TContext : never,
    TMWInput,
    TErrorsSchema extends Record<string, StandardSchemaV1>
      ? ZagoraErrorHelpers<TErrorsSchema>
      : undefined
  > {
    return fn;
  }

  use<TMWInput = any>(
    middleware: MiddlewareFunction<
      TContext extends AnyContext ? TContext : never,
      TMWInput,
      TErrorsSchema extends Record<string, StandardSchemaV1>
        ? ZagoraErrorHelpers<TErrorsSchema>
        : undefined
    >,
    inputMapper?: (
      input: TInputSchema extends AnySchema
        ? InferSchemaInput<TInputSchema>
        : undefined,
    ) => TMWInput,
  ): Zagora<TInputSchema, TOutputSchema, TErrorsSchema, TContext> {
    const currentMiddlewares = this["~zagora"].middlewares ?? [];
    // If no mapper provided and middleware expects a specific input type,
    // it should match the procedure's input type
    return new Zagora({
      ...this["~zagora"],
      middlewares: [
        ...currentMiddlewares,
        { fn: middleware as any, inputMapper },
      ],
    });
  }

  handler<
    TFuncInput extends StandardSchemaV1 = TInputSchema extends undefined
      ? any
      : TInputSchema,
    TOutArgs = InferSchemaInput<TFuncInput>,
    Impl extends (...args: any[]) => any = TContext extends undefined
      ? TOutArgs extends readonly [any, ...any[]]
        ? TErrorsSchema extends Record<string, StandardSchemaV1>
          ? (...args: [...TOutArgs, ZagoraErrorHelpers<TErrorsSchema>]) => any
          : (...args: [...TOutArgs]) => any
        : TOutArgs extends [any, ...any[]]
          ? TErrorsSchema extends Record<string, StandardSchemaV1>
            ? (...args: [...TOutArgs, ZagoraErrorHelpers<TErrorsSchema>]) => any
            : (...args: [...TOutArgs]) => any
          : TErrorsSchema extends Record<string, StandardSchemaV1>
            ? (arg: TOutArgs, errors: ZagoraErrorHelpers<TErrorsSchema>) => any
            : (arg: TOutArgs) => any
      : (arg: HandlerArg<TInputSchema, TContext, TErrorsSchema>) => any,
  >(impl: Impl) {
    const inputSchema = this["~zagora"].inputSchema || undefined;
    const outputSchema = this["~zagora"].outputSchema || undefined;
    const errorsSchema = this["~zagora"].errorsSchema || undefined;
    const middlewares = this["~zagora"].middlewares || [];
    const hasContext = this["~zagora"].contextType !== undefined;

    const schemaAny = inputSchema as any;

    const isTupleSchema =
      (schemaAny?._def && schemaAny?._def?.type === "tuple") ||
      schemaAny?.type === "tuple";

    const isArraySchema =
      (schemaAny?._def && schemaAny?._def?.type === "array") ||
      schemaAny?.type === "array";

    const isPrimitiveSchema = !isTupleSchema;

    const wrapper = (rawArgs: any, processed: any, context: any = null) => {
      if (
        processed === "____$$MAGIC_VALUE_" &&
        inputSchema &&
        inputSchema["~standard"]
      ) {
        const inputResult = validateInput(inputSchema, rawArgs);

        if (inputResult instanceof Promise) {
          return inputResult.then((res): any => {
            if ((res as any).error) {
              return res;
            }

            return wrapper(rawArgs, (res as any).data, context);
          });
        }

        if ((inputResult as any).error) {
          return inputResult;
        }
        return wrapper(rawArgs, (inputResult as any).data, context);
      }

      const errs = errorsSchema ? createErrorHelpers(errorsSchema) : null;

      let handlerArgs: any[];

      if (hasContext) {
        const arg: any = {
          input: processed,
          context,
        };
        if (errs) {
          arg.errors = errs;
        }
        handlerArgs = [arg];
      } else if (isArraySchema || isPrimitiveSchema) {
        handlerArgs = [processed, errs];
      } else {
        handlerArgs = [...processed, errs];
      }

      const rawResult = (impl as any)(...handlerArgs.filter(Boolean));

      if (rawResult instanceof Promise) {
        return rawResult
          .then((data) => {
            const typedError = handleError(data, errorsSchema);
            if (typedError) return typedError;
            return outputSchema
              ? generalValidator(outputSchema, data, null, true)
              : { data, error: null, isDefined: false };
          })
          .catch((error) => {
            const typedError = handleError(error, errorsSchema);
            if (typedError) return typedError;
            if (error instanceof ZagoraError) {
              return { data: null, error, isDefined: false };
            }
            return {
              data: null,
              error: new ZagoraError("An async handler threw unknown error", {
                cause: error,
              }),
              isDefined: false,
            };
          });
      }

      const typedError = handleError(rawResult, errorsSchema);
      if (typedError) return typedError;

      const outputResult = outputSchema
        ? (generalValidator(outputSchema, rawResult, null, true) as
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
    };

    type IsOnlyPromise<T> = [T] extends [never]
      ? false
      : Exclude<T, Promise<any>> extends never
        ? true
        : false;

    type ImplReturn = ReturnType<Impl>;
    type HandlerResult = IsOnlyPromise<ImplReturn> extends true
      ? Promise<
          ZagoraResult<
            TOutputSchema extends undefined ? AnySchema : TOutputSchema,
            TErrorsSchema
          >
        >
      : ZagoraResult<TOutputSchema, TErrorsSchema>;

    type InputArgs = InferSchemaInput<TFuncInput>;

    type ForwardType = InputArgs extends readonly [any, ...any[]]
      ? // Tuple: generate prefix overloads
        TupleForwardOverloads<InputArgs, HandlerResult>
      : InputArgs extends [any, ...any[]]
        ? // Mutable tuple check
          TupleForwardOverloads<InputArgs, HandlerResult>
        : TContext extends undefined
          ? // Not a tuple (array or primitive): single argument
            InputArgs extends any[]
            ? (arg: InputArgs) => HandlerResult
            : ((arg: InputArgs) => HandlerResult) &
                OverloadedByPrefixes<[InputArgs], HandlerResult>
          : // With context: always single object arg
            (
              arg: HandlerArg<TInputSchema, TContext, TErrorsSchema>,
            ) => HandlerResult;

    type ForwardWithHandler<T> = {
      "~zagora": ZagoraDef<
        TInputSchema,
        TOutputSchema,
        TErrorsSchema,
        TContext
      > & {
        handler: T;
      };
    };

    const errorHelpers = errorsSchema ? createErrorHelpers(errorsSchema) : null;

    const forwardImpl = ((...args: any[]) => {
      if (hasContext && middlewares.length > 0) {
        const contextArg = args[0] ?? {};
        const inputVal = args[0]?.input;

        const middlewarePromise = executeMiddlewares(
          middlewares as any,
          contextArg,
          inputVal,
          errorHelpers,
        ).then((finalContext: any) => {
          const resp = wrapper([], inputVal, finalContext);

          if (resp instanceof Promise) {
            return resp.then((x) => createResult(x.data, x.error, x.isDefined));
          }

          return createResult(resp.data, resp.error, resp.isDefined);
        });

        return middlewarePromise;
      } else if (hasContext) {
        const contextArg = args[0] ?? {};
        const inputVal = args[0]?.input;
        const resp = wrapper([], inputVal, contextArg);

        if (resp instanceof Promise) {
          return resp.then((x) => createResult(x.data, x.error, x.isDefined));
        }

        return createResult(resp.data, resp.error, resp.isDefined);
      } else if (middlewares.length > 0) {
        const resp = wrapper(args as unknown[], "____$$MAGIC_VALUE_", null);

        if (resp instanceof Promise) {
          return resp.then((x) => {
            if (x.error) {
              return createResult(x.data, x.error, x.isDefined);
            }

            // Run middlewares with validated input
            return executeMiddlewares(
              middlewares as any,
              {},
              x.data,
              errorHelpers,
            ).then(() => {
              // After middlewares, call the actual handler
              const finalResp = wrapper([], x.data, null);

              if (finalResp instanceof Promise) {
                return finalResp.then((y) =>
                  createResult(y.data, y.error, y.isDefined),
                );
              }

              return createResult(
                finalResp.data,
                finalResp.error,
                finalResp.isDefined,
              );
            });
          });
        }

        if (resp.error) {
          return createResult(resp.data, resp.error, resp.isDefined);
        }

        // Run middlewares with validated input
        const middlewarePromise = executeMiddlewares(
          middlewares as any,
          {},
          resp.data,
          errorHelpers,
        ).then(() => {
          // After middlewares, call the actual handler
          const finalResp = wrapper([], resp.data, null);

          if (finalResp instanceof Promise) {
            return finalResp.then((x) =>
              createResult(x.data, x.error, x.isDefined),
            );
          }

          return createResult(
            finalResp.data,
            finalResp.error,
            finalResp.isDefined,
          );
        });

        return middlewarePromise;
      } else {
        const resp = wrapper(args as unknown[], "____$$MAGIC_VALUE_", null);

        if (resp instanceof Promise) {
          return resp.then((x) => createResult(x.data, x.error, x.isDefined));
        }

        return createResult(resp.data, resp.error, resp.isDefined);
      }
    }) as unknown as ForwardType;

    const forward =
      forwardImpl as unknown as ForwardType as typeof forwardImpl &
        ForwardWithHandler<typeof forwardImpl>;

    forward["~zagora"] = { ...this["~zagora"], handler: forward };

    return forward;
  }
}
