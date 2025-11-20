import type { StandardSchemaV1 } from "@standard-schema/spec";
import { ZagoraError } from "./error.ts";
import type {
  AnySchema,
  InferSchemaInput,
  InferSchemaOutput,
  IsTupleSchema,
  OverloadedByPrefixes,
  TupleForwardOverloads,
  ZagoraDef,
  ZagoraErrorHelpers,
  ZagoraResult,
} from "./types.ts";

import {
  createErrorHelpers,
  createResult,
  generalValidator,
  handleError,
  isAsyncFunction,
  validateInput,
} from "./utils.ts";

export * from "./error.ts";
export * from "./types.ts";
export * from "./utils.ts";

export const zagora = () => {
  return new Zagora();
};

export class Zagora<
  TInputSchema extends AnySchema | undefined = undefined,
  TOutputSchema extends AnySchema | undefined = undefined,
  TErrorsSchema extends
    | Record<string, StandardSchemaV1>
    | undefined = undefined,
  TContext = undefined,
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

  $context<TNewContext>(
    initialContext?: TNewContext,
  ): Zagora<TInputSchema, TOutputSchema, TErrorsSchema, TNewContext> {
    return new Zagora({
      ...this["~zagora"],
      contextType: initialContext ?? ({} as TNewContext),
    } as ZagoraDef<TInputSchema, TOutputSchema, TErrorsSchema, TNewContext>);
  }

  handler<
    TFuncInput extends StandardSchemaV1 = TInputSchema extends undefined
      ? any
      : TInputSchema,
    TOutArgs = InferSchemaInput<TFuncInput>,
    Impl extends (...args: any[]) => any = TContext extends undefined
      ? // No context - original behavior
        TErrorsSchema extends Record<string, StandardSchemaV1>
        ? IsTupleSchema<TFuncInput> extends true
          ? TOutArgs extends readonly any[]
            ? (...args: [...TOutArgs, ZagoraErrorHelpers<TErrorsSchema>]) => any
            : never
          : (arg: TOutArgs, errors: ZagoraErrorHelpers<TErrorsSchema>) => any
        : IsTupleSchema<TFuncInput> extends true
          ? TOutArgs extends readonly any[]
            ? (...args: TOutArgs) => any
            : never
          : (arg: TOutArgs) => any
      : // With context - handler receives { input, context }
        TErrorsSchema extends Record<string, StandardSchemaV1>
        ? (
            { input, context }: { input: TOutArgs; context: TContext },
            errors: ZagoraErrorHelpers<TErrorsSchema>,
          ) => any
        : ({ input, context }: { input: TOutArgs; context: TContext }) => any,
  >(impl: Impl) {
    const isAsync = isAsyncFunction(impl);

    const inputSchema = this["~zagora"].inputSchema || undefined;
    const outputSchema = this["~zagora"].outputSchema || undefined;
    const errorsSchema = this["~zagora"].errorsSchema || undefined;

    const schemaAny = inputSchema as any;

    const isTupleSchema =
      (schemaAny?._def && schemaAny?._def?.type === "tuple") ||
      schemaAny?.type === "tuple";

    const isArraySchema =
      (schemaAny?._def && schemaAny?._def?.type === "array") ||
      schemaAny?.type === "array";

    const isPrimitiveSchema = !isTupleSchema;

    const wrapper = (rawArgs: any, processed: any) => {
      const contextType = this["~zagora"].contextType;
      const isContextMode = contextType !== undefined;

      if (
        processed === "____$$MAGIC_VALUE_" &&
        inputSchema &&
        inputSchema["~standard"]
      ) {
        let inputToValidate: any;
        if (isContextMode) {
          // In context mode, rawArgs[0] is { input, context }
          const args = rawArgs[0];
          if (!args || typeof args !== "object" || !("input" in args)) {
            return {
              data: null,
              error: new ZagoraError(
                "Context mode requires { input, context } object",
              ),
              isDefined: false,
            };
          }
          inputToValidate = [args.input];
        } else {
          inputToValidate = rawArgs;
        }

        const inputResult = validateInput(inputSchema, inputToValidate);

        if (inputResult instanceof Promise) {
          return inputResult.then((res): any => {
            if (res.error) {
              return res;
            }

            return wrapper(rawArgs, res.data);
          });
        }

        if (inputResult.error) {
          return inputResult;
        }
        return wrapper(rawArgs, inputResult.data);
      }

      try {
        const errs = errorsSchema
          ? createErrorHelpers(errorsSchema, isAsync)
          : null;

        let finalArgs: any[];
        if (isContextMode) {
          // In context mode, rawArgs[0] is { input, context }, processed is validated input
          const context = rawArgs[0].context;
          finalArgs = [{ input: processed, context }];
          if (errs) finalArgs.push(errs);
        } else {
          // Original behavior
          finalArgs =
            isArraySchema || isPrimitiveSchema
              ? [processed, errs]
              : [...processed, errs];
        }

        const rawResult = (impl as any)(...finalArgs.filter(Boolean));

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
      } catch (error: unknown) {
        const typedError = handleError(error, errorsSchema);
        if (typedError) return typedError;
        if (error instanceof ZagoraError) {
          return { data: null, error, isDefined: false };
        }
        return {
          data: null,
          error: new ZagoraError("Synchronous handler threw unknown error", {
            cause: error,
          }),
          isDefined: false,
        };
      }
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

    // Forward (call-site) signatures
    type InputArgs = InferSchemaInput<TFuncInput>;

    type ForwardType = TContext extends undefined
      ? // No context: original calling signature
        IsTupleSchema<TFuncInput> extends true
        ? // Tuple: generate prefix overloads including full length
          InputArgs extends readonly any[]
          ? TupleForwardOverloads<InputArgs, HandlerResult>
          : never
        : // Not a tuple (array or primitive): single argument
          ((arg: InputArgs) => HandlerResult) &
            OverloadedByPrefixes<[InputArgs], HandlerResult>
      : // Context mode: accept { input, context }
        (args: { input: InputArgs; context: TContext }) => HandlerResult;

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

    const forwardImpl = ((...args: any[]) => {
      const rawArgs = "input" in args && "context" in args ? [args] : args;
      const result = wrapper(rawArgs, "____$$MAGIC_VALUE_");
      if (result instanceof Promise) {
        return result.then((x) => createResult(x.data, x.error, x.isDefined));
      }
      return createResult(result.data, result.error, result.isDefined);
    }) as unknown as ForwardType;

    const forward =
      forwardImpl as unknown as ForwardType as typeof forwardImpl &
        ForwardWithHandler<typeof forwardImpl>;

    forward["~zagora"] = { ...this["~zagora"], handler: forward };

    return forward;
  }
}

// ===== EXAMPLE USAGES

// const zag = new Zagora();

// const foo = zag
//   .input(
//     z.tuple([
//       z.enum(["login", "auth", "foobie"]),
//       z
//         .object({
//           name: z.string(),
//           age: z.number().min(0),
//           username: z.string().optional(),
//         })
//         .strict()
//         .default({
//           name: "barry",
//           age: 0,
//           // username: undefined,
//         }),
//     ]),
//   )
//   // .input(z.string())
//   .output(
//     z
//       .object({
//         opts: z.any(),
//         str: z.string().min(1),
//       })
//       .strict(),
//   )
//   .errors({
//     AUTH_ERROR: z.object({
//       type: z.literal("AUTH_ERROR"),
//       userId: z.uuid(),
//       email: z.email().default("sasa@example.com"),
//     }),
//     RATE_LIMIT_ERROR: z.object({
//       type: z.literal("RATE_LIMIT_ERROR"),
//       userId: z.uuid(),
//       email: z.email().default("sasa@example.com"),
//       retryAfter: z.number().min(300),
//       attempts: z.number().min(10),
//     }),
//   })
//   .handler((mode, opts, errors) => {
//     if (mode === "login") {
//       return errors.AUTH_ERROR({
//         userId: crypto.randomUUID(),
//         // sasa: 121,
//         // email: "sasa@example.com",
//       });
//     }

//     if (mode === "auth") {
//       return errors.RATE_LIMIT_ERROR({
//         userId: crypto.randomUUID(),
//         email: "random@user.com",
//         retryAfter: 300,
//         attempts: 10,
//       });
//     }

//     // console.log({ opts, mode, errors });
//     return {
//       str: `foo-${mode}`,
//       opts,
//     };
//   });

// // NOTE (works): should type error when there is a second required argument,
// // defined in the tuple input schema.
// // NOTE (works): should not type error when there's second arg but has set as optional/default.
// const bar = foo("foobie", {
//   age: 11,
//   name: "barry",
//   username: "asasa",
// });

// console.log(
//   "foo::::",
//   {
//     data: bar.data,
//     error: bar.error,
//   },
//   "<<<",
// );
