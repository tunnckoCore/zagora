import {
  createErrorHelpers,
  type ErrorsMapResolved,
  type ResolveErrorKindNames,
} from "./errors";

import type {
  AnySchema,
  InferSchemaInput,
  InferSchemaInputSafe,
  InferSchemaOutput,
  InferSchemaOutputSafe,
  IsPromise,
  Prettify,
  ProcedureOptions,
  SpreadTuple,
  UppercaseKeys,
  ZagoraDef,
  ZagoraResult,
} from "./types";

import { createProcedure, deepMerge } from "./utils";

export * as errors from "./errors";
export * as types from "./types";
export * as utils from "./utils";

export function zagora() {
  return new Zagora();
}

export class Zagora<
  TIsHandlerAsync,
  THandlerFn,
  TContext extends any | undefined = undefined,
  TInputSchema extends AnySchema | undefined = undefined,
  TOutputSchema extends AnySchema | undefined = undefined,
  TErrorsMap extends Record<string, AnySchema> | undefined = undefined,
> {
  constructor(
    private def: Partial<
      ZagoraDef<TContext, TInputSchema, TOutputSchema, TErrorsMap>
    > = {},
  ) {}

  input<TInput extends AnySchema>(
    inputSchema: TInput,
  ): Zagora<
    TIsHandlerAsync,
    THandlerFn,
    TContext,
    TInput,
    TOutputSchema,
    TErrorsMap
  > {
    return new Zagora({
      ...this.def,
      inputSchema,
    });
  }

  output<TOutput extends AnySchema>(
    outputSchema: TOutput,
  ): Zagora<
    TIsHandlerAsync,
    THandlerFn,
    TContext,
    TInputSchema,
    TOutput,
    TErrorsMap
  > {
    return new Zagora({
      ...this.def,
      outputSchema,
    });
  }

  context<TNewContext>(
    initialContext?: TNewContext,
  ): Zagora<
    TIsHandlerAsync,
    THandlerFn,
    TNewContext,
    TInputSchema,
    TOutputSchema,
    TErrorsMap
  > {
    return new Zagora({
      ...this.def,
      initialContext,
    }) as any;
  }

  errors<TErrors extends Record<string, AnySchema>>(
    errorsMap: TErrors & UppercaseKeys<TErrors>,
  ): Zagora<
    TIsHandlerAsync,
    THandlerFn,
    TContext,
    TInputSchema,
    TOutputSchema,
    TErrors
  > {
    return new Zagora({
      ...this.def,
      errorsMap,
    });
  }

  handler<
    TFn extends TInputSchema extends AnySchema
      ? InferSchemaOutput<TInputSchema> extends readonly any[]
        ? SpreadTuple<
            [
              Prettify<ProcedureOptions<TContext, TErrorsMap>>,
              ...InferSchemaOutput<TInputSchema>,
            ],
            any
          >
        : (
            options: Prettify<ProcedureOptions<TContext, TErrorsMap>>,
            arg: InferSchemaOutput<TInputSchema>,
          ) => any
      : (options: Prettify<ProcedureOptions<TContext, TErrorsMap>>) => any,
    TReturn = ReturnType<TFn>,
    TIsAsync extends boolean = IsPromise<TReturn>,
  >(
    fn: TFn,
  ): Zagora<TIsAsync, TFn, TContext, TInputSchema, TOutputSchema, TErrorsMap> {
    return new Zagora({
      ...this.def,
      handler: fn as any,
    });
  }

  callable<
    TNewContext extends TContext,
    TKindNames extends ResolveErrorKindNames<TErrorsMap>,
  >(context?: TNewContext) {
    if (typeof this.def.handler !== "function") {
      this.def.handler = () => {};
    }

    const { initialContext, errorsMap } = this.def;
    const handlerFn = this.def.handler;
    const inputSchema = this.def.inputSchema as TInputSchema;
    const outputSchema = this.def.outputSchema as TOutputSchema;

    const mergedContext = context
      ? deepMerge(initialContext, context)
      : initialContext;

    const errors = errorsMap ? createErrorHelpers(errorsMap as any) : undefined;
    const options = {
      errors: errors,
      context: mergedContext,
    } as Prettify<
      ProcedureOptions<Prettify<TNewContext & TContext>, TErrorsMap>
    >;

    const procedure = createProcedure<TKindNames>({
      inputSchema,
      outputSchema,
      errorsMap,
      options,
      handlerFn,
    });

    type TResolvedResult = Awaited<ReturnType<typeof procedure>>;

    type TResult = TIsHandlerAsync extends true
      ? Promise<
          ZagoraResult<
            InferSchemaOutputSafe<TOutputSchema>,
            ErrorsMapResolved<TErrorsMap>,
            TResolvedResult
          >
        >
      : ZagoraResult<
          InferSchemaOutputSafe<TOutputSchema>,
          ErrorsMapResolved<TErrorsMap>,
          TResolvedResult
        >;

    return procedure as TInputSchema extends AnySchema
      ? InferSchemaInput<TInputSchema> extends readonly any[]
        ? SpreadTuple<InferSchemaInput<TInputSchema>, TResult>
        : (arg: InferSchemaOutput<TInputSchema>) => TResult
      : () => TResult;
  }
}
