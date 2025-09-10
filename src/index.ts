// SPDX-License-Identifier: Apache-2.0

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  MaybeAsyncValidateError,
  MaybeAsyncValidateOutput,
  OverloadedByPrefixes,
  ZagoraBaseResult,
  ZagoraConfig,
  ZagoraErrorHelpers,
  ZagoraInferInput,
  ZagoraMetadata,
} from "./types.ts";
import { createDualResult, ZagoraError } from "./utils.ts";

export * from "./types.ts";
export * from "./utils.ts";

export function zagora(): Zagora<null, null, null, undefined>;
export function zagora<C extends ZagoraConfig>(
  config: C
): Zagora<null, null, null, C>;
export function zagora<C extends ZagoraConfig>(
  config?: C
): Zagora<null, null, null, C | undefined> {
  return new Zagora(config);
}

export class Zagora<
  InputSchema extends StandardSchemaV1 | null = null,
  Output extends StandardSchemaV1 | null = null,
  ErrSchema extends Record<string, StandardSchemaV1> | null = null,
  Config extends ZagoraConfig | undefined = undefined,
> {
  private _inputSchema: InputSchema | null = null;
  private _outputSchema: Output | null = null;
  private _errorSchema: ErrSchema | null = null;
  private _config: Config;

  "~zagora": ZagoraMetadata;

  constructor(config?: Config) {
    this._errorSchema = null;
    this._config = (config || undefined) as Config;
  }

  // Accept a single schema - object, tuple, primitive, etc.
  input<T extends StandardSchemaV1>(
    schema: T
  ): Zagora<T, Output, ErrSchema, Config> {
    const next = new Zagora<T, Output, ErrSchema, Config>(this._config);
    (next as any)._inputSchema = schema;
    (next as any)._outputSchema = this._outputSchema;
    (next as any)._errorSchema = this._errorSchema;

    this["~zagora"] = {
      inputSchema: schema,
      outputSchema: this._outputSchema,
      errorSchema: this._errorSchema,
      handlerFn: null,
    };

    return next;
  }

  output<NewOut extends StandardSchemaV1>(schema: NewOut) {
    const next = new Zagora<InputSchema, NewOut, ErrSchema, Config>(
      this._config
    );
    (next as any)._inputSchema = this._inputSchema;
    (next as any)._outputSchema = schema;
    (next as any)._errorSchema = this._errorSchema;

    this["~zagora"] = {
      inputSchema: this._inputSchema,
      outputSchema: schema,
      errorSchema: this._errorSchema,
      handlerFn: null,
    };

    return next;
  }

  errors<NewErr extends Record<string, StandardSchemaV1>>(
    schema: NewErr
  ): Zagora<InputSchema, Output, NewErr, Config> {
    const next = new Zagora<InputSchema, Output, NewErr, Config>(this._config);
    (next as any)._inputSchema = this._inputSchema;
    (next as any)._outputSchema = this._outputSchema;
    (next as any)._errorSchema = schema;

    this["~zagora"] = {
      inputSchema: this._inputSchema,
      outputSchema: this._outputSchema,
      errorSchema: schema,
      handlerFn: null,
    };

    return next;
  }

  handler<
    IS extends StandardSchemaV1 = InputSchema extends StandardSchemaV1
      ? InputSchema
      : never,
    OutputArgs = ZagoraInferInput<IS>,
  >(
    impl: ErrSchema extends Record<string, StandardSchemaV1>
      ? Config extends { errorsFirst: true }
        ? OutputArgs extends readonly any[]
          ? (...args: [ZagoraErrorHelpers<ErrSchema>, ...OutputArgs]) => any
          : (errors: ZagoraErrorHelpers<ErrSchema>, arg: OutputArgs) => any
        : OutputArgs extends readonly any[]
          ? (...args: [...OutputArgs, ZagoraErrorHelpers<ErrSchema>]) => any
          : (arg: OutputArgs, errors: ZagoraErrorHelpers<ErrSchema>) => any
      : OutputArgs extends readonly any[]
        ? (...args: OutputArgs) => any
        : (arg: OutputArgs) => any
  ) {
    const handlerFn = this.createHandlerAsync(impl);

    this["~zagora"] = {
      inputSchema: this._inputSchema,
      outputSchema: this._outputSchema,
      errorSchema: this._errorSchema,
      handlerFn,
    };

    return Object.assign(handlerFn, this) as typeof handlerFn &
      Zagora<IS, Output, ErrSchema, Config> & {
        "~zagora": ZagoraMetadata<typeof handlerFn>;
      };
  }

  handlerSync<
    IS extends StandardSchemaV1 = InputSchema extends StandardSchemaV1
      ? InputSchema
      : never,
    OutputArgs = ZagoraInferInput<IS>,
  >(
    impl: ErrSchema extends Record<string, StandardSchemaV1>
      ? Config extends { errorsFirst: true }
        ? OutputArgs extends readonly any[]
          ? (...args: [ZagoraErrorHelpers<ErrSchema>, ...OutputArgs]) => any
          : (errors: ZagoraErrorHelpers<ErrSchema>, arg: OutputArgs) => any
        : OutputArgs extends readonly any[]
          ? (...args: [...OutputArgs, ZagoraErrorHelpers<ErrSchema>]) => any
          : (arg: OutputArgs, errors: ZagoraErrorHelpers<ErrSchema>) => any
      : OutputArgs extends readonly any[]
        ? (...args: OutputArgs) => any
        : (arg: OutputArgs) => any
  ) {
    const handlerFn = this.createHandlerSync(impl);

    this["~zagora"] = {
      inputSchema: this._inputSchema,
      outputSchema: this._outputSchema,
      errorSchema: this._errorSchema,
      handlerFn,
    };

    return Object.assign(handlerFn, this) as typeof handlerFn &
      Zagora<IS, Output, ErrSchema, Config> & {
        "~zagora": ZagoraMetadata<typeof handlerFn>;
      };
  }

  private createHandlerSync<
    IS extends StandardSchemaV1 = InputSchema extends StandardSchemaV1
      ? InputSchema
      : never,
  >(impl: any) {
    if (!this._inputSchema) {
      throw new Error(".input(...) must be called first");
    }
    if (!this._outputSchema) {
      throw new Error(".output(...) must be called first");
    }

    const inputSchema = this._inputSchema as StandardSchemaV1;
    const outputSchema = this._outputSchema as StandardSchemaV1;
    const errSchema = this._errorSchema;

    // Create synchronous wrapper function
    const wrapper = (...rawArgs: unknown[]) => {
      // Validate input synchronously
      const inputResult = this.validateInputSync(inputSchema, rawArgs);
      if (inputResult.error) {
        return createDualResult(null, inputResult.error, false);
      }

      // Call implementation
      try {
        // Add error helpers if error schema is defined
        const finalArgs = errSchema
          ? (this._config as ZagoraConfig)?.errorsFirst
            ? [this.createErrorHelpers(errSchema), ...inputResult.args]
            : [...inputResult.args, this.createErrorHelpers(errSchema)]
          : inputResult.args;

        const rawResult = (impl as any)(...finalArgs);
        const isPromise = rawResult instanceof Promise;

        if (isPromise) {
          return createDualResult(
            null,
            new ZagoraError(
              "Using `.handlerSync` only accepts synchronous functions"
            ),
            false
          );
        }

        // Check if result is a [data, error] tuple
        if (Array.isArray(rawResult) && rawResult.length === 2) {
          const [maybeOut, maybeErr] = rawResult as [unknown, unknown];

          if (maybeErr != null) {
            // Validate error against schemas if defined
            if (errSchema) {
              const { error: validatedError, isTyped } = this.validateError(
                errSchema,
                maybeErr,
                true
              );
              if (isTyped) {
                return createDualResult(null, validatedError, true);
              }
              return createDualResult(
                null,
                validatedError as ZagoraError,
                true
              );
            }
            // No error schemas defined, return error as ZagoraError if it's not already one
            const zagoraError =
              maybeErr instanceof ZagoraError
                ? maybeErr
                : ZagoraError.fromCaughtError(
                    maybeErr,
                    "Untyped error returned"
                  );
            return createDualResult(null, zagoraError, false);
          }

          // Validate successful output
          const [res, err] = this.validateOutput(outputSchema, maybeOut, true);
          if (err === null) {
            return createDualResult(res, null, false);
          }
          return createDualResult(null, err, false);
        }

        // Direct result, validate as output
        const [data, error] = this.validateOutput(
          outputSchema,
          rawResult,
          true
        );
        if (error === null) {
          return createDualResult(data, null, false);
        }
        return createDualResult(null, error, false);
      } catch (err: unknown) {
        // Handler threw an error - wrap in ZagoraError
        const zagoraError = ZagoraError.fromCaughtError(
          err,
          "Handler threw unknown error"
        );
        return createDualResult(null, zagoraError, false);
      }
    };

    type HandlerResult = ZagoraBaseResult<Output, ErrSchema>;

    // Forward (call-site) signatures
    type InputArgs = StandardSchemaV1.InferInput<IS>;
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

    const forwardImpl = (...args: any[]) => wrapper(...(args as unknown[]));
    const forward = forwardImpl as unknown as ForwardType;

    return forward;
  }

  private createHandlerAsync<
    IS extends StandardSchemaV1 = InputSchema extends StandardSchemaV1
      ? InputSchema
      : never,
  >(impl: any) {
    if (!this._inputSchema) {
      throw new Error(".input(...) must be called first");
    }
    if (!this._outputSchema) {
      throw new Error(".output(...) must be called first");
    }

    const inputSchema = this._inputSchema as StandardSchemaV1;
    const outputSchema = this._outputSchema as StandardSchemaV1;
    const errSchema = this._errorSchema;

    // Create asynchronous wrapper function
    const wrapper = async (...rawArgs: unknown[]) => {
      // Validate input
      const inputResult = await this.validateInput(inputSchema, rawArgs);
      if (inputResult.error) {
        return createDualResult(null, inputResult.error, false);
      }

      // Call implementation
      try {
        // Add error helpers if error schema is defined
        const finalArgs = errSchema
          ? (this._config as ZagoraConfig)?.errorsFirst
            ? [this.createErrorHelpers(errSchema), ...inputResult.args]
            : [...inputResult.args, this.createErrorHelpers(errSchema)]
          : inputResult.args;

        let rawResult = (impl as any)(...finalArgs);
        const isNotPromise = !(rawResult instanceof Promise);

        if (isNotPromise) {
          return createDualResult(
            null,
            new ZagoraError("Using `.handler` only accepts async functions"),
            false
          );
        }

        rawResult = await rawResult;

        // Check if result is a [data, error] tuple
        if (Array.isArray(rawResult) && rawResult.length === 2) {
          const [maybeOut, maybeErr] = rawResult as [unknown, unknown];

          if (maybeErr != null) {
            // Validate error against schemas if defined
            if (errSchema) {
              const { error: validatedError, isTyped } =
                await this.validateError(errSchema, maybeErr, false);
              if (isTyped) {
                return createDualResult(null, validatedError, true);
              }
              return createDualResult(
                null,
                validatedError as ZagoraError,
                false
              );
            }
            // No error schemas defined, return error as ZagoraError if it's not already one
            const zagoraError =
              maybeErr instanceof ZagoraError
                ? maybeErr
                : ZagoraError.fromCaughtError(
                    maybeErr,
                    "Untyped error returned"
                  );
            return createDualResult(null, zagoraError, false);
          }

          // Validate successful output
          const [res, err] = await this.validateOutput(
            outputSchema,
            maybeOut,
            false
          );
          if (err === null) {
            return createDualResult(res, null, false);
          }
          return createDualResult(null, err, false);
        }

        // Direct result, validate as output
        const [data, error] = await this.validateOutput(
          outputSchema,
          rawResult,
          false
        );
        if (error === null) {
          return createDualResult(data, null, false);
        }
        return createDualResult(null, error, false);
      } catch (err: unknown) {
        // Handler threw an error - wrap in ZagoraError
        const zagoraError = ZagoraError.fromCaughtError(
          err,
          "Handler threw unknown error"
        );
        return createDualResult(null, zagoraError, false);
      }
    };

    type HandlerResult = Promise<ZagoraBaseResult<Output, ErrSchema>>;

    // Forward (call-site) signatures
    type InputArgs = StandardSchemaV1.InferInput<IS>;
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

    const forwardImpl = (...args: any[]) => wrapper(...(args as unknown[]));
    const forward = forwardImpl as unknown as ForwardType;

    return forward;
  }

  private validateInputSync(
    inputSchema: StandardSchemaV1,
    rawArgs: unknown[]
  ): { args: unknown[]; error?: ZagoraError } {
    // Handle tuple defaults if needed
    const processedArgs = this.handleTupleDefaults(inputSchema, rawArgs);

    // Try tuple validation first
    let result = inputSchema["~standard"].validate(processedArgs);
    if (result instanceof Promise) {
      throw new ZagoraError(
        "Cannot use async input schema validation in handlerSync"
      );
    }
    if (!result.issues) {
      return { args: (result as any).value as unknown[] };
    }

    // Try single argument validation if tuple validation failed
    const singleValue = processedArgs[0];
    result = inputSchema["~standard"].validate(singleValue);
    if (result instanceof Promise) {
      throw new ZagoraError(
        "Cannot use async input schema validation in handlerSync"
      );
    }

    if (result.issues) {
      return {
        args: [],
        error: ZagoraError.fromIssues(result.issues),
      };
    }

    const validatedValue = (result as any).value;
    const args = Array.isArray(validatedValue)
      ? validatedValue
      : [validatedValue];
    return { args };
  }

  private async validateInput(
    inputSchema: StandardSchemaV1,
    rawArgs: unknown[]
  ): Promise<{ args: unknown[]; error?: ZagoraError }> {
    // Handle tuple defaults if needed
    const processedArgs = this.handleTupleDefaults(inputSchema, rawArgs);

    // Try tuple validation first
    let result = inputSchema["~standard"].validate(processedArgs);
    if (result instanceof Promise) {
      result = await result;
    }
    if (!result.issues) {
      return { args: (result as any).value as unknown[] };
    }

    // Try single argument validation if tuple validation failed
    const singleValue = processedArgs[0];
    result = inputSchema["~standard"].validate(singleValue);
    if (result instanceof Promise) {
      result = await result;
    }

    if (result.issues) {
      return {
        args: [],
        error: ZagoraError.fromIssues(result.issues),
      };
    }

    const validatedValue = (result as any).value;
    const args = Array.isArray(validatedValue)
      ? validatedValue
      : [validatedValue];
    return { args };
  }

  private handleTupleDefaults(
    schema: StandardSchemaV1,
    rawArgs: unknown[]
  ): unknown[] {
    // Check if this might be a tuple schema by examining the schema structure
    const schemaAny = schema as any;

    // Try to detect if this is a Zod tuple schema
    if (schemaAny._def && schemaAny._def.type === "tuple") {
      const tupleItems = schemaAny._def.items;
      if (tupleItems && Array.isArray(tupleItems)) {
        const result = [...rawArgs];

        // Fill in defaults for missing elements
        for (let i = rawArgs.length; i < tupleItems.length; i++) {
          const itemSchema = tupleItems[i];
          if (itemSchema && itemSchema.type === "default" && itemSchema._def) {
            const defaultValue =
              typeof itemSchema._def.defaultValue === "function"
                ? itemSchema._def.defaultValue()
                : itemSchema._def.defaultValue;
            result[i] = defaultValue;
          }
        }

        return result;
      }
    }
    return rawArgs;
  }

  // Define the validation result type once

  private validateOutput<TIsSync extends boolean>(
    outputSchema: StandardSchemaV1,
    output: unknown,
    isSync: TIsSync
  ): MaybeAsyncValidateOutput<TIsSync> {
    const result = outputSchema["~standard"].validate(output);
    if (result instanceof Promise) {
      if (isSync) {
        throw new ZagoraError(
          "Cannot use async output schema validation in handlerSync"
        );
      }

      return result.then((res) => {
        if (res.issues) {
          return [null, ZagoraError.fromIssues(res.issues)] as const;
        }
        return [(res as { value: any }).value, null];
      }) as MaybeAsyncValidateOutput<TIsSync>;
    }
    if (result.issues) {
      return [
        null,
        ZagoraError.fromIssues(result.issues),
      ] as MaybeAsyncValidateOutput<TIsSync>;
    }
    return [
      (result as { value: any }).value,
      null,
    ] as MaybeAsyncValidateOutput<TIsSync>;
  }

  private validateError<TIsSync extends boolean>(
    errSchema: Record<string, StandardSchemaV1>,
    maybeErr: unknown,
    isSync: TIsSync
  ): MaybeAsyncValidateError<TIsSync> {
    // Try to validate against each error schema
    for (const [_key, errorSchema] of Object.entries(errSchema)) {
      const result = errorSchema["~standard"].validate(maybeErr);
      if (result instanceof Promise) {
        if (isSync) {
          throw new ZagoraError(
            "Cannot use async error schema validation in handlerSync"
          );
        }

        return result.then((res) => {
          if (!res.issues) {
            return { error: (res as any).value, isTyped: true };
          }
          return { error: maybeErr, isTyped: false };
        }) as MaybeAsyncValidateError<TIsSync>;
      }
      if (!result.issues) {
        return {
          error: (result as any).value,
          isTyped: true,
        } as MaybeAsyncValidateError<TIsSync>;
      }
    }
    // If no schema matched, return error as-is (will be marked as untyped)
    return {
      error: maybeErr,
      isTyped: false,
    } as MaybeAsyncValidateError<TIsSync>;
  }

  private createErrorHelpers(schema: Record<string, StandardSchemaV1>) {
    // Helper to convert snake_case to PascalCase
    const toPascalCase = (str: string) => {
      return str
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
    };

    const helpers: any = {};
    for (const [key, errorSchema] of Object.entries(schema)) {
      helpers[key] = (error: any) => {
        // Try different type values to auto-inject
        const typeVariants = [
          key, // e.g., "network" or "rate_limit"
          `${toPascalCase(key)}Error`, // e.g., "NetworkError" or "RateLimitError"
          `${key.toUpperCase()}_ERROR`, // e.g., "NETWORK_ERROR" or "RATE_LIMIT_ERROR"
        ];

        let result: any;
        let errorWithType: any;

        // First try without injecting type (user might have provided it)
        result = errorSchema["~standard"].validate(error);
        if (result instanceof Promise) {
          throw new ZagoraError(
            "Synchronous error helpers don't support async schemas"
          );
        }

        // If validation succeeded, use it
        if (!result.issues) {
          return [null, (result as any).value] as const;
        }

        // Try with auto-injected type variants
        for (const typeValue of typeVariants) {
          errorWithType = { ...error, type: typeValue };
          result = errorSchema["~standard"].validate(errorWithType);
          if (result instanceof Promise) {
            throw new ZagoraError(
              "Synchronous error helpers don't support async schemas"
            );
          }

          if (!result.issues) {
            return [null, (result as any).value] as const;
          }
        }

        // If all attempts failed, throw error
        throw new ZagoraError(
          `Invalid error data for "errors.${key}": ${result.issues.map((i: any) => i.message).join(", ")}`
        );
      };
    }
    return helpers;
  }
}
