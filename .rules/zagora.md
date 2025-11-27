# Zagora Library

Zagora enables building type-safe and error-safe procedures that encapsulate business logic with robust validation, error handling, and context management. Agents are callable functions that ensure input/output safety and provide structured error responses.

## Highlights

- 🪶 **Minimal:** Lightweight and focused, built on [StandardSchema](https://standardschema.dev) for seamless validation.
- 🛡️ **Error-Safe:** Eliminates exceptions - always `{ ok, data, error }` for predictable, crash-free execution.
- 🦢 **Graceful:** Functions never throw or disrupt your process, akin to `effect.ts` and `neverthrow`.
- 📝 **Typed Errors:** Define error schemas for strongly-typed error helpers, enhancing handler reliability.
- 🧹 **Clean Error Model:** Three distinct error types - unknown, validation, and user-defined—for clarity.
- 🔒 **Type-Safe:** Full type inference across inputs, outputs, errors, context, optionals, and defaults.
- ✋ **Ergonomic:** Pure functions with auto-filled defaults, optional args, and detailed diagnostics.
- 🏠 **Familiar:** Echoes remote-RPC patterns from oRPC and tRPC, but focused on libraries, not apps.
- ⚖️ **Unopinionated:** Zero assumptions - no routers, middlewares, or network dependencies.
- 🎁 **No Unwrapping:** Direct access to results, unlike `neverthrow` - no extra steps required.

## Usage

```ts
import { z } from 'zod';
import { zagora } from 'zagora';

const za = zagora();

const getUser = za
  .input(z.tuple([
    z.string(),
    z.number().default(18),
  ]))
  .output(z.object({ name: z.string(), age: z.number(), email: z.string() }))
  .handler(async (_, name, age) => {
    // name: string;
    // age: number; -- even if not passed!
    return { name, age, email: `${name.toLowerCase()}@example.com` };
  })
  .callable();

const result = await getUser('Charlie');
if (result.ok) {
  console.log(result.data);
  // ^ { name: 'Charlie', age: 18, email: 'charlie@example.com' }
} else {
  console.error(result.error);
  // ^ { kind: 'UNKNOWN_ERROR', message, cause }
  // or
  // ^ { kind: 'VALIDATION_ERROR', message, issues: Schema.Issue[] }
}

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

You'll also have access to all the types, utils, and error-related stuff through package exports.

```ts
import { 
  isValidationError,
  isInternalError,
  isDefinedError,
  isZagoraError,
} from 'zagora/errors';

import * ZagoraTypes from 'zagora/types';
import * zagoraUtils from 'zagora/utils';
```

## Creating procedures

Fluent builder API for chaining methods on a Zagora instance:

```typescript
import { zagora } from 'zagora';
import z from 'zod';

const agent = zagora()
  .input(z.object({ name: z.string(), age: z.number().default(20) }))
  .output(z.object({ greeting: z.string() }))
  .handler(({ context }, input) => ({
    greeting: `Hello ${input.name}, you are ${input.age} years old!`
  }))
  .callable();

const result = agent({ name: 'Alice' });
```

**Important:** the handler signature differs from oRPC/tRPC and Zagora requires `.callable` by default:

- oRPC/tRPC - `.handler(({ input, context }) => {})` - always a single object
- zagora with primitive input (string, object, array) - `.handler(({ context }, input) => {})` 
- zagora with tuple schemas (spreaded args) - `.handler(({ context }, name, age) => {})` 
- zagora with errprs map - `.errors({ NOT_FOUND: z.object({ id: z.string() })}).handler(({ context, errors }, name, age) => {})`
- zagora without options object - `zagora({ disableOptions: true }).input(z.string()).handle((input) => input)`

## Input and Output Validation

Define schemas for type-safe inputs and outputs using Zod, Valibot, or any Standard Schema V1 compliant library:

- **Input Schema**: Validates arguments before execution.
- **Output Schema**: Ensures return values match expectations.

```typescript
const mathAgent = zagora()
  .input(z.tuple([z.number(), z.number()]))
  .output(z.number())
  .handler((_, a, b) => a + b)
  .callable();

const sum = mathAgent(5, 10); // { ok: true, data: 15 }
```

## Error Handling

Define custom errors with schemas for structured error responses:

```typescript
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

## Context Management

Pass shared data like databases or user info via context:

```typescript
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

```typescript
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

For simpler procedures and API look, enable auto-callable mode to skip `.callable()` and  disable passing options to handler:

```typescript
const simpleProcedure = zagora({ autoCallable: true, disableOptions: true })
  .input(z.tuple([z.string(), z.number().default(10)]))
  .output(z.string())
  .handler((str, num) => input.toUpperCase());
  
const result = simpleProcedure('hello'); // Direct call
```

## Async procedures

Async handlers for I/O operations:

```typescript
const asyncAgent = zagora()
  .input(z.string())
  .output(z.object({ result: z.string() }))
  .handler(async (_, url) => {
    const response = await fetch(url);
    return { result: await response.text() };
  })
  .callable();
```

## Best Practices

- Use descriptive schemas for clarity.
- Define errors for all failure cases.
- Leverage context for dependencies.
- Enable caching for performance-critical agents.
- Test agents with various inputs and error scenarios.

Agents built with Zagora are composable, testable, and maintain type safety throughout the application lifecycle.

## Rules and Special Notes for Zagora usage

The following rules outlines critical points, edge cases, and things to be careful about when using Zagora. These are derived from specially noted sections, examples, and warnings in the documentation.

## Error Handling

### Uppercase Error Keys
- **Caution**: All keys in the error map must be uppercased (e.g., `NOT_FOUND`, not `not_found`). TypeScript will report a type error if not.
- **Why**: These keys represent error "kinds" and are used in `result.error.kind`.

### Error Helper Validation
- **Caution**: If you pass invalid or missing keys to error helpers (e.g., `errors.NOT_FOUND({ invalidKey: 'value' })`), you get a `VALIDATION_ERROR` with a `key` property indicating which error validation failed.
- **Example**: `throw errors.RATE_LIMIT({ retryAfter: 'invalid' })` → `VALIDATION_ERROR` because `retryAfter` expects a number.
- **Tip**: Use `.strict()` on error schemas to throw on unknown keys: `z.object({...}).strict()`.

### Error Type Guards
- **Caution**: Use `isValidationError`, `isInternalError`, `isDefinedError`, `isZagoraError` to narrow error types safely.
- **Note**: Even syntax errors in handlers return `ZagoraResult` with error, never crashing the process.

## Context Management

### Context Merging
- **Caution**: Initial context (from `.context()`) is deep-merged with runtime context (from `.callable({ context })`).
- **Example**: `.context({ userId: 'default' })` + `.callable({ context: { foo: 'bar' } })` → merged `{ userId: 'default', foo: 'bar' }`.
- **Tip**: Useful for dependency injection; override at execution site (e.g., in server handlers).

## Input/Output Validation

### Tuple Inputs (Multiple Arguments)
- **Caution**: Complex feature; schemas like `z.tuple([z.string(), z.number().default(18)])` spread to handler args with defaults/optionals applied.
- **Example**: Handler receives `(name, age)` where `age` is `number` (not `number | undefined`) due to default.
- **Tip**: Supports per-argument validation and diagnostics; missing required args cause `VALIDATION_ERROR`.

### Default Values
- **Caution**: Defaults work at any schema level (objects, tuples, primitives); handler gets fully populated args.
- **Example**: `z.number().default(10)` → no need to pass; handler sees `number`, not `number | undefined`.

## Async Support

### Async Schemas
- **Caution**: If input/output/error schemas are async (e.g., `z.string().refine(async (val) => ...)`, procedure signature remains sync (`ZagoraResult`), but you **must await** at callsite. TypeScript may warn "may not need await" – ignore and await.
- **Why**: StandardSchema limitation; cannot infer async on type-level.
- **Tip**: ArkType doesn't support async schemas, avoiding this issue. 

### Handler Async Behavior
- **Caution**: Sync handler → sync procedure; async handler or Promise-returning → async procedure (`Promise<ZagoraResult>`).
- **Note**: Cache async methods force procedure async.

## Caching/Memoization

### Cache Key Composition
- **Caution**: Cache key includes input, input/output/error schemas, and handler function body. Changes to any invalidate cache.
- **Tip**: Useful for custom strategies; memoization out-of-the-box.

### Cache Failures
- **Caution**: Cache adapter throws → `UNKNOWN_ERROR` with `cause` set to original error; process never crashes.
- **Future**: May change to `CACHE_ERROR`.
- **Tip**: If cache has async methods (e.g., `has` is async), procedure becomes async – **await** despite TypeScript warnings.

### Cache Provision
- **Caution**: Provide cache via `.cache()` (definition) or `.callable({ cache })` (execution). Execution-site useful for routers/server handlers.

## Options and Configuration

### Options Object
- **Caution**: Handlers receive `options` as first param: `{ context, errors }`. Typed and merged.
- **Example**: `handler((options, input) => { const { context, errors } = options; ... })`.

### Disable Options
- **Caution**: `zagora({ disableOptions: true })` omits options; handler starts directly with inputs.
- **Example**: `handler((input) => ...)` instead of `handler((options, input) => ...)`.

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

By heeding these cautions, you can avoid common pitfalls and leverage Zagora's full potential for type-safe, error-safe procedures.
