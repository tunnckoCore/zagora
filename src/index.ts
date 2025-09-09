// SPDX-License-Identifier: Apache-2.0

import type { StandardSchemaV1 } from "@standard-schema/spec";

/* ZagoraError class that wraps unexpected errors */
export class ZagoraError extends Error {
	readonly type = "ZAGORA_ERROR" as const;
	readonly issues?: readonly StandardSchemaV1.Issue[];
	override readonly cause?: unknown;
	readonly reason: string;

	constructor(
		message: string,
		options?: {
			issues?: readonly StandardSchemaV1.Issue[];
			cause?: unknown;
			reason?: string;
		},
	) {
		super(message);
		this.name = "ZagoraError";
		this.issues = options?.issues;
		this.cause = options?.cause;
		this.reason = options?.reason || "Unknown or internal error";
	}

	static fromIssues(issues: readonly StandardSchemaV1.Issue[]) {
		const message = issues.map((issue) => issue.message).join(", ");
		return new ZagoraError(message, {
			issues,
			reason: "Failure caused by validation",
		});
	}

	static fromCaughtError(caught: unknown, reason?: string) {
		const message = caught instanceof Error ? caught.message : String(caught);
		return new ZagoraError(reason || message, { cause: caught, reason });
	}
}

function createDualResult<TData, TErr, TIsDefined extends boolean>(
	data: TData,
	error: TErr,
	isDefined: TIsDefined,
): DualResult<TData, TErr, TIsDefined> {
	const tuple = [data, error, isDefined] as [TData, TErr, TIsDefined];
	const result = tuple as DualResult<TData, TErr, TIsDefined>;
	result.data = data;
	result.error = error;
	result.isDefined = isDefined;
	return result;
}

/* Dual return format that supports both object and tuple destructuring */
type DualResult<TData, TErr, TIsDefined extends boolean> = [
	TData,
	TErr,
	TIsDefined,
] & {
	data: TData;
	error: TErr;
	isDefined: TIsDefined;
};

// convert union -> intersection helper
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
	k: infer I,
) => void
	? I
	: never;

/* Given `T` a tuple type, produce an intersection of function
  types that act as overloads for each prefix of T. */
type IsOptional<T> = undefined extends T ? true : false;
type AllOptional<T extends any[]> = T extends [infer H, ...infer R]
	? IsOptional<H> extends true
		? AllOptional<R>
		: false
	: true;

type OverloadedByPrefixes<T extends any[], R> = UnionToIntersection<
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

type ValidateOutput = [unknown, null] | [null, ZagoraError];
type MaybeAsyncValidateOutput<TIsSync extends boolean> = TIsSync extends true
	? ValidateOutput
	: Promise<ValidateOutput>;

type ValidateError = { error: unknown; isTyped: boolean };
type MaybeAsyncValidateError<TIsSync extends boolean> = TIsSync extends true
	? ValidateError
	: Promise<ValidateError>;

/* prefixes of a value-tuple (mutable) */
type ValuePrefixes<T extends any[]> = T extends [infer H, ...infer R]
	? [] | [H, ...ValuePrefixes<R>]
	: [];

/* Helper types for StandardSchema */
type InferInput<T extends StandardSchemaV1> = StandardSchemaV1.InferInput<T>;
type InferOutput<T extends StandardSchemaV1> = StandardSchemaV1.InferOutput<T>;

/* Error helper type - creates functions that return [null, error] tuples */
type ErrorHelpers<T extends Record<string, StandardSchemaV1>> = {
	[K in keyof T]: (
		error: Omit<InferInput<T[K]>, "type">,
	) => [null, InferOutput<T[K]>];
};

type BaseResult<
	Output extends StandardSchemaV1 | null = null,
	ErrSchema extends Record<string, StandardSchemaV1> | null = null,
> = ErrSchema extends Record<string, StandardSchemaV1>
	?
			| DualResult<
					Output extends StandardSchemaV1 ? InferOutput<Output> : unknown,
					null,
					false
			  > // success
			| DualResult<
					null,
					{
						[K in keyof ErrSchema]: InferOutput<ErrSchema[K]>;
					}[keyof ErrSchema],
					true
			  > // typed error
			| DualResult<null, ZagoraError, false> // untyped error
	:
			| DualResult<
					Output extends StandardSchemaV1 ? InferOutput<Output> : unknown,
					null,
					false
			  > // success
			| DualResult<null, ZagoraError, false>; // untyped error

export type ZagoraConfig = {
	errorsFirst?: boolean;
};

export function zagora(): Zagora<
	null,
	null,
	null,
	undefined
>;
export function zagora<C extends ZagoraConfig>(
	config: C,
): Zagora<null, null, null, C>;
export function zagora<C extends ZagoraConfig>(
	config?: C,
): Zagora<null, null, null, C | undefined> {
	return new Zagora(config);
}


export class Zagora<
	InputSchema extends StandardSchemaV1 | null = null,
	Output extends StandardSchemaV1 | null = null,
	ErrSchema extends Record<string, StandardSchemaV1> | null = null,
	Config extends ZagoraConfig | undefined = undefined,
> {
	private _input: InputSchema | null = null;
	private _output: Output | null = null;
	private _error: ErrSchema | null = null;
	private _config: Config;

	constructor(config?: Config) {
		this._error = null;
		this._config = (config || undefined) as Config;
	}

	// Accept a single schema - object, tuple, primitive, etc.
	input<T extends StandardSchemaV1>(
		schema: T,
	): Zagora<T, Output, ErrSchema, Config> {
		const next = new Zagora<T, Output, ErrSchema, Config>(
			this._config,
		);
		(next as any)._input = schema;
		(next as any)._output = this._output;
		(next as any)._error = this._error;
		return next;
	}

	output<NewOut extends StandardSchemaV1>(schema: NewOut) {
		const next = new Zagora<
			InputSchema,
			NewOut,
			ErrSchema,
			Config
		>(this._config);
		(next as any)._input = this._input;
		(next as any)._output = schema;
		(next as any)._error = this._error;
		return next;
	}

	errors<NewErr extends Record<string, StandardSchemaV1>>(
		schema: NewErr,
	): Zagora<InputSchema, Output, NewErr, Config> {
		const next = new Zagora<InputSchema, Output, NewErr, Config>(
			this._config,
		);
		(next as any)._input = this._input;
		(next as any)._output = this._output;
		(next as any)._error = schema;
		return next as any;
	}

	handler<
		IS extends StandardSchemaV1 = InputSchema extends StandardSchemaV1
			? InputSchema
			: never,
		OutputArgs = InferInput<IS>,
	>(
		impl: ErrSchema extends Record<string, StandardSchemaV1>
			? Config extends { errorsFirst: true }
				? OutputArgs extends readonly any[]
					? (...args: [ErrorHelpers<ErrSchema>, ...OutputArgs]) => any
					: (errors: ErrorHelpers<ErrSchema>, arg: OutputArgs) => any
				: OutputArgs extends readonly any[]
					? (...args: [...OutputArgs, ErrorHelpers<ErrSchema>]) => any
					: (arg: OutputArgs, errors: ErrorHelpers<ErrSchema>) => any
			: OutputArgs extends readonly any[]
				? (...args: OutputArgs) => any
				: (arg: OutputArgs) => any,
	) {
		return this.createHandlerAsync(impl);
	}

	handlerSync<
		IS extends StandardSchemaV1 = InputSchema extends StandardSchemaV1
			? InputSchema
			: never,
		OutputArgs = InferInput<IS>,
	>(
		impl: ErrSchema extends Record<string, StandardSchemaV1>
			? Config extends { errorsFirst: true }
				? OutputArgs extends readonly any[]
					? (...args: [ErrorHelpers<ErrSchema>, ...OutputArgs]) => any
					: (errors: ErrorHelpers<ErrSchema>, arg: OutputArgs) => any
				: OutputArgs extends readonly any[]
					? (...args: [...OutputArgs, ErrorHelpers<ErrSchema>]) => any
					: (arg: OutputArgs, errors: ErrorHelpers<ErrSchema>) => any
			: OutputArgs extends readonly any[]
				? (...args: OutputArgs) => any
				: (arg: OutputArgs) => any,
	) {
		return this.createHandlerSync(impl);
	}

	private createHandlerSync<
		IS extends StandardSchemaV1 = InputSchema extends StandardSchemaV1
			? InputSchema
			: never,
	>(impl: any) {
		if (!this._input) {
			throw new Error(".input(...) must be called first");
		}
		if (!this._output) {
			throw new Error(".output(...) must be called first");
		}

		const inputSchema = this._input as StandardSchemaV1;
		const outputSchema = this._output as StandardSchemaV1;
		const errSchema = this._error;

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
							"Using `.handlerSync` only accepts synchronous functions",
						),
						false,
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
								true,
							);
							if (isTyped) {
								return createDualResult(null, validatedError, true);
							}
							return createDualResult(
								null,
								validatedError as ZagoraError,
								true,
							);
						}
						// No error schemas defined, return error as ZagoraError if it's not already one
						const zagoraError =
							maybeErr instanceof ZagoraError
								? maybeErr
								: ZagoraError.fromCaughtError(
										maybeErr,
										"Untyped error returned",
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
					true,
				);
				if (error === null) {
					return createDualResult(data, null, false);
				}
				return createDualResult(null, error, false);
			} catch (err: unknown) {
				// Handler threw an error - wrap in ZagoraError
				const zagoraError = ZagoraError.fromCaughtError(
					err,
					"Handler threw unknown error",
				);
				return createDualResult(null, zagoraError, false);
			}
		};

		type HandlerResult = BaseResult<Output, ErrSchema>;

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
		if (!this._input) {
			throw new Error(".input(...) must be called first");
		}
		if (!this._output) {
			throw new Error(".output(...) must be called first");
		}

		const inputSchema = this._input as StandardSchemaV1;
		const outputSchema = this._output as StandardSchemaV1;
		const errSchema = this._error;

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
						false,
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
								false,
							);
						}
						// No error schemas defined, return error as ZagoraError if it's not already one
						const zagoraError =
							maybeErr instanceof ZagoraError
								? maybeErr
								: ZagoraError.fromCaughtError(
										maybeErr,
										"Untyped error returned",
									);
						return createDualResult(null, zagoraError, false);
					}

					// Validate successful output
					const [res, err] = await this.validateOutput(
						outputSchema,
						maybeOut,
						false,
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
					false,
				);
				if (error === null) {
					return createDualResult(data, null, false);
				}
				return createDualResult(null, error, false);
			} catch (err: unknown) {
				// Handler threw an error - wrap in ZagoraError
				const zagoraError = ZagoraError.fromCaughtError(
					err,
					"Handler threw unknown error",
				);
				return createDualResult(null, zagoraError, false);
			}
		};

		type HandlerResult = Promise<BaseResult<Output, ErrSchema>>;

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
		rawArgs: unknown[],
	): { args: unknown[]; error?: ZagoraError } {
		// Try tuple validation first (if multiple args)
		if (rawArgs.length > 1) {
			const result = inputSchema["~standard"].validate(rawArgs);
			if (result instanceof Promise) {
				throw new ZagoraError(
					"Cannot use async input schema validation in handlerSync",
				);
			}
			if (!result.issues) {
				return { args: (result as any).value as unknown[] };
			}
		}

		// Try single argument validation
		const singleValue = rawArgs[0];
		const result = inputSchema["~standard"].validate(singleValue);
		if (result instanceof Promise) {
			throw new ZagoraError(
				"Cannot use async input schema validation in handlerSync",
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
		rawArgs: unknown[],
	): Promise<{ args: unknown[]; error?: ZagoraError }> {
		// Try tuple validation first (if multiple args)
		if (rawArgs.length > 1) {
			let result = inputSchema["~standard"].validate(rawArgs);
			if (result instanceof Promise) {
				result = await result;
			}
			if (!result.issues) {
				return { args: (result as any).value as unknown[] };
			}
		}

		// Try single argument validation
		const singleValue = rawArgs[0];
		let result = inputSchema["~standard"].validate(singleValue);
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

	// Define the validation result type once

	private validateOutput<TIsSync extends boolean>(
		outputSchema: StandardSchemaV1,
		output: unknown,
		isSync: TIsSync,
	): MaybeAsyncValidateOutput<TIsSync> {
		const result = outputSchema["~standard"].validate(output);
		if (result instanceof Promise) {
			if (isSync) {
				throw new ZagoraError(
					"Cannot use async output schema validation in handlerSync",
				);
			}

			return result.then((res) => {
				if (res.issues) {
					return [null, ZagoraError.fromIssues(res.issues)] as const;
				}
				return [(res as { value: any }).value, null]
			}) as MaybeAsyncValidateOutput<TIsSync>;
		}
		if (result.issues) {
			return [
				null,
				ZagoraError.fromIssues(result.issues),
			] as MaybeAsyncValidateOutput<TIsSync>;
		}
		return [(result as { value: any }).value, null] as MaybeAsyncValidateOutput<TIsSync>;
	}

	private validateError<TIsSync extends boolean>(
		errSchema: Record<string, StandardSchemaV1>,
		maybeErr: unknown,
		isSync: TIsSync,
	): MaybeAsyncValidateError<TIsSync> {
		// Try to validate against each error schema
		for (const [_key, errorSchema] of Object.entries(errSchema)) {
			const result = errorSchema["~standard"].validate(maybeErr);
			if (result instanceof Promise) {
				if (isSync) {
					throw new ZagoraError(
						"Cannot use async error schema validation in handlerSync",
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
						"Synchronous error helpers don't support async schemas",
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
							"Synchronous error helpers don't support async schemas",
						);
					}

					if (!result.issues) {
						return [null, (result as any).value] as const;
					}
				}

				// If all attempts failed, throw error
				throw new ZagoraError(
					`Invalid error data for "errors.${key}": ${result.issues.map((i: any) => i.message).join(", ")}`,
				);
			};
		}
		return helpers;
	}
}
