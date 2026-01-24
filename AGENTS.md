# Zagora Library

Zagora produces regular type-safe and error-safe TypeScript functions that encapsulate business logic with robust validation, error handling, and context management -- no special clients or routers, no async overhead or network complexity. Perfect for building type-safe libraries, SDKs, APIs, and internal tooling.

## Quick Example

```ts
import { z } from 'zod';
import { zagora } from 'zagora';

const getUser = zagora()
  .input(z.tuple([z.string(), z.number().default(18), z.string().optional()]))
  .handler((_, name, age, country) => {
    // name: string
    // age: number <-- because there is a default value in schema!
    // country: string | undefined <-- because it's marked as optional in schema!
    return `${name} is ${age}, from ${country || 'unknown'}`
  })
  .callable();

getUser('John', 30);
// => John is 30

// @ts-expect-error -- reported at compile-time AND runtime, invalid second argument
getUser('John', 'foo');

// @ts-expect-error -- reported at compile-time AND runtime, missing required argument
getUser();

// NOTE: fine, because second and third arguments are optional (default or optional)
getUser('Barry') // => Barry is 18, from unknown

getUser('Barry', 25) // => Barry is 25, from unknown
getUser('Barry', 33, 'USA') // => Barry is 33, from USA

const result = getUser('Alice');
if (result.ok) {
  console.log(result.data); // "Alice is 18, from unknown"
} else {
  console.error(result.error.kind);

  console.error(result.error);
  // ^ { kind: 'UNKNOWN_ERROR', message, cause }
  // or
  // ^ { kind: 'VALIDATION_ERROR', message, issues: Schema.Issue[] }
}
```

### With primitive inputs

```ts
// primitive input
const helloUppercased = za
  .input(z.string())
  .handler((_, str) => str.toUpperCase())
  .callable();

const res = helloUppercased('Hello world');

if (res.ok) {
  console.log(res);
  // ^ { ok: true, data: 'HELLO WORLD', error: undefined }
}

// array input
const uppercase = zagora({ autoCallable: true, disableOptions: true })
  .input(z.array(z.string()))
  .handler((arrayOfStrings) => {
    // NOTE: `x` is typed as string too!
    return arrayOfStrings.map((x) => x.toUpperCase());
  })

const upRes = uppercase(['foo', 'bar', 'qux']);
if (upRes.ok) {
  console.log(upRes);
  // ^ { ok: true, data: ['FOO', 'BAR', 'QUX' ] }
}
```

You'll also have access to all the types, utils, and error helpers for type-narrowing through package exports.

```ts
import { 
  isValidationError,
  isInternalError,
  isDefinedError,
  isZagoraError,
} from 'zagora/errors';

import * as ZagoraTypes from 'zagora/types';
import * as zagoraUtils from 'zagora/utils';
```


## Features

### Unmatched Robustness

Zagora achieves 100% test coverage, ensuring every aspect of the library is rigorously tested for reliability and correctness. Complementing this, it includes **dedicated type tests** that utilize `expectType` to verify TypeScript types at compile time. Together, these provide robust guarantees that both the compile-time and runtime systems match, delivering confidence of another level.

### Minimal and Standards-Based

Zagora is lightweight with zero dependencies and bloat, built entirely on [StandardSchema](https://standardschema.dev) for universal validation. This means you can use Zod, Valibot, ArkType, or any compliant validator. No lock-in, just the tools you already know and love.

### Never-Throwing Execution

Every function returns a predictable `{ ok, data, error }` result -- exceptions are eliminated completely. Your process never crashes from unhandled errors, similar to Effect.ts or neverthrow. This gives you total control and deterministic error handling across your entire codebase.

### Typed Errors System

Define error schemas upfront and get strongly-typed error helpers inside your handlers. Each error kind is validated at runtime and fully typed at compile-time. You'll never see `try/catch` blocks or guess error shapes again.

### Full Type Inference

Complete TypeScript inference across inputs, outputs, errors, context, defaults, and optionals. Even JavaScript consumers get full autocomplete and IntelliSense support. The type system has been battle-tested with dedicated type-level tests.

### Multiple Arguments Support

Define multiple function arguments using schema tuples with per-argument validation and defaults. Call your functions naturally like `procedure('Alice', 25)` instead of `procedure({ name: 'Alice', age: 25 })`. This creates a familiar API that feels like native TypeScript functions.

### Granular Diagnostics

Zagora supports compile-time reporting for each argument through TypeScript in IDEs and CLIs, catching potential errors before runtime. This diagnostic capability operates at every level, from schema validation to handler invocationm, to context, to environment variables. Developers receive immediate, precise feedback on argument mismatches, improving code reliability and productivity.

### Sync & Async Awareness at every level

Zagora dynamically infers whether procedures are sync or async based on handler and schema behavior. Sync handlers return `Result`, async handlers return `Promise<Result>` -- no forced async everywhere. This is impossible with oRPC/tRPC where everything is always async.

### Built-in Caching

Add memoization to any procedure with a simple cache adapter. Cache keys include input, schemas, and handler body for intelligent invalidation. Works with both sync and async cache implementations seamlessly.

### Just Pure Functions

Zagora produces regular TypeScript functions -- no special clients, routers, or network glue required. Export your procedures directly and call them like any other function. Perfect for building type-safe libraries, SDKs, and internal tooling.

## Creating procedures

Fluent builder API for chaining methods on a Zagora instance:

```ts
import { zagora } from 'zagora';
import z from 'zod';

const agent = zagora()
  .input(z.object({ name: z.string(), age: z.number().default(20) }))
  .output(z.object({ greeting: z.string() }))
  .handler(({ context }, input) => ({
    greeting: `Hello ${input.name}, you are ${input.age} years old!`
  }))
  .callable(/* { context, cache, env } */);

const result = agent({ name: 'Alice' });
```

**Important:** the handler signature differs from oRPC/tRPC and Zagora requires `.callable` by default:

- oRPC/tRPC - `.handler(({ input, context }) => {})` - always a single object
- zagora with primitive input (string, object, array) - `.handler(({ context }, input) => {})` 
- zagora with tuple schemas (spreaded args) - `.handler(({ context }, name, age) => {})` 
- zagora with errors map - `.errors({ NOT_FOUND: z.object({ id: z.string() })}).handler(({ context, errors }, name, age) => {})`
- zagora without options object - `zagora({ disableOptions: true }).input(z.string()).handler((str) => str.toUppercase())`

## Input and Output Validation

Define schemas for type-safe inputs and outputs using Zod, Valibot, or any Standard Schema V1 compliant library:

- **Input Schema**: Validates arguments before execution.
- **Output Schema**: Ensures return values match expectations.

```ts
const mathAgent = zagora()
  .input(z.tuple([z.number(), z.number()]))
  .output(z.number())
  .handler((_, a, b) => a + b)
  .callable();

const sum = mathAgent(5, 10); // { ok: true, data: 15 }
```

## Env Vars validation

Validate environment variables with the same schema system used for inputs and outputs. Get type-safe access to `process.env` or `import.meta.env` inside handlers. Coercion, defaults, and optionals work exactly as expected. Env vars are passed to the handler's `options` object as `options.env`, not in `options.context` or somewhere else. All default filling, optionals, coercing works as in any other place. Though, in theory you can provide whatever you want in `options.context` including env vars, if you want to match the behavior of oRPC or something else.

**Important: Providing async schema for env variables is not supported, at least for now!!**

```ts
const safeApi = zagora()
  .env(z.object({
    DATABASE_URL: z.string().min(1).default('file://db.sqlite'),
    JWT_SECRET: z.string().min(10),
    PORT: z.coerce.number() // env.PORT will be number
  }))
  .input(z.tuple([z.number(), z.number()]))
  .output(z.number())
  .handler(({ env }) => {
    // env: { DATABASE_URL: string, JWT_SECRET: string, PORT: number }
    return a + b + env.PORT;
  })
  // NOTE: you may need to cast with `as any` beause process.env differs from the schema!
  .callable({ env: process.env as any });

// PORT is coming from env vars
const sum = safeApi(5, 10); // { ok: true, data: 15 + PORT }
```

**Important notes:**
- When `disableOptions` is enabled (eg. `true`) then handler WILL NOT have access to type-safe env vars.
- When `autoCallable` is enabled (eg. `true`) make sure to provide the runtime env vars as second argument to the `.env(schema, processEnvOrImportMetaEnv)` method.
- Async schema validation is not supported, for now
- The passed runtime env vars must match the provided schema (on type-level), thus you may need to cast to `as any` when you are providing `process.env` or `import.meta.env`. That is intentional because we want to be able to warn you (typescript report you) if you manually providing them.
- in case `env: process.env` is wanted, then just make the schema like `z.union([z.object(), z.record(z.string(), z.string())])` and you will not need to case with `as any` at `.callable`.

## Error Handling

Define custom errors with schemas for structured error responses:

```ts
const apiAgent = zagora()
  .input(z.object({ id: z.string() }))
  .output(z.object({ data: z.any() }))
  .errors({
    NOT_FOUND: z.object({ message: z.string() }),
    UNAUTHORIZED: z.object({ userId: z.string() })
  })
  .handler(({ errors }, { id }) => {
    if (!id) throw errors.UNAUTHORIZED({ userId: 'unknown' });
    // ... logic
    if (!found) throw errors.NOT_FOUND({ message: 'Item not found' });
    return { data: item };
  })
  .callable();
```

Procedures return `ZagoraResult<TOutput, TErrors>` with `ok: true` for success or `ok: false` with typed errors.

## Context Management / Depenency Injection

Pass shared data like databases or user info via context, useful for middlewares or testing.

```ts
const dbAgent = zagora()
  .context({ db: myDatabase })
  .input(z.string())
  .output(z.any())
  .handler(({ context }, query) => {
    console.log(context.bar); // => 123
    
    return context.db.query(query);
  })
  .callable({ context: { bar: 123 }});
```

Override context per call: `agent.callable({ context: { db: testDb } })`

## Caching and Memoization

Add caching to avoid redundant computations:

```ts
const cache = new Map();
const cachedCall = zagora()
  .cache(cache)
  .input(z.string())
  .output(z.string())
  .handler((_, input) => expensiveOperation(input))
  .callable();

// first time called
cachedCall('foo');
// second is cache hit
cachedCall('foo');
```

Cache can also be passed at execution-site (server handlers) through `.callable({ cache })`.

## Cleaner API - auto callable and disable options

For simpler procedures and API look, enable auto-callable mode to skip `.callable()` and disable passing options to handler:

```ts
const simpleProcedure = zagora({ autoCallable: true, disableOptions: true })
  .input(z.tuple([z.string(), z.number().default(10)]))
  .output(z.string())
  .handler((str, num) => str.toUpperCase());
  
const result = simpleProcedure('hello'); // Direct call
```

See more about the whole API docs at `./references/api-docs.md` file.

## Async procedures

Async handlers for I/O operations:

```ts
const asyncAgent = zagora()
  .input(z.string())
  .output(z.object({ result: z.string() }))
  .handler(async (_, url) => {
    const response = await fetch(url);
    return { result: await response.text() };
  })
  .callable();

const result = await asyncAgent("https://example.com");
```

## Best Practices

- Use descriptive schemas for clarity.
- Define errors for all failure cases.
- Leverage context for dependencies.
- Enable caching for performance-critical functions.
- Test functions with various inputs and error scenarios.

Can find more details at `./references/best-practices.md`

## Rules and Special Notes for Zagora usage

The following rules outlines critical points, edge cases, and things to be careful about when using Zagora. These are derived from specially noted sections, examples, and warnings in the documentation.

### Error Handling Cautions

#### Uppercase Error Keys
- **Caution**: All keys in the error map must be uppercased (e.g., `NOT_FOUND`, not `not_found`). TypeScript will report a type error if not.
- **Why**: These keys represent error "kinds" and are used in `result.error.kind`.

#### Error Payloads Validation
- **Caution**: If you pass invalid or missing keys to error helpers (e.g., `errors.NOT_FOUND({ invalidKey: 'value' })`), you get a `VALIDATION_ERROR` with a `key` property indicating which error validation failed.
- **Example**: `throw errors.RATE_LIMIT({ retryAfter: 'invalid' })` → `VALIDATION_ERROR` because `retryAfter` expects a number, but it will also be reported at compile-time (eg. in IDEs and etc)
- **Tip**: Use `.strict()` on error schemas to throw on unknown keys: `z.object({...}).strict()`.

#### Error Type Guards
- **Caution**: Use `isValidationError`, `isInternalError`, `isDefinedError`, `isZagoraError` to narrow error types safely.
- **Note**: Even syntax or reference errors in handlers return `ZagoraResult` with error, never crashing the process!

### Context Merging and Management
- **Caution**: Initial context (from `.context()`) is deep-merged with runtime context (from `.callable({ context })`).
- **Example**: `.context({ userId: 'default' })` + `.callable({ context: { foo: 'bar' } })` → merged `{ userId: 'default', foo: 'bar' }`.
- **Tip**: Useful for dependency injection; override at execution site (e.g., in server handlers).

## Input/Output Validation

### Tuple Inputs (Multiple Arguments)
- **Caution**: Tuple schemas like `z.tuple([z.string(), z.number().default(18)])` spread to handler args with defaults/optionals applied.
- **Example**: Handler receives `(name, age)` where `age` is `number` (not `number | undefined`) due to default.
- **Tip**: Supports per-argument validation and diagnostics; missing required args cause `VALIDATION_ERROR`.

### Default Values
- **Caution**: Defaults work at any schema level (objects, tuples, primitives); handler gets fully populated args.
- **Example**: `z.number().default(10)` → no need to pass; handler sees `number`, not `number | undefined`.

## Async Support

### Async Schemas
- **Caution**: If input/output/error schemas are async (e.g., `z.string().refine(async (val) => ...)`, procedure signature remains sync (`ZagoraResult`), but you **must await** at callsite. TypeScript may warn "may not need await" – **ignore that and await**, or don't use asycnhronous schemas.
- **Why**: StandardSchema limitation; We cannot infer async state on the type system level.
- **Tip**: ArkType doesn't support async schemas, avoiding this issue. 

### Handler Async Behavior
- **Caution**: Sync handler → sync procedure; async handler or Promise-returning → async procedure (`Promise<ZagoraResult>`).
- **Note**: If ANY of the CacheAdapter methods is async, then the procedure is forced async and you MUST await it.

## Caching/Memoization

### Cache Key Composition
- **Caution**: Cache key includes input, input/output/error schemas, and handler function body. Changes to any of them invalidates the cache.
- **Tip**: Useful for custom strategies; memoization out-of-the-box.

### Cache Failures
- **Caution**: Cache adapter throws → `UNKNOWN_ERROR` with `cause` set to original error; process never crashes.
- **Future**: May change to `CACHE_ERROR`.
- **Tip**: If cache has async methods (e.g., `has` is async), procedure becomes async – **await** despite TypeScript warnings.

### Cache Provision
- **Caution**: Provide cache via `.cache()` (definition) or `.callable({ cache })` (execution/callsite). Execution/callsite useful for routers/server handlers.

## Options and Configuration

### Options Object
- **Caution**: Handlers receive `options` as first param: `{ context, errors }`. Typed and merged.
- **Example**: `handler((options, input) => { const { context, errors } = options; ... })`.

### Disable Options
- **Caution**: `zagora({ disableOptions: true })` omits options; handler starts directly with inputs.
- **Example**: `handler((str, num) => ...)` instead of `handler((options, str, num) => ...)`.

### Auto-Callable Mode
- **Caution**: `zagora({ autoCallable: true })` returns procedure directly from `.handler()`; skip `.callable()`.
- **Tip**: Combine with `disableOptions` for cleaner APIs.

## Guarantees and Type Safety

### Never-Throwing
- **Caution**: Procedures never throw; all errors (validation, handler, cache) wrapped in `ZagoraResult`.
- **Example**: `throw new Error('Oops')` → `result.error.kind === 'UNKNOWN_ERROR'`, `result.error.cause.message === 'Oops'`.

### Type Inference
- **Caution**: Full TS support; `result.ok`, `result.data`, `result.error` are discriminated unions.
- **Note**: Complex type system tested; changes caught by type tests.

## General Tips

- **Motivation Reminder**: Zagora produces "just functions" – no network/router assumptions. Focused on low-level, library-building.
- **Comparison**: Unlike oRPC/tRPC (network-focused, always async, single-object inputs), Zagora supports sync, tuples, no middlewares.
- **Alternatives**: Over plain TS (no runtime validation); over standalone schemas (ergonomic layer, unified validation).
- **Testing**: Inspect `test/types-testing.test.ts` for type guarantees.
- **Edge Cases**: Always test with invalid inputs, async paths, and error scenarios.

By having these cautions in mind, you can avoid common pitfalls and leverage Zagora's full potential for type-safe, error-safe procedures.
