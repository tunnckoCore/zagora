import { createErrorHelpers, type ResolveErrorKindNames } from "./errors";
import type { ConditionalAsync, IsPromise } from "./is-promise";

import type {
  AnySchema,
  CacheAdapter,
  InferOutput,
  InferSchemaInput,
  Prettify,
  ResolveHandlerOptions,
  ResolveProcedure,
  SpreadTuple,
  UppercaseKeys,
  ZagoraDef,
  ZagoraResult,
} from "./types";

import { createProcedure, deepMerge } from "./utils";

export * as errors from "./errors";
export * as types from "./types";
export * as utils from "./utils";

export interface ZagoraConfig {
  disableOptions?: boolean;
  autoCallable?: boolean;
}

export function zagora(): Zagora<
  any,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  false
>;
export function zagora<
  TDisableOptions extends boolean = false,
  TAutoCallable extends boolean = false,
>(config: {
  disableOptions: TDisableOptions;
  autoCallable?: TAutoCallable;
}): Zagora<
  any,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  TDisableOptions,
  TAutoCallable
>;
export function zagora<TAutoCallable extends boolean = false>(config: {
  autoCallable: TAutoCallable;
  disableOptions?: boolean;
}): Zagora<
  any,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  false,
  TAutoCallable
>;
export function zagora(config?: ZagoraConfig) {
  return new Zagora(config) as any;
}

export class Zagora<
  THandlerFn extends (...args: any[]) => any,
  TContext extends any | undefined = undefined,
  TInputSchema extends AnySchema | undefined = undefined,
  TOutputSchema extends AnySchema | undefined = undefined,
  TErrorsMap extends Record<string, AnySchema> | undefined = undefined,
  TCacheAdapter extends CacheAdapter | undefined = undefined,
  TDisableOptions extends boolean = false,
  TAutoCallable extends boolean = false,
> {
  constructor(
    private def: Partial<
      ZagoraDef<
        TContext,
        TInputSchema,
        TOutputSchema,
        TErrorsMap,
        TCacheAdapter
      >
    > = {},
  ) {
    // Ensure config flags are set from constructor if provided
    if ("disableOptions" in def && def.disableOptions !== undefined) {
      this.def.disableOptions = def.disableOptions;
    }
    if ("autoCallable" in def && def.autoCallable !== undefined) {
      this.def.autoCallable = def.autoCallable;
    }
  }

  input<TInput extends AnySchema>(
    inputSchema: TInput,
  ): Zagora<
    THandlerFn,
    TContext,
    TInput,
    TOutputSchema,
    TErrorsMap,
    TCacheAdapter,
    TDisableOptions,
    TAutoCallable
  > {
    return new Zagora({
      ...this.def,
      inputSchema,
    });
  }

  output<TOutput extends AnySchema>(
    outputSchema: TOutput,
  ): Zagora<
    THandlerFn,
    TContext,
    TInputSchema,
    TOutput,
    TErrorsMap,
    TCacheAdapter,
    TDisableOptions,
    TAutoCallable
  > {
    return new Zagora({
      ...this.def,
      outputSchema,
    });
  }

  context<TNewContext>(
    initialContext?: TNewContext,
  ): Zagora<
    THandlerFn,
    TNewContext,
    TInputSchema,
    TOutputSchema,
    TErrorsMap,
    TCacheAdapter,
    TDisableOptions,
    TAutoCallable
  > {
    return new Zagora({
      ...this.def,
      initialContext,
    }) as any;
  }

  errors<TErrors extends Record<string, AnySchema>>(
    errorsMap: TErrors & UppercaseKeys<TErrors>,
  ): Zagora<
    THandlerFn,
    TContext,
    TInputSchema,
    TOutputSchema,
    TErrors,
    TCacheAdapter,
    TDisableOptions,
    TAutoCallable
  > {
    return new Zagora({
      ...this.def,
      errorsMap,
    });
  }

  cache<TNewCacheAdapter extends CacheAdapter>(
    cacheAdapter: TNewCacheAdapter,
  ): Zagora<
    THandlerFn,
    TContext,
    TInputSchema,
    TOutputSchema,
    TErrorsMap,
    TNewCacheAdapter,
    TDisableOptions,
    TAutoCallable
  > {
    return new Zagora({
      ...this.def,
      cacheAdapter,
    });
  }

  handler<
    TFn extends ResolveProcedure<
      TDisableOptions,
      TContext,
      TInputSchema,
      TErrorsMap
    >,
  >(
    fn: TFn,
  ): TAutoCallable extends true
    ? ReturnType<
        Zagora<
          TFn,
          TContext,
          TInputSchema,
          TOutputSchema,
          TErrorsMap,
          TCacheAdapter,
          TDisableOptions,
          TAutoCallable
        >["_createProcedure"]
      >
    : Zagora<
        TFn,
        TContext,
        TInputSchema,
        TOutputSchema,
        TErrorsMap,
        TCacheAdapter,
        TDisableOptions,
        TAutoCallable
      > {
    const newInstance = new Zagora<
      TFn,
      TContext,
      TInputSchema,
      TOutputSchema,
      TErrorsMap,
      TCacheAdapter,
      TDisableOptions,
      TAutoCallable
    >({
      ...this.def,
      handler: fn,
    });

    // If autoCallable is true, create the procedure immediately
    if (this.def.autoCallable) {
      return newInstance._createProcedure() as any;
    }

    return newInstance as any;
  }

  private _createProcedure<
    TNewContext extends TContext = TContext,
    TKindNames extends
      ResolveErrorKindNames<TErrorsMap> = ResolveErrorKindNames<TErrorsMap>,
  >(context?: TNewContext) {
    if (typeof this.def.handler !== "function") {
      this.def.handler = () => {};
    }

    const { initialContext, errorsMap, disableOptions } = this.def;
    const handlerFn = this.def.handler;
    const inputSchema = this.def.inputSchema as TInputSchema;
    const outputSchema = this.def.outputSchema as TOutputSchema;
    const cacheAdapter = this.def.cacheAdapter;

    const mergedContext = context
      ? deepMerge(initialContext, context)
      : initialContext;

    const errors = errorsMap ? createErrorHelpers(errorsMap as any) : undefined;
    const options = {
      errors: errors,
      context: mergedContext,
    } as Prettify<
      ResolveHandlerOptions<Prettify<TNewContext & TContext>, TErrorsMap>
    >;

    const procedure = createProcedure<TKindNames>({
      inputSchema,
      outputSchema,
      errorsMap,
      options,
      handlerFn,
      disableOptions: disableOptions ?? false,
      cacheAdapter,
    });

    type TResolvedResult = Awaited<ReturnType<typeof procedure>>;
    type Result = ZagoraResult<
      InferOutput<TOutputSchema, THandlerFn>,
      TErrorsMap,
      TResolvedResult
    >;

    type TResult = ConditionalAsync<ReturnType<THandlerFn>, Result>;

    type TFinalResult = TCacheAdapter extends {
      has(key: string): infer A;
      get(key: string): infer B;
      set(key: string, value: unknown): infer C;
    }
      ? IsPromise<A> extends true
        ? Promise<Result>
        : IsPromise<B> extends true
          ? Promise<Result>
          : IsPromise<C> extends true
            ? Promise<Result>
            : TResult
      : TResult;

    return procedure as TInputSchema extends AnySchema
      ? InferSchemaInput<TInputSchema> extends readonly any[]
        ? SpreadTuple<InferSchemaInput<TInputSchema>, TFinalResult>
        : (arg: InferSchemaInput<TInputSchema>) => TFinalResult
      : () => TFinalResult;
  }

  callable<
    TNewContext extends TContext,
    TKindNames extends ResolveErrorKindNames<TErrorsMap>,
  >(context?: TNewContext) {
    return this._createProcedure<TNewContext, TKindNames>(context);
  }
}
