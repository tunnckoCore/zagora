# NEXT_STEPS.md

## Revised Plan for Next Steps

Updated to specify deep cloning for context merging (not just spreading).

DONE
### 1. Add `.callable(context?: TContext)` Method 
DONE
- **Goal**: Separate procedure definition from execution; `.handler` defines the handler and returns the builder instance, while `.callable` returns the actual callable procedure with optional context.
- **Implementation**:
  - Add `.callable<TContext>(context?: TContext)` method to the builder.
  - It should finalize the builder and return a callable function (the "procedure") that accepts procedure args and executes the wrapped logic.
  - Ensure context is passed to the procedure for use in `options.context`.
  - This is the first step to establish the builder pattern clearly.

DONE
### 2. Context Support with `.context<TInitialContext>(initialContext?)`
DONE
- **Goal**: Allow defining an initial context type and value for `options.context` via a method, which can be merged with context passed to `.callable`.
- **Implementation**:
  - Add `.context<TInitialContext>(initialContext?: TInitialContext)` method to the builder, storing the type and initial value.
  - Update builder generics to include `TInitialContext`.
  - In `.callable`, accept an optional `context` param and deep clone merge it with the initial context (e.g., using a deep merge utility to avoid shallow spreading).
  - Pass the merged context to `options.context` in the procedure.
  - Ensure type inference propagates to `ProcedureOptions`.

DONE
### 3. Options Parameter in Handlers 
DONE
- **Goal**: Always pass `options: { errors: ErrorHelpers, context: Context }` as the first param to handlers, where `errors` are helpers that throw structured objects (not Errors).
- **Implementation**:
  - Define `ProcedureOptions<TContext, TErrors>` as `{ errors: Record<keyof TErrors, (data: any) => { type: keyof TErrors, ...data }>, context: TContext }`.
  - Use `createErrorHelpers` to generate `errors` object; each helper validates against the schema and throws `{ type: key, ...validatedData }`.
  - Ensure `type` is inferred from the key and required in schemas (e.g., `type: z.literal('NOT_FOUND')`).
  - Pass `options` as the first arg to `fn(options, ...finalArgs)`.

DONE
### 4. Support for Output Schema with `.output`
DONE
- **Goal**: Add `.output<T extends AnySchema>(schema: T)` to validate/transform handler return values.
- **Implementation**:
  - Add `.output<T>(schema: T)` method, storing `TOutputSchema`.
  - In `wrapped`, after handler call, validate the result against `TOutputSchema` using `schema['~standard'].validate`.
  - If async, handle with `.then()`; on failure, treat as error (via `createResult`).
  - Update generics: `Procedure` should reflect output types.

DONE
### 5. Handle Async Validation (schema.validate can return Promise)
DONE
- **Goal**: Support both sync and async validation at the type level, with runtime handling via `instanceof Promise` checks and `.then()` chains (no `async/await`).
- **Implementation**:
  - Introduce `type IsPromise<T> = T extends Promise<any> ? true : false;`.
  - In the `wrapped` function, after `schema['~standard'].validate(input)`, check `if (result instanceof Promise)`.
  - Use `.then()` to resolve the promise, then proceed with parsing (`parsed = result.value`).
  - If validation is async, the overall return becomes a Promise. Update return types to `ReturnType<TFn> | Promise<ReturnType<TFn>>`.
  - Handle errors in `.then()` chains by rejecting or wrapping in results.

DONE
### 6. Add createResult Utility for Never-Throwing Functions
DONE
- **Goal**: Implement `createResult` to return `{ data, error, isTypedError }` and `[data, error, isTypedError]` patterns, ensuring handlers never throw by catching all errors.
- **Implementation**:
  - Use the provided `createResult(data: any, error: any, isTypedError: boolean)` function, which returns an array with object properties.
  - Set `isTypedError = true` for typed errors (schema-validated objects), `false` for other errors (e.g., validation failures).
  - Integrate into the builder: wrap handler calls in try-catch, passing results to `createResult`.
  - Support both sync and async contexts; if handler returns a Promise, resolve it before creating the result.
  - Ensure type safety: generics should reflect the result structure.

DONE
### 7. Support Sync and Async Handlers
DONE
- **Goal**: Allow handlers to be sync or async, detected via generics, and handle with `instanceof Promise` and `.then()` chains (no `async/await`).
- **Implementation**:
  - Update the `handler` method signature with generics for async detection (reference example: use something like `TIsAsync extends boolean = IsPromise<TReturn>` to infer async behavior).
  - In `wrapped`, after parsing, call `fn(options, ...finalArgs)`.
  - Check `if (fnResult instanceof Promise)`; if true, use `.then()` to handle resolution, then apply `createResult`.
  - Ensure the final return is a Promise if `TIsAsync` is true.
  - Update types: `Procedure` should have a generic for async, affecting return types.

DONE
### 8. Careful Argument Handling (Procedure Args vs. Handler Args)
DONE
- **Goal**: Clearly distinguish "procedure args" (inputs to the final callable) from "handler args" (passed to `.handler`), ensuring handler args are based on schema output after defaults, with proper sync/async generic handling.
- **Implementation**:
  - **Procedure Args**: The inputs to the callable (e.g., `proc("Alice")`); validated against `TInputSchema`.
  - **Handler Args**: Always start with `options` (see below), followed by schema output after defaults (e.g., `[string, number]` becomes `(options, name: string, age: number)`).
  - In `wrapped`, compute `finalArgs` from parsed output using `handleTupleDefaults`.
  - Generics: Define `THandlerArgs` as the spread of output types; ensure `TIsAsync` propagates to avoid type mismatches.
  - Handle edge cases: empty args, single args, tuple defaults.

DONE
### 9. Error Map Support with `.errors(errorMap)`
DONE
- **Goal**: Support `.errors<T extends Record<string, AnySchema>>(errorMap: T)` to define typed error schemas.
- **Implementation**:
  - Add `.errors<T>(map: T)` method, storing the map.
  - Use `createErrorHelpers(map, isAsync)` to generate helpers; enforce schemas include `type: z.literal(key)`.
  - Update builder generics for `TErrors = T`.
  - Integrate with `options.errors`; ensure helpers throw validated objects.

TODO - BETTER ERROR NARROWING - when `.errors()` is called, switch to have internal typed UNKNOWN_ERROR
TODO - BETTER ERROR NARROWING - when `.errors()` is called, switch to have internal typed UNKNOWN_ERROR
TODO - BETTER ERROR NARROWING - when `.errors()` is called, 
        switch to have internal typed UNKNOWN_ERROR instead of ZagoraError

### 10. Update createResult for isTypedError
- **Goal**: Enhance `createResult` to include `isTypedError` for guarding typed errors, with potential for `isValidationError` later.
- **Implementation**:
  - Modify `createResult` to set `isTypedError = true` if `error` is a typed error object (e.g., has `type` matching error map keys), else `false`.
  - Support `[data, error, isTypedError]` and `{ data, error, isTypedError }`.
  - Later, add `isValidationError` as a fourth element to distinguish schema validation failures from typed errors.
  - Ensure `isTypedError` guards `result.error.type === 'specific'` for typed errors.

## Overall Integration
- **Ordering Rationale**: Start with `.callable` (1) for structure; context/options (2-3) for handler setup; output (4) for returns; async/results (5-6) for safety; handlers/args/errors (7-9) for core logic; final result update (10).
- **Type Safety**: All generics must propagate correctly; use `IsPromise` in key spots (e.g., handler and validation types).
- **Dependencies**: Confirm Zod/Valibot async/output support.

This plan incorporates deep cloning for context merging. Once editing is enabled, document in `NEXT_STEPS.md`.
