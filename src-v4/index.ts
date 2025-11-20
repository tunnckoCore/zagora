import type { StandardSchemaV1 } from "@standard-schema/spec";
import { ZagoraError } from "../src/error.ts";
import type { AnySchema, InferSchemaOutput } from "../src/types.ts";

import {
  createErrorHelpers,
  createResult,
  generalValidator,
  handleError,
  isAsyncFunction,
  validateInput,
} from "../src/utils.ts";

import type {
  BuilderDef,
  CallableType,
  InferOutput,
  InferSchemaInput,
  InputArgs,
  IsTupleSchema,
  OverloadedByPrefixes,
  ProcedureDef,
  ProcedureOptions,
  ResolveArgs,
  TupleForwardOverloads,
  ZagoraResult,
} from "./types.ts";

export class Builder<
  TContext = undefined,
  TInputSchema extends AnySchema | undefined = undefined,
  TOutputSchema extends AnySchema | undefined = undefined,
  TErrors extends Record<string, StandardSchemaV1> | undefined = undefined,
> {
  constructor(
    def?: Partial<BuilderDef<TContext, TInputSchema, TOutputSchema, TErrors>>,
  ) {
    this.def = {
      contextType: undefined as TContext,
      inputSchema: undefined as TInputSchema,
      outputSchema: undefined as TOutputSchema,
      errorsSchema: undefined as TErrors,
      ...def,
    };
  }

  private def: BuilderDef<TContext, TInputSchema, TOutputSchema, TErrors>;

  $context<TNewContext>(): Builder<
    TNewContext,
    TInputSchema,
    TOutputSchema,
    TErrors
  > {
    return new Builder<TNewContext, TInputSchema, TOutputSchema, TErrors>({
      ...this.def,
      contextType: undefined as TNewContext,
    });
  }

  input<TSchema extends AnySchema>(
    schema: TSchema,
  ): Builder<TContext, TSchema, TOutputSchema, TErrors> {
    return new Builder<TContext, TSchema, TOutputSchema, TErrors>({
      ...this.def,
      inputSchema: schema,
    });
  }

  output<TSchema extends AnySchema>(
    schema: TSchema,
  ): Builder<TContext, TInputSchema, TSchema, TErrors> {
    return new Builder<TContext, TInputSchema, TSchema, TErrors>({
      ...this.def,
      outputSchema: schema,
    });
  }

  errors<TErrorsMap extends Record<string, StandardSchemaV1>>(
    errorsMap: TErrorsMap,
  ): Builder<TContext, TInputSchema, TOutputSchema, TErrorsMap> {
    return new Builder<TContext, TInputSchema, TOutputSchema, TErrorsMap>({
      ...this.def,
      errorsSchema: errorsMap,
    });
  }

  // FIX: We capture the specific return type (TReturn) here
  handler<
    TReturn extends TOutputSchema extends AnySchema
      ? InferOutput<TOutputSchema> | Promise<InferOutput<TOutputSchema>>
      : any | Promise<any>,
    TArgs extends ResolveArgs<TInputSchema> = ResolveArgs<TInputSchema>,
  >(
    fn: (
      options: ProcedureOptions<TContext, TErrors>,
      ...args: InputArgs<TInputSchema>
    ) => TReturn,
  ): Procedure<
    TContext,
    TInputSchema,
    TOutputSchema,
    TErrors,
    TReturn extends Promise<any> ? true : false,
    TArgs
  > {
    return new Procedure({
      ...this.def,
      handler: fn,
    });
  }
}

export class Procedure<
  TContext = undefined,
  TInputSchema extends AnySchema | undefined = undefined,
  TOutputSchema extends AnySchema | undefined = undefined,
  TErrors extends Record<string, StandardSchemaV1> | undefined = undefined,
  TIsAsync extends boolean = boolean,
  TArgs extends any[] = [],
> {
  constructor(
    private def: ProcedureDef<TContext, TInputSchema, TOutputSchema, TErrors>,
  ) {}

  callable<
    TFuncInput extends StandardSchemaV1 = TInputSchema extends undefined
      ? any
      : TInputSchema,
  >(context?: TContext) {
    const isAsync = isAsyncFunction(this.def.handler);
    const impl = this.def.handler;

    const inputSchema = this.def.inputSchema;
    const outputSchema = this.def.outputSchema;
    const errorsSchema = this.def.errorsSchema;

    const errs = errorsSchema
      ? createErrorHelpers(errorsSchema, isAsync)
      : null;

    const ctx = context ? { context } : undefined;
    const errors = errs ? { errors: errs } : undefined;
    const options = ctx || errors ? { ...ctx, ...errors } : undefined;

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

      try {
        const finalArgs =
          isArraySchema || isPrimitiveSchema ? [processed] : [...processed];

        const rawResult = (impl as any)(options, ...finalArgs);

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

    type ResultType = ZagoraResult<TOutputSchema, TErrors>;

    const forwardImpl = (...args: any[]) => {
      const resp = wrapper(args as unknown[], "____$$MAGIC_VALUE_");
      if (resp instanceof Promise) {
        return resp.then((x) => createResult(x.data, x.error, x.isDefined));
      }
      return createResult(resp.data, resp.error, resp.isDefined);
    };

    // The result is exactly what we want:
    // (...args: TArgs) => Promise<Result> | Result
    return forwardImpl as unknown as (
      ...args: TArgs
    ) => TIsAsync extends true ? Promise<ResultType> : ResultType;
  }
}

export function zagora() {
  return new Builder();
}
