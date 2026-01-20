/**
 * Type-level tests using expect-type for types marked with // TEST: with expect-type
 *
 * This file is type-checked as part of `bun run typecheck` but doesn't execute runtime tests.
 * It validates the compile-time behavior of TypeScript utility types and type signatures.
 *
 * ## What we're testing:
 *
 * 1. **IsAny<T>** - Detects the literal `any` type using the `0 extends 1 & T` trick
 * 2. **IsPromise<V>** - Detects Promise and PromiseLike types, treats bare `any` as non-promise
 * 3. **ConditionalAsync<T, Result>** - Wraps result in Promise only when T is a Promise
 * 4. **UppercaseKeys<T>** - Transforms object keys to uppercase
 * 5. **IsOptional<T>** - Detects if a type includes `undefined`
 * 6. **ZagoraResult<...>** - Result type structure for success/error cases
 * 7. **ResolveHandlerOptions<...>** - Handler options signature with context and errors
 * 8. **ResolveProcedure<...>** - Handler function signature based on disableOptions flag
 * 9. **SpreadTuple<T, R>** - Spreads tuple types into function parameters with optional handling
 * 10. **Function parameters** - createResult, validateInputOutputOrEnv, validateError signatures
 *
 * ## Edge cases covered:
 *
 * - `never` type extends everything (including Promise), so IsPromise<never> = true
 * - Union types with Promise (e.g., `string | Promise<number>`) are treated as promise-like
 * - Bare `any` is explicitly treated as non-promise, but `Promise<any>` is a promise
 * - Optional tuple parameters and their overload signatures
 *
 * Run with: `bun run typecheck`
 */

import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import type {
  createInternalError,
  ErrorHelpers,
  InferSchemaMapPlain,
  InternalError,
  ValidationError,
} from "../src/errors";
import { zagora } from "../src/index";
import type {
  AnySchema,
  ConditionalAsync,
  InferSchemaOutputSafe,
  IsAny,
  IsOptional,
  IsPromise,
  ResolveHandlerOptions,
  ResolveProcedure,
  SpreadTuple,
  UppercaseKeys,
  ZagoraDef,
  ZagoraResult,
} from "../src/types";
import {
  createResult,
  validateError,
  type validateInputOutputOrEnv,
} from "../src/utils";

// =============================================================================
// IsAny Type Tests
// =============================================================================

test("IsAny<T> - detects literal any type", () => {
  // Should detect literal `any` type
  expectTypeOf<IsAny<any>>().toEqualTypeOf<true>();

  // Should return false for non-any types
  expectTypeOf<IsAny<string>>().toEqualTypeOf<false>();
  expectTypeOf<IsAny<number>>().toEqualTypeOf<false>();
  expectTypeOf<IsAny<boolean>>().toEqualTypeOf<false>();
  expectTypeOf<IsAny<null>>().toEqualTypeOf<false>();
  expectTypeOf<IsAny<undefined>>().toEqualTypeOf<false>();
  expectTypeOf<IsAny<void>>().toEqualTypeOf<false>();
  expectTypeOf<IsAny<unknown>>().toEqualTypeOf<false>();
  expectTypeOf<IsAny<never>>().toEqualTypeOf<false>();
  expectTypeOf<IsAny<object>>().toEqualTypeOf<false>();
  expectTypeOf<IsAny<{}>>().toEqualTypeOf<false>();
  expectTypeOf<IsAny<{ foo: string }>>().toEqualTypeOf<false>();
  expectTypeOf<IsAny<string[]>>().toEqualTypeOf<false>();

  // Should return false for Promise<any> (it's wrapped, not bare any)
  expectTypeOf<IsAny<Promise<any>>>().toEqualTypeOf<false>();
});

// =============================================================================
// IsPromise Type Tests
// =============================================================================

test("IsPromise<V> - detects Promise and PromiseLike types", () => {
  // Should detect Promise types
  expectTypeOf<IsPromise<Promise<string>>>().toEqualTypeOf<true>();
  expectTypeOf<IsPromise<Promise<number>>>().toEqualTypeOf<true>();
  expectTypeOf<IsPromise<Promise<any>>>().toEqualTypeOf<true>();
  expectTypeOf<IsPromise<Promise<void>>>().toEqualTypeOf<true>();
  expectTypeOf<IsPromise<Promise<unknown>>>().toEqualTypeOf<true>();

  // Should detect PromiseLike types
  expectTypeOf<IsPromise<PromiseLike<string>>>().toEqualTypeOf<true>();
  expectTypeOf<IsPromise<PromiseLike<number>>>().toEqualTypeOf<true>();

  // Should treat bare `any` as non-promise
  expectTypeOf<IsPromise<any>>().toEqualTypeOf<false>();

  // Should return false for non-promise types
  expectTypeOf<IsPromise<string>>().toEqualTypeOf<false>();
  expectTypeOf<IsPromise<number>>().toEqualTypeOf<false>();
  expectTypeOf<IsPromise<boolean>>().toEqualTypeOf<false>();
  expectTypeOf<IsPromise<null>>().toEqualTypeOf<false>();
  expectTypeOf<IsPromise<undefined>>().toEqualTypeOf<false>();
  expectTypeOf<IsPromise<void>>().toEqualTypeOf<false>();
  expectTypeOf<IsPromise<unknown>>().toEqualTypeOf<false>();
  // `never` extends everything including Promise, so it's detected as a promise
  expectTypeOf<IsPromise<never>>().toEqualTypeOf<true>();
  expectTypeOf<IsPromise<object>>().toEqualTypeOf<false>();
  expectTypeOf<IsPromise<{}>>().toEqualTypeOf<false>();
  expectTypeOf<IsPromise<{ foo: string }>>().toEqualTypeOf<false>();
  expectTypeOf<IsPromise<string[]>>().toEqualTypeOf<false>();

  // Should handle union types - unions with Promise are detected as promise-like
  // because Awaited<string | Promise<number>> = string | number, which differs from the input
  expectTypeOf<IsPromise<string | Promise<number>>>().toEqualTypeOf<true>();
});

// =============================================================================
// ConditionalAsync Type Tests
// =============================================================================

test("ConditionalAsync<T, Result> - conditionally wraps result in Promise", () => {
  // Should wrap result in Promise when input is Promise
  expectTypeOf<
    ConditionalAsync<Promise<string>, { data: number }>
  >().toEqualTypeOf<Promise<{ data: number }>>();
  expectTypeOf<ConditionalAsync<Promise<any>, string>>().toEqualTypeOf<
    Promise<string>
  >();
  expectTypeOf<ConditionalAsync<PromiseLike<void>, boolean>>().toEqualTypeOf<
    Promise<boolean>
  >();

  // Should NOT wrap result when input is non-promise
  expectTypeOf<ConditionalAsync<string, { data: number }>>().toEqualTypeOf<{
    data: number;
  }>();
  expectTypeOf<ConditionalAsync<number, string>>().toEqualTypeOf<string>();
  expectTypeOf<ConditionalAsync<boolean, object>>().toEqualTypeOf<object>();

  // Should treat bare `any` as synchronous (NOT wrap in Promise)
  expectTypeOf<ConditionalAsync<any, string>>().toEqualTypeOf<string>();
  expectTypeOf<ConditionalAsync<any, { data: number }>>().toEqualTypeOf<{
    data: number;
  }>();

  // Should wrap when explicitly Promise<any>
  expectTypeOf<ConditionalAsync<Promise<any>, string>>().toEqualTypeOf<
    Promise<string>
  >();
});

// =============================================================================
// UppercaseKeys Type Tests
// =============================================================================

test("UppercaseKeys<T> - transforms object keys to uppercase", () => {
  // Should uppercase all keys
  expectTypeOf<UppercaseKeys<{ foo: string; bar: number }>>().toEqualTypeOf<{
    FOO: string;
    BAR: number;
  }>();

  expectTypeOf<
    UppercaseKeys<{ name: string; age: number; active: boolean }>
  >().toEqualTypeOf<{
    NAME: string;
    AGE: number;
    ACTIVE: boolean;
  }>();

  // Should handle empty objects
  expectTypeOf<UppercaseKeys<{}>>().toEqualTypeOf<{}>();

  // Should handle single property
  expectTypeOf<UppercaseKeys<{ hello: string }>>().toEqualTypeOf<{
    HELLO: string;
  }>();
});

// =============================================================================
// IsOptional Type Tests
// =============================================================================

test("IsOptional<T> - detects if type includes undefined", () => {
  // Should detect optional types (with undefined)
  expectTypeOf<IsOptional<string | undefined>>().toEqualTypeOf<true>();
  expectTypeOf<IsOptional<number | undefined>>().toEqualTypeOf<true>();
  expectTypeOf<IsOptional<undefined>>().toEqualTypeOf<true>();

  // Should return false for required types
  expectTypeOf<IsOptional<string>>().toEqualTypeOf<false>();
  expectTypeOf<IsOptional<number>>().toEqualTypeOf<false>();
  expectTypeOf<IsOptional<boolean>>().toEqualTypeOf<false>();
  expectTypeOf<IsOptional<object>>().toEqualTypeOf<false>();
  expectTypeOf<IsOptional<null>>().toEqualTypeOf<false>();

  // Should handle unions correctly
  expectTypeOf<IsOptional<string | null>>().toEqualTypeOf<false>();
  expectTypeOf<IsOptional<string | number | undefined>>().toEqualTypeOf<true>();
});

// =============================================================================
// ZagoraResult Type Tests
// =============================================================================

test("ZagoraResult<...> - result type structure for success/error cases", () => {
  type TestErrorsMap = {
    NOT_VALID: AnySchema;
    NOT_FOUND: AnySchema;
  };

  // Success result shape
  expectTypeOf<
    ZagoraResult<string, undefined, { readonly ok: true }>
  >().toEqualTypeOf<{
    readonly ok: true;
    data: string;
    readonly error: undefined;
  }>();

  // Error result without error map
  expectTypeOf<
    ZagoraResult<string, undefined, { readonly ok: false }>
  >().toEqualTypeOf<{
    readonly ok: false;
    readonly isTypedError: false;
    readonly error: InternalError | ValidationError<never>;
  }>();

  // Success result with error map (should still be success shape)
  type SuccessWithErrorMap = ZagoraResult<
    number,
    TestErrorsMap,
    { readonly ok: true }
  >;
  expectTypeOf<SuccessWithErrorMap>().toEqualTypeOf<{
    readonly ok: true;
    data: number;
    readonly error: undefined;
  }>();

  // Error result with error map
  type ErrorWithMap = ZagoraResult<
    string,
    TestErrorsMap,
    { readonly ok: false }
  >;
  expectTypeOf<ErrorWithMap>().toMatchObjectType<{
    readonly ok: false;
    readonly isTypedError: true;
  }>();
});

// =============================================================================
// ResolveHandlerOptions Type Tests
// =============================================================================

test("ResolveHandlerOptions<...> - handler options signature with context and errors", () => {
  type TestContext = { userId: string };
  type TestSchema1 = AnySchema;
  type TestErrorsMap = {
    NOT_VALID: TestSchema1;
    NOT_FOUND: TestSchema1;
  };
  type TestEnvMap = TestSchema1;

  // With error map
  expectTypeOf<
    ResolveHandlerOptions<TestContext, TestErrorsMap, TestEnvMap>
  >().toEqualTypeOf<{
    context: TestContext;
    errors: ErrorHelpers<TestErrorsMap>;
    env: InferSchemaOutputSafe<TestEnvMap>;
  }>();

  // Without error map (errors should be undefined)
  expectTypeOf<
    ResolveHandlerOptions<TestContext, undefined, AnySchema>
  >().toEqualTypeOf<{
    context: TestContext;
    errors: undefined;
    env: InferSchemaOutputSafe<TestEnvMap>;
  }>();

  // With empty context
  expectTypeOf<
    ResolveHandlerOptions<{}, TestErrorsMap, undefined>
  >().toEqualTypeOf<{
    context: {};
    errors: ErrorHelpers<TestErrorsMap>;
    env: InferSchemaOutputSafe<undefined>;
  }>();
});

// =============================================================================
// ResolveProcedure Type Tests
// =============================================================================

test("ResolveProcedure<...> - handler function signature based on disableOptions flag", () => {
  type TestContext = { userId: string };
  type TestSchema1 = AnySchema;
  type TestErrorsMap = {
    NOT_VALID: TestSchema1;
    NOT_FOUND: TestSchema1;
  };
  type TestEnvMap = TestSchema1;

  // Mock schema types for testing
  type StringSchema = AnySchema & { __output: string };

  // With disableOptions = true, no input schema
  type Proc1 = ResolveProcedure<
    true,
    TestContext,
    undefined,
    undefined,
    undefined
  >;
  expectTypeOf<Proc1>().toEqualTypeOf<() => any>();

  // With disableOptions = true, single input schema
  type Proc2 = ResolveProcedure<
    true,
    TestContext,
    StringSchema,
    undefined,
    undefined
  >;
  expectTypeOf<Proc2>().toExtend<(arg: string) => any>();

  // With disableOptions = false, no input schema
  type Proc3 = ResolveProcedure<
    false,
    TestContext,
    undefined,
    TestErrorsMap,
    TestEnvMap
  >;
  expectTypeOf<Proc3>().toEqualTypeOf<
    (
      options: ResolveHandlerOptions<TestContext, TestErrorsMap, TestEnvMap>,
    ) => any
  >();

  // With disableOptions = false, single input schema
  type Proc4 = ResolveProcedure<
    false,
    TestContext,
    StringSchema,
    TestErrorsMap,
    TestEnvMap
  >;
  expectTypeOf<Proc4>().toExtend<
    (
      options: ResolveHandlerOptions<TestContext, TestErrorsMap, TestEnvMap>,
      arg: string,
    ) => any
  >();
});

// =============================================================================
// SpreadTuple Type Tests
// =============================================================================

test("SpreadTuple<T, R> - spreads tuple types into function parameters with optional handling", () => {
  // Single element tuple
  type Spread1 = SpreadTuple<readonly [string], number>;
  expectTypeOf<Spread1>().toEqualTypeOf<(arg: string) => number>();

  // Two element tuple (both required)
  type Spread2 = SpreadTuple<readonly [string, number], boolean>;
  expectTypeOf<Spread2>().toEqualTypeOf<
    ((arg1: string, arg2: number) => boolean) | ((arg1: string) => boolean)
  >();

  // Two element tuple (second optional)
  type Spread3 = SpreadTuple<readonly [string, number | undefined], boolean>;
  expectTypeOf<Spread3>().toEqualTypeOf<
    | ((arg1: string, arg2?: number | undefined) => boolean)
    | ((arg1: string) => boolean)
  >();

  // Three element tuple (all required)
  type Spread4 = SpreadTuple<readonly [string, number, boolean], void>;
  expectTypeOf<Spread4>().toEqualTypeOf<
    | ((arg1: string, arg2: number, arg3: boolean) => void)
    | ((arg1: string, arg2: number) => void)
    | ((arg1: string) => void)
  >();

  // Three element tuple (last optional)
  type Spread5 = SpreadTuple<
    readonly [string, number, boolean | undefined],
    void
  >;
  expectTypeOf<Spread5>().toEqualTypeOf<
    | ((arg1: string, arg2: number, arg3?: boolean | undefined) => void)
    | ((arg1: string, arg2: number) => void)
    | ((arg1: string) => void)
  >();

  // Empty tuple
  type Spread6 = SpreadTuple<readonly [], string>;
  expectTypeOf<Spread6>().toEqualTypeOf<() => string>();

  // Many element tuple (rest parameter)
  type Spread7 = SpreadTuple<
    readonly [string, number, boolean, object, symbol],
    any
  >;
  expectTypeOf<Spread7>().toEqualTypeOf<
    (...args: readonly [string, number, boolean, object, symbol]) => any
  >();
});

// =============================================================================
// Function Parameter Type Tests
// =============================================================================

test("Function parameters - createResult, validateInputOutputOrEnv, validateError signatures", () => {
  // Test createResult parameters
  // createResult(data: any, error: any, isTypedError: boolean)
  // Returns a union type: { ok: true, data } | { ok: false, isTypedError, error }
  const testCreateResult1 = createResult("some data", null, false);
  expectTypeOf(testCreateResult1).toHaveProperty("ok");
  expectTypeOf(testCreateResult1.ok).toEqualTypeOf<boolean>();

  const testCreateResult2 = createResult(null, { kind: "ERROR" }, true);
  expectTypeOf(testCreateResult2).toHaveProperty("ok");
  expectTypeOf(testCreateResult2.ok).toEqualTypeOf<boolean>();

  const testCreateResult3 = createResult({ foo: "bar" }, null, false);
  expectTypeOf(testCreateResult3).toHaveProperty("ok");
  expectTypeOf(testCreateResult3.ok).toEqualTypeOf<boolean>();

  // Test that createResult accepts the correct parameter types
  expectTypeOf(createResult).toBeCallableWith("data", null, false);
  expectTypeOf(createResult).toBeCallableWith(null, new Error(), true);
  expectTypeOf(createResult).toBeCallableWith({ any: "data" }, null, false);

  // Test validateInputOutputOrEnv parameters
  // validateInputOutputOrEnv(mode: "input" | "output", schema: any, data: any)
  type ValidateInputOutputFn = typeof validateInputOutputOrEnv;
  expectTypeOf<ValidateInputOutputFn>().toExtend<
    (mode: "input" | "output", schema: any, data: any) => any
  >();

  expectTypeOf<ValidateInputOutputFn>().parameters.toEqualTypeOf<
    ["input" | "output" | "env", any, any]
  >();

  // Test validateError parameters
  // validateError<TKindNames>(errorsMap: Record<string, AnySchema>, error: any, isAsync: boolean)
  type ValidateErrorFn = typeof validateError;
  expectTypeOf<ValidateErrorFn>().toExtend<
    <_TKindNames>(
      errorsMap: Record<string, AnySchema>,
      error: any,
      isAsync: boolean,
    ) => any
  >();

  // Test with specific error map type
  type SpecificErrorMap = {
    NOT_FOUND: AnySchema;
    UNAUTHORIZED: AnySchema;
  };
  const testValidateError = validateError<keyof SpecificErrorMap>(
    {} as SpecificErrorMap,
    { kind: "NOT_FOUND" },
    false,
  );

  type Res =
    | {
        readonly ok: false;
        readonly isTypedError: boolean;
        readonly error: any;
        readonly data?: undefined;
      }
    | {
        readonly ok: true;
        readonly data: any;
        readonly isTypedError?: undefined;
        readonly error?: undefined;
      };

  // validateError returns a result object or a Promise of result object
  expectTypeOf(testValidateError).toExtend<Res | Promise<Res>>();
});

// =============================================================================
// Zagora Procedure Return Type Tests
// =============================================================================

test("not uppercased errorsMap keys must be reported", () => {
  const errorsMap = {
    invalid_key: z.object({ status: z.string(), code: z.number() }),
    UNAUTHORIZED: z.object({ retryAfter: z.number(), userId: z.string() }),
  };
  const func = zagora()
    // @ts-expect-error -- Invalid errorsMap keys must be reported. Keys must be uppercased. DO NOT REMOVE THIS LINE! It will potentially report when this rule is incorrectly broken!
    .errors(errorsMap)
    .handler(() => 123)
    .callable();

  const res = func();
  if (res.ok) {
    expectTypeOf(res.data).toEqualTypeOf<number>();
  }
});

test("Zagora procedures - sync handler return types", () => {
  const inputSchema = z.tuple([z.string(), z.object({ name: z.string() })]);
  const outputSchema = z.object({ greeting: z.string() });
  const errorsMap = {
    HTTP_ERROR: z.object({ status: z.string(), code: z.number() }),
    UNAUTHORIZED: z.object({ retryAfter: z.number(), userId: z.string() }),
  };

  type InputType = z.infer<typeof inputSchema>;
  type OutputType = z.infer<typeof outputSchema>;
  type DefinedErrors = keyof typeof errorsMap;
  type ErrorKinds =
    | DefinedErrors
    | InternalError["kind"]
    | ValidationError["kind"];

  type ErrorsResolvedType = InferSchemaMapPlain<typeof errorsMap, true>;
  type ErrorHelpersType = ErrorHelpers<typeof errorsMap>;

  const syncProc = zagora()
    .input(inputSchema)
    .output(outputSchema)
    .errors(errorsMap)
    .handler((options, input, cfg) => {
      expectTypeOf(options.context).toBeUndefined();
      expectTypeOf(options.errors).toEqualTypeOf<ErrorHelpersType>();
      expectTypeOf(input).toEqualTypeOf<string>();
      expectTypeOf(cfg).toBeObject();
      expectTypeOf(cfg).toEqualTypeOf<InputType[1]>();

      return { greeting: `Hello ${cfg.name}` };
    })
    .callable();

  expectTypeOf(syncProc).parameter(0).toEqualTypeOf<InputType[0]>();
  expectTypeOf(syncProc).toBeCallableWith("foo", { name: "World" });

  const syncResult = syncProc("foo", { name: "World" });
  expectTypeOf(syncResult).toExtend<ZagoraResult<any, any, any>>();

  if (syncResult.error) {
    expectTypeOf(syncResult.ok).toEqualTypeOf<false>();
    expectTypeOf(syncResult.error.kind).toEqualTypeOf<ErrorKinds>();
  }

  if (syncResult.ok) {
    expectTypeOf(syncResult.ok).toEqualTypeOf<true>();
    expectTypeOf(syncResult.data).toEqualTypeOf<OutputType>();
    expectTypeOf(syncResult.error).toEqualTypeOf<undefined>();
  } else if (syncResult.error && syncResult.error.kind === "UNKNOWN_ERROR") {
    expectTypeOf(syncResult.error).toHaveProperty("kind");
    expectTypeOf(syncResult.error).toEqualTypeOf<
      ReturnType<typeof createInternalError>
    >();
  } else if (syncResult.error && syncResult.error.kind === "VALIDATION_ERROR") {
    expectTypeOf(syncResult.error).toHaveProperty("kind");
    expectTypeOf(syncResult.error.kind).toEqualTypeOf<"VALIDATION_ERROR">();
    expectTypeOf(syncResult.error.message).toBeString();
    expectTypeOf(syncResult.error.issues).not.toBeUndefined();
    expectTypeOf(syncResult.error.key).toEqualTypeOf<
      DefinedErrors | undefined
    >();
  } else if (syncResult.error && syncResult.error.kind === "HTTP_ERROR") {
    expectTypeOf(syncResult.error).toHaveProperty("kind");
    expectTypeOf(syncResult.error.status).toEqualTypeOf<
      ErrorsResolvedType["HTTP_ERROR"]["status"]
    >();
    expectTypeOf(syncResult.error.code).toEqualTypeOf<
      ErrorsResolvedType["HTTP_ERROR"]["code"]
    >();
  } else if (syncResult.error && syncResult.error.kind === "UNAUTHORIZED") {
    expectTypeOf(syncResult.error).toHaveProperty("kind");
    expectTypeOf(syncResult.error.retryAfter).toEqualTypeOf<
      ErrorsResolvedType["UNAUTHORIZED"]["retryAfter"]
    >();
    expectTypeOf(syncResult.error.userId).toEqualTypeOf<
      ErrorsResolvedType["UNAUTHORIZED"]["userId"]
    >();
  }
});

test("Zagora procedures - async handler return types", async () => {
  const someJson = `{"name": "zagora"}`;
  const safeAsyncParse = zagora()
    .output(z.object({ name: z.string() }))
    .handler(async () => JSON.parse(someJson))
    .callable();

  const res1promise = safeAsyncParse();
  expectTypeOf(res1promise).toExtend<Promise<ZagoraResult<any, any, any>>>();

  type ErrorKinds = InternalError["kind"] | ValidationError["kind"];

  const resOne = await res1promise.then((res) => {
    if (res.error) {
      expectTypeOf(res.ok).toEqualTypeOf<false>();
      expectTypeOf(res.error.kind).toEqualTypeOf<ErrorKinds>();
    }

    if (res.ok) {
      expectTypeOf(res.ok).toEqualTypeOf<true>();
      expectTypeOf(res.data).toEqualTypeOf<{ name: string }>();
      expectTypeOf(res.error).toEqualTypeOf<undefined>();
    }

    return res;
  });

  if (resOne.error) {
    expectTypeOf(resOne.ok).toEqualTypeOf<false>();
    expectTypeOf(resOne.error.kind).toEqualTypeOf<ErrorKinds>();
    expectTypeOf(resOne.error.message).toEqualTypeOf<string>();
  }

  if (resOne.ok) {
    expectTypeOf(resOne.ok).toEqualTypeOf<true>();
    expectTypeOf(resOne.data).toEqualTypeOf<{ name: string }>();
    expectTypeOf(resOne.error).toEqualTypeOf<undefined>();
  }

  const safeParsePromiseSync = zagora({
    disableOptions: true,
    autoCallable: true,
  })
    .input(z.string())
    .output(z.number())
    .handler((val) => Promise.resolve(JSON.parse(val)));

  const res4 = await safeParsePromiseSync("123");

  if (res4.error) {
    expectTypeOf(res4.ok).toEqualTypeOf<false>();
    expectTypeOf(res4.error.kind).toEqualTypeOf<ErrorKinds>();
  }

  if (res4.ok) {
    expectTypeOf(res4.ok).toEqualTypeOf<true>();
    expectTypeOf(res4.data).toEqualTypeOf<number>();
    expectTypeOf(res4.error).toEqualTypeOf<undefined>();
  }
});

test("type test zagora options", () => {
  expectTypeOf(zagora).toBeCallableWith({
    autoCallable: true,
  });
  expectTypeOf(zagora).toBeCallableWith({
    disableOptions: true,
  });
  expectTypeOf(zagora).toBeCallableWith({
    disableOptions: true,
    autoCallable: true,
  });
  expectTypeOf(zagora).toBeCallableWith({
    disableOptions: false,
    autoCallable: false,
  });
  expectTypeOf(zagora).toBeCallableWith({
    disableOptions: true,
    autoCallable: false,
  });
  expectTypeOf(zagora).toBeCallableWith({
    disableOptions: false,
    autoCallable: true,
  });
  expectTypeOf(zagora).toBeCallableWith({
    // @ts-expect-error - foo is not a valid option so it is expected to report error here!
    foo: true,
  });
});

  test('callable procedure types > should have ~zagora property typed correctly', () => {
    const procedure = zagora()
      .input(z.string())
      .handler((_, id) => id)
      .callable();

    // TypeScript should allow this without errors
    const meta: Partial<ZagoraDef<any, any, any, any, any, any>> = procedure['~zagora'];

    // Ensure metadata properties are accessible
    const _inputSchema = meta.inputSchema;
    const _outputSchema = meta.outputSchema;
    const _errorsMap = meta.errorsMap;
  });
