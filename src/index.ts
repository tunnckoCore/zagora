import type { StandardSchemaV1 } from "@standard-schema/spec";
import { ZagoraError } from "./error.ts";
import type {
  AnySchema,
  InferSchemaInput,
  InferSchemaOutput,
  OverloadedByPrefixes,
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
> {
  "~zagora": ZagoraDef<TInputSchema, TOutputSchema, TErrorsSchema>;

  constructor(def?: ZagoraDef<TInputSchema, TOutputSchema, TErrorsSchema>) {
    this["~zagora"] = def || {};
  }

  input<TSchema extends AnySchema>(
    schema: TSchema,
  ): Zagora<TSchema, TOutputSchema, TErrorsSchema> {
    return new Zagora({
      ...this["~zagora"],
      inputSchema: schema,
    });
  }

  output<TSchema extends AnySchema>(
    schema: TSchema,
  ): Zagora<TInputSchema, TSchema, TErrorsSchema> {
    return new Zagora({
      ...this["~zagora"],
      outputSchema: schema,
    });
  }

  errors<TErrorsSchemaMap extends Record<string, StandardSchemaV1>>(
    errorsMap: TErrorsSchemaMap,
  ): Zagora<TInputSchema, TOutputSchema, TErrorsSchemaMap> {
    return new Zagora({
      ...this["~zagora"],
      errorsSchema: errorsMap,
    });
  }

  handler<
    TFuncInput extends StandardSchemaV1 = TInputSchema extends undefined
      ? any
      : TInputSchema,
    TOutArgs = InferSchemaInput<TFuncInput>,
    Impl extends (...args: any[]) => any = TErrorsSchema extends Record<
      string,
      StandardSchemaV1
    >
      ? TOutArgs extends readonly any[]
        ? (...args: [...TOutArgs, ZagoraErrorHelpers<TErrorsSchema>]) => any
        : (arg: TOutArgs, errors: ZagoraErrorHelpers<TErrorsSchema>) => any
      : TOutArgs extends readonly any[]
        ? (...args: TOutArgs) => any
        : (arg: TOutArgs) => any,
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
      if (
        processed === "____$$MAGIC_VALUE_" &&
        inputSchema &&
        inputSchema["~standard"]
      ) {
        const inputResult = validateInput(inputSchema, rawArgs);

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

      // const processedInput =
      //   processed === "$__MAGIC_VALUE_"
      //     ? []
      //     : processed ? [];

      try {
        const errs = errorsSchema
          ? createErrorHelpers(errorsSchema, isAsync)
          : null;

        const finalArgs =
          isArraySchema || isPrimitiveSchema
            ? [processed, errs]
            : [...processed, errs];

        const rawResult = (impl as any)(...finalArgs.filter(Boolean));

        if (rawResult instanceof Promise) {
          return rawResult
            .then((data) => {
              return (
                handleError(data, errorsSchema) ??
                (outputSchema
                  ? generalValidator(outputSchema, data, null, true)
                  : { data, error: null, isDefined: false })
              );
            })
            .catch((error) => {
              return (
                handleError(error, errorsSchema) ?? {
                  data: null,
                  error: ZagoraError.fromCaughtError(
                    error,
                    "An async handler threw unknown error",
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
        return (
          handleError(error, errorsSchema) ?? {
            data: null,
            error: ZagoraError.fromCaughtError(
              error,
              "Synchronous handler threw unknown error",
            ),
            isDefined: false,
          }
        );
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

    type ForwardWithHandler<T> = {
      "~zagora": ZagoraDef<TInputSchema, TOutputSchema, TErrorsSchema> & {
        handler: T;
      };
    };

    const forwardImpl = ((...args: any[]) => {
      const resp = wrapper(args as unknown[], "____$$MAGIC_VALUE_");

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
