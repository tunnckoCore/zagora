import {
  createErrorHelpers,
  createInternalError,
  type ResolveErrorKindNames,
} from "./errors";
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
  ZagoraEnvVars,
  ZagoraResult,
} from "./types";

import {
  createResult,
  deepMerge,
  handleTupleDefaults,
  processHandler,
  validateError,
  validateInputOutputOrEnv,
} from "./utils";

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
  TEnvVarsMap extends AnySchema | undefined = undefined,
  TCacheAdapter extends CacheAdapter | undefined = undefined,
  TDisableOptions extends boolean = false,
  TAutoCallable extends boolean = false,
> {
  "~zagora": Partial<
    ZagoraDef<
      TContext,
      TInputSchema,
      TOutputSchema,
      TErrorsMap,
      TEnvVarsMap,
      TCacheAdapter
    >
  >;

  constructor(
    def: Partial<
      ZagoraDef<
        TContext,
        TInputSchema,
        TOutputSchema,
        TErrorsMap,
        TEnvVarsMap,
        TCacheAdapter
      >
    > = {},
  ) {
    this["~zagora"] = def;

    // Ensure config flags are set from constructor if provided
    if ("disableOptions" in def && def.disableOptions !== undefined) {
      this["~zagora"].disableOptions = def.disableOptions;
    }
    if ("autoCallable" in def && def.autoCallable !== undefined) {
      this["~zagora"].autoCallable = def.autoCallable;
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
    TEnvVarsMap,
    TCacheAdapter,
    TDisableOptions,
    TAutoCallable
  > {
    return new Zagora({
      ...this["~zagora"],
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
    TEnvVarsMap,
    TCacheAdapter,
    TDisableOptions,
    TAutoCallable
  > {
    return new Zagora({
      ...this["~zagora"],
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
    TEnvVarsMap,
    TCacheAdapter,
    TDisableOptions,
    TAutoCallable
  > {
    return new Zagora({
      ...this["~zagora"],
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
    TEnvVarsMap,
    TCacheAdapter,
    TDisableOptions,
    TAutoCallable
  > {
    return new Zagora({
      ...this["~zagora"],
      errorsMap,
    });
  }

  env<TNewEnvVarsMapSchema extends AnySchema, TEnvVars extends ZagoraEnvVars>(
    envVarsMapSchema: TNewEnvVarsMapSchema,
    envVars?: TEnvVars & UppercaseKeys<TEnvVars>,
  ): Zagora<
    THandlerFn,
    TContext,
    TInputSchema,
    TOutputSchema,
    TErrorsMap,
    TNewEnvVarsMapSchema,
    TCacheAdapter,
    TDisableOptions,
    TAutoCallable
  > {
    return new Zagora({
      ...this["~zagora"],
      envVarsMapSchema,
      envVars,
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
    TEnvVarsMap,
    TNewCacheAdapter,
    TDisableOptions,
    TAutoCallable
  > {
    return new Zagora({
      ...this["~zagora"],
      cacheAdapter,
    });
  }

  handler<
    TFn extends ResolveProcedure<
      TDisableOptions,
      TContext,
      TInputSchema,
      TErrorsMap,
      TEnvVarsMap
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
          TEnvVarsMap,
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
        TEnvVarsMap,
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
      TEnvVarsMap,
      TCacheAdapter,
      TDisableOptions,
      TAutoCallable
    >({
      ...this["~zagora"],
      handler: fn as any,
    });

    // If autoCallable is true, create the procedure immediately
    if (this["~zagora"].autoCallable) {
      return newInstance._createProcedure(
        this["~zagora"].initialContext,
        this["~zagora"].envVars,
      ) as any;
    }

    return newInstance as any;
  }

  private _createProcedure<
    TCache,
    TEnv,
    TNewContext extends TContext = TContext,
    TKindNames extends
      ResolveErrorKindNames<TErrorsMap> = ResolveErrorKindNames<TErrorsMap>,
  >(context?: TNewContext, env?: TEnv) {
    const zagora = this["~zagora"];
    const disableOptions = zagora.disableOptions ?? false;
    const handlerFn = zagora.handler;
    const errorsMap = zagora.errorsMap;
    const inputSchema = zagora.inputSchema as TInputSchema;
    const outputSchema = zagora.outputSchema as TOutputSchema;
    const cacheAdapter = zagora.cacheAdapter;
    const envVarsMapSchema = zagora.envVarsMapSchema;
    const baseEnvVars = zagora.envVars;

    const mergedEnvVars = baseEnvVars ? deepMerge(baseEnvVars, env) : env;

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: -- ok
    const forwardProcedure = (...args: unknown[]) => {
      const envVars = envVarsMapSchema
        ? validateInputOutputOrEnv("env", envVarsMapSchema, mergedEnvVars)
        : ({ ok: true, data: mergedEnvVars } as const);

      if (envVars instanceof Promise) {
        return createInternalError(
          "Environment Variables cannot have async schema validation",
        );
      }
      if (!envVars.ok) {
        return envVars;
      }

      const mergedContext = context
        ? deepMerge(zagora.initialContext, context)
        : zagora.initialContext;

      const errors = zagora.errorsMap
        ? createErrorHelpers(zagora.errorsMap as any)
        : undefined;
      const options = {
        errors: errors,
        context: mergedContext,
        env: envVars.data,
      } as Prettify<
        ResolveHandlerOptions<
          Prettify<TNewContext & TContext>,
          TErrorsMap,
          TEnvVarsMap
        >
      >;

      const schemaAny = inputSchema as any;
      const isTupleSchema =
        (schemaAny?._def && schemaAny?._def?.type === "tuple") ||
        schemaAny?.type === "tuple";

      const isArraySchema =
        (schemaAny?._def && schemaAny?._def?.type === "array") ||
        schemaAny?.type === "array";

      const isPrimitiveSchema = !isTupleSchema;

      const processor = (mode: "input" | "output", schema: any, data: any) => {
        if (schema) {
          return validateInputOutputOrEnv(mode, schema, data);
        }
        return createResult(data, null, false);
      };

      const processInput = (inputData: any) => {
        // NOTE: isTuple is safe/enough here cuz it's based on the inputSchema,
        // thus if inputSchema is not defined, then it would be isTuple=false too.
        const handlerArgs =
          !isArraySchema && !isPrimitiveSchema
            ? handleTupleDefaults(inputSchema as any, inputData as any)
            : [inputData];

        const executionArgs = disableOptions
          ? handlerArgs
          : [options, ...handlerArgs];

        const state = processHandler(handlerFn, executionArgs, cacheAdapter, {
          inputSchema,
          outputSchema,
          envVarsMapSchema,
          errorsMap,
        });

        const handleState = (st: any) => {
          if (st.ok) {
            return processor("output", outputSchema, st.data);
          }

          const { isAsync, handlerFailed, ...rest } = st;

          // if handler failed, then we need to validate the error if errorShema,
          // otherwise we can passthrough the Result object whatever it is.
          return handlerFailed
            ? validateError<TKindNames>(errorsMap as any, st.error, isAsync)
            : rest;
        };

        if (state instanceof Promise) {
          return state.then((st) => handleState(st));
        }

        return handleState(state);
      };

      const inputArgs = !isArraySchema && !isPrimitiveSchema ? args : args[0];

      const inputResult = inputSchema
        ? validateInputOutputOrEnv("input", inputSchema, inputArgs)
        : ({ ok: true, data: inputArgs } as const);

      if (inputResult instanceof Promise) {
        return inputResult.then((resultObj) =>
          resultObj.error ? resultObj : processInput(resultObj.data),
        );
      }

      return inputResult.error ? inputResult : processInput(inputResult.data);
    };

    type TResolvedResult = Awaited<ReturnType<typeof forwardProcedure>>;
    type Result = ZagoraResult<
      InferOutput<TOutputSchema, THandlerFn>,
      TErrorsMap,
      TResolvedResult
    >;

    type TResult = ConditionalAsync<ReturnType<THandlerFn>, Result>;

    type TFinalResult = TCache extends {
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

    return forwardProcedure as TInputSchema extends AnySchema
      ? InferSchemaInput<TInputSchema> extends readonly [any, ...any[]]
        ? SpreadTuple<InferSchemaInput<TInputSchema>, TFinalResult>
        : (arg: InferSchemaInput<TInputSchema>) => TFinalResult
      : () => TFinalResult;
  }

  callable<
    TNewContext extends TContext,
    TIncomingEnv extends ZagoraEnvVars,
    TKindNames extends ResolveErrorKindNames<TErrorsMap>,
    TCacheDefinitely extends CacheAdapter,
    TNewCacheAdapter extends TCacheDefinitely | undefined = undefined,
  >(
    options: {
      context?: TNewContext;
      cache?: TCacheDefinitely;
      env?: TIncomingEnv;
    } = {},
  ) {
    let za = this;
    if (options.cache) {
      za = this.cache<TCacheDefinitely>(options.cache) as any;
    }

    return za._createProcedure<
      TNewCacheAdapter,
      TIncomingEnv,
      TNewContext,
      TKindNames
    >(options.context, options.env);
  }
}
