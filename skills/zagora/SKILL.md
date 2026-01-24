---
name: zagora
description: Build type-safe, error-safe functions in TypeScript with full inference, typed errors, and zero async overhead. Use when creating robust libraries or APIs where type safety and predictable error handling matter, as an alternative to plain TypeScript validation or RPC frameworks.
---

# Zagora

Zagora creates type-safe, error-safe functions that never throw. It provides full TypeScript inference across inputs, outputs, errors, and context. Unlike RPC frameworks, Zagora produces pure functions - no network layer, just supercharged TypeScript functions.

## When to Use

Use Zagora to build:
- Library APIs that need runtime safety
- Internal business logic with predictable errors
- SDKs requiring type-safe interactions
- Procedures where throwing exceptions breaks control flow
- Network-bound APIs with structured error handling

Avoid Zagora for:
- Simple functions without validation needs
- Pure data transformation (plain TypeScript suffices)
- Complex distributed systems (use oRPC/tRPC for multi-service communication)

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

Zagora supports compile-time reporting for each argument through TypeScript in IDEs and CLIs, catching potential errors before runtime. This diagnostic capability operates at every level, from schema validation to handler invocation, to context, to environment variables. Developers receive immediate, precise feedback on argument mismatches, improving code reliability and productivity.

### Sync & Async Awareness At Every Level

Zagora dynamically infers whether procedures are sync or async based on handler and schema behavior. Sync handlers return `Result`, async handlers return `Promise<Result>` -- no forced async everywhere. This is impossible with oRPC/tRPC where everything is always async.

### Built-in Caching

Add memoization to any procedure with a simple cache adapter. Cache keys include input, schemas, and handler body for intelligent invalidation. Works with both sync and async cache implementations seamlessly.

### Just Pure Functions

Zagora produces regular TypeScript functions -- no special clients, routers, or network glue required. Export your procedures directly and call them like any other function. Perfect for building type-safe libraries, SDKs, and internal tooling.

### Env Vars Validation

Validate environment variables with the same schema system used for inputs and outputs. Get type-safe access to `process.env` or `import.meta.env` inside handlers. Coercion, defaults, and optionals work exactly as expected.

### No Unwrapping Required

Unlike neverthrow or similar libraries, you directly access `result.data` or `result.error`. No `.unwrap()`, `.map()`, or monadic chains needed. The discriminated union type guides you naturally with TypeScript's narrowing.

## Quick Start

```ts
import { z } from 'zod';
import { zagora } from 'zagora';

const greeting = zagora()
  .input(z.tuple([z.string(), z.number().default(18), z.string().optional()]))
  .handler((_, name, age, country) => {
    // name: string
    // age: number <-- because there is a default value in schema!
    // country: string | undefined <-- because it's marked as optional in schema!
    return `${name} is ${age}, from ${country || 'unknown'}`
  })
  .callable();

greeting('John', 30);
// NOTE: examples below omit the { ok, data, error } wrapper for brevity.
// => John is 30

// @ts-expect-error -- reported at compile-time AND runtime, invalid second argument
greeting('John', 'foo');

// @ts-expect-error -- reported at compile-time AND runtime, missing required argument
greeting();

// NOTE: fine, because second and third arguments are optional (default or optional)
greeting('Barry') // => Barry is 18, from unknown

greeting('Barry', 25) // => Barry is 25, from unknown
greeting('Barry', 33, 'USA') // => Barry is 33, from USA

const result = greeting('Alice');
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

## Installation

Zagora works with any StandardSchema-compliant validator like Zod, Valibot, or ArkType.

### Install Zagora

```bash
bun add zagora
```

### Install a Validator

Choose a StandardSchema-compliant validation library:

```bash
bun add zod
# or
bun add valibot
# or
bun add arktype
```

### Verify Installation

Create a simple procedure to verify everything works:

```js
import { z } from 'zod';
import { zagora } from 'zagora';

const greet = zagora()
  .input(z.string())
  .handler((_, name) => `Hello, ${name}!`)
  .callable();

const result = greet('World');
console.log(result);
// { ok: true, data: 'Hello, World!', error: undefined }
```

### TypeScript Configuration

Zagora is written in TypeScript and provides full type inference out of the box. No additional configuration is required, but ensure your `tsconfig.json` has `strict` mode enabled for the best experience:

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

## Core Concepts

- [Procedures](./references/core/procedures.md): Builder API and handler options
- [Validation](./references/core/validation.md): Input and output validation with schemas
- [Typed Errors](./references/core/typed-errors.md): Define structured error types

## Advanced Features

**NOTE:** Auto‑callable skips `.callable()` but also removes per‑call (at callsite) configuration of `context`, `env`, and `cache`. This means you would need to use the methods at definition time (eg. where you write `zagora()`), like `zagora().env(schema).context(schema).cache(cacheAdapter)`.

- [Async Support](./references/advanced/async-support.md): Sync/async inference and mixed usage
- [Tuple Arguments](./references/advanced/tuple-arguments.md): Multiple arguments with validation
- [Default Values](./references/advanced/default-values.md): Auto-fill missing arguments
- [Context Management](./references/advanced/context-management.md): Pass shared dependencies
- [Caching & Memoization](./references/advanced/caching-memoization.md): Avoid redundant computations
- [Environment Variables](./references/advanced/environment-variables.md): Type-safe env var validation
- [Auto-Callable Mode](./references/advanced/auto-callable-mode.md): Option to let you skip the `.callable()` step for a smaller & cleaner API (use only when you don't need per-call config for context, env, and cache)
- [Best Practices](./references/advanced/best-practices.md): Guidelines for effective usage
- [Routers and Network Patterns](./references/advanced/routers-network.md): API integration patterns

## Error Handling

- [Never-Throwing Guarantees](./references/error-handling/never-throwing-guarantees.md): Procedures never crash
- [Error Type Guards](./references/error-handling/error-type-guards.md): Narrow error types with utilities
- [Error Types](./references/error-handling/error-types.md): Built-in and user-defined errors

## Comparisons

- [vs Plain TypeScript](./references/comparisons/vs-plain-typescript.md)
- [vs Standalone Validators](./references/comparisons/vs-standalone-validators.md)
- [vs neverthrow/Effect.ts](./references/comparisons/vs-neverthrow-effect-ts.md)
- [vs oRPC/tRPC](./references/comparisons/vs-rpc-frameworks.md)
