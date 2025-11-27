# Zagora

[![ci](https://github.com/tunnckoCore/zagora/actions/workflows/ci.yml/badge.svg)](https://github.com/tunnckoCore/zagora/actions/workflows/ci.yml) <!-- COV_BADGE:START -->![coverage](https://badgen.net/badge/coverage/95.85%25/99CC09)<!-- COV_BADGE:END -->

Elevate your TypeScript workflow with Zagora: a sleek, bulletproof toolkit for forging type-safe, error-proof functions and libraries that never throw. Powered by StandardSchema-compliant validators like Zod, Valibot, and Arktype, it delivers rock-solid input/output validation and richly typed errors. No routers, no network baggage — just pure, exportable functions ready to supercharge your code. The ultimate streamlined alternative to oRPC and tRPC, stripping away the network layer for unmatched type-safety, simplicity and robustness.


### Highlights

- 🪶 **Minimal:** Lightweight and focused, built on [StandardSchema](https://standardschema.dev) for seamless validation.
- 🛡️ **Error-Safe:** Eliminates exceptions - always `{ ok, data, error }` for predictable, crash-free execution.
- 🦢 **Graceful:** Functions never throw or disrupt your process, akin to `effect.ts` and `neverthrow`.
- 📝 **Typed Errors:** Define error schemas for strongly-typed error helpers, enhancing handler reliability.
- 🧹 **Clean Error Model:** Three distinct error types - unknown, validation, and user-defined—for clarity.
- 🔒 **Type-Safe:** Full type inference across inputs, outputs, errors, context, optionals, and defaults.
- ✋ **Ergonomic:** Pure functions with auto-filled defaults, optional args, and detailed diagnostics.
- 🏠 **Familiar:** Echoes remote-RPC patterns from oRPC and tRPC, but focused on libraries, not apps.
- ⚖️ **Unopinionated:** Zero assumptions - no routers, middlewares, or network concepts.
- 🎁 **No Unwrapping:** Direct access to results, unlike `neverthrow` - no extra steps required.
- 🎁 **EnvVars Handling:** Handling and validation of environment variables.
- 🤖 **Agents Ready:** Rules for LLMs with subtle nuances and where to be careful. [Read/get here](./AGENTS.md)

_This library is product of 3+ months of dedication and passion, after 10 years in Open Source._<br>
_It's the best library I've ever done (i have 300+)._<br>
_It's the best TypeScript library i've ever wrote (i love it)._<br>
_It's the most complex TypeScript I've ever wrote._<br>
_It's the most TypeScript I've ever learned._<br>
_I went all-in on TypeScript just this year - the experience is unparalleled._<br>

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Why zagora?](#why-zagora)
  - [Motivation](#motivation)
  - [Why Zagora over oRPC/tRPC/neverthrow/effect.ts?](#why-zagora-over-orpctrpcneverthroweffectts)
  - [Why Zagora over plain TypeScript functions?](#why-zagora-over-plain-typescript-functions)
  - [Why Zagora over standalone Zod/Valibot usage?](#why-zagora-over-standalone-zodvalibot-usage)
- [Features](#features)
  - [Type-Safe Input/Output Validation](#type-safe-inputoutput-validation)
  - [Typed Errors](#typed-errors)
  - [Error Type Guards](#error-type-guards)
  - [Context Management](#context-management)
  - [Object Inputs](#object-inputs)
  - [Tuple Inputs (Multiple Arguments)](#tuple-inputs-multiple-arguments)
  - [Default Values](#default-values)
  - [Async Support](#async-support)
  - [Caching/Memoization](#cachingmemoization)
  - [Environment Variables](#environment-variables)
  - [Handler Options Object](#handler-options-object)
  - [Auto-Callable Mode](#auto-callable-mode)
  - [Never-Throwing Guarantees](#never-throwing-guarantees)
  - [Type Safety Guarantees](#type-safety-guarantees)
- [API Reference](#api-reference)
  - [`zagora(config?)`](#zagoraconfig)
  - [Instance Methods](#instance-methods)
- [Error Types](#error-types)
- [ZagoraResult Type](#zagoraresult-type)
- [License](#license)


<!--### Highlights

- **Minimal:** Tiny surface, powered by StandardSchema (Zod, Valibot, Arktype)
- **Error-safety:** Nothing ever throws, you always get `{ ok, data, error }`
- **Gracefulness:** Functions will never throw or crash your process, similar to `effect.ts` and `neverthrow`
- **Typed-Errors:** Defined error schemas give you error helpers later used from inside handlers
- **Clean Separation:** There is only 3 kinds of errors - unknown/internal, validation, and user defined
- **Type-safety:** Full type inference everywhere, including for optionals and defaults
- **Ergonomics:** Just pure functions, default filling, optional trailing args, per-argument diagnostics
- **Familiar:** Familiar to remote-RPC frameworks like oRPC and tRPC
- **Unopinionated:** No assumptions, no opinions, no routers, no middlewares, no network glue
- **No unwrap:** Unlike `neverthrow` and other similar libaries, you don't need to unwrap anything-->

## Install

This is ESM-only package with built-in types.

```bash
bun install zagora
```

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

[Back to top](#table-of-contents)

## Why zagora?

### Motivation
While `orpc` is great and you can use it for direct function calls (and not network requests with `createRouterClient`), and for example for building "type-safe SDK"s, it does have a few opinions that may get in the way. I use it extensively in my projects, but `zagora` is smaller and even more focused approach - i always wanted "just functions" where you define input, outputs, and you get error-safe, typed function back not a wrapper around it.

Both `tRPC` and `oRPC` are promoted as "backend", or specifically for when you're building "apps". Recently, all major frameworks also introduced similar concepts, like "server actions" and so on. All that is cool, but `zagora` is focused on building just functions, a low-level library for building other libraries - I have a lot of them, so i need a simple way for building type-safe and error-safe functions, where i don't necessarily need network layer and i don't need "routers" concept, and etc.

They are built around the network, Zagora is built around functions with excellent egonomics, developer experience, and no assumptions. **It produces just functions, i cannot stress that enough.**

[Back to top](#table-of-contents)

### Why Zagora over oRPC/tRPC/neverthrow/effect.ts?

- Zagora is focused on producing "just functions", not networks, routers, or groups.
- oRPC and tRPC does not "support" creating synchornous functions, they always are async
  + in contrast, Zagora does not use `async/await `anywhere in the codebase, but `instanceof Promise` checks
  + the return type of Zagora procedures is dynamically inferred based on many factors
  - return type is NOT a union like `ZagoraResult | Promise<ZagoraResult>` which gives amazing DX
- oRPC/tRPC cannot create procedures that look like regular functions, they always accept a single object
  + that's important if you want to create a basic function with multiple input arguments
  + of course, with oRPC/tRPC you can just pass them as object, but that's not always wanted effect for end-users of libraries
- Zagora allows you to use schema tuples (`z.tuple([z.string(), z.number().default(10)])` to define multiple arguments
- Zagora is lower-level, focused on building libraries, but can be used to build groups and routers.
  + groups/routers could be just `const router = { users: { get: getUserProcedure }  }` and everything remains type-safe
  + for more complex stuff, or if type performance is reached, we can explore further
- Zagora does support injecting typed/runtime "context" to procedures, if/when needed.
- The whole error system across Zagora is build around typed error objects, never Errors.
  + meaning, even if your handler fail with syntax error - you'll get ZagoraResult with error in it
  + it also gives absolute guarantees for never crashing the process, total predictability and type-safety
  + error determinism - if there's ANY error at ANY level - you'll get `result.error`
- With Zagora, unlike `neverthrow`, you don't need any kind of "unwrapping" nor need to jump into too much functional programming - you always have either the "ok result" or the "error result".
- With Zagora, unlike `Effect.ts`, you don't need to learn a whole other mindset or kind of a language
  + please, just check out `ReScript Lang` before even considering `Effect.ts` - it's far better, compiles to efficient TypeScript, and you'd have to learn NOTHING new other than TypeScript
- Zagora does not have the concept of "middlewares" - that should and can be outside
  + use some type-safe middlware/plugins processing library, i believe there are few - like `use` and `useware` are just one oldschool example
  + process "middleware" stuff, then provide the final result to the procedure's `.callable` method
  + i tried adding `.use`, but once i realize all the possible scenarios with all the rest of more important features, it got too complex too fast, especially on type-system level, **I am open tho**
  
Funny enough, you can use Zagora to build fully type-safe CLIs with auto-generated detailed help, based on the provided schemas. I have another library for that, which i will overhaul soon - [zodest](https://npmjs.com/package/zodest).

[Back to top](#table-of-contents)

### Why Zagora over plain TypeScript functions?

- Plain TypeScript offers compile-time types but no runtime validation — a mismatch between runtime and
  compile-time can blow up.
- Zagora combines runtime validation/transforms (StandardSchema) with full compile-time inference, and returns a safe, uniform result tuple inspired by true functional programming

[Back to top](#table-of-contents)

### Why Zagora over standalone Zod/Valibot usage?

- zagora gives a small ergonomic layer
- fluent and intutive builder pattern
- supports omitted trailing args via schema defaults
- supports passing multiple arguments in form of schema tuples
- handler gets fully populated args (defaults applied) at runtime
- single place to validate inputs/outputs/errors
- unified non-throwing result shape

[Back to top](#table-of-contents)

## Features

### Type-Safe Input/Output Validation

Zagora uses StandardSchema-compliant libraries (Zod, Valibot, Arktype, etc.) for input and out validation:

```ts
const procedure = zagora()
  .input(z.object({ name: z.string(), age: z.number().min(0).default(10) }))
  .output(z.object({ id: z.string(), age: z.number(), verified: z.boolean() }))
  .handler((_, input) => {
    // input is fully typed: { name: string, age: number }
    // NOTE: how `age` is typed as `number` and not `number | undefined`
    return { id: '123', age: input.age, verified: input.age >= 18 };
  })
  .callable();
 
// NOTE: you don't need to pass `age` because it has a default value set in schema.
const result = procedure({ name: 'John' });
if (result.ok) {
  console.log(result.data);
  // ^ { id: string, age: number, verified: boolean }
}

// @ts-expect-error -- this will be reported at compile-time, AND error at runtime.
const res2 = procedure('foobar');
if (!res2.ok) {
  console.error(res2.error);
  // ^ { kind: 'VALIDATION_ERROR', message: string, issues: Schema.Issue[] }
}

// note: this will error at runtime - age is no valid schema defined number
const resul3 = procedure({ name: 'Barry', age: -5 });
if (!resul3.ok) {
  console.error(resul3.error);
  // ^ { kind: 'VALIDATION_ERROR', message: string, issues: Schema.Issue[] }
}
```

[Back to top](#table-of-contents)

### Typed Errors

Define custom error types with schemas for better error handling.

**Important:** All error map keys must be uppercased, otherwise TypeScript will report you a type-error. These keys represent the error types, or "kinds", and are later available at the `result.error.kind` property.

```ts
const procedure = zagora()
  .input(z.string())
  .output(z.string())
  .errors({
    NOT_FOUND: z.object({ resource: z.string() }),
    UNAUTHORIZED: z.object({ userId: z.string() })
  })
  .handler(({ errors }, id) => {
    if (id === 'invalid') {
      throw errors.NOT_FOUND({ resource: 'user' });
    }
    return `User ${id}`;
  })
  .callable();

const result = procedure('invalid');
// result.error is typed as NOT_FOUND | UNAUTHORIZED | VALIDATION_ERROR | UNKNOWN_ERROR
if (!result.ok && result.error.kind === 'NOT_FOUND') {
  console.log(result.error);
  // ^ { kind: 'NOT_FOUND', resource: 'user', isTypedError: true }
}

const id = 'foobie'
const res = procedure(id);
if (res.ok) {
  console.log(res);
  // ^ { ok: true, data: 'User foobie'  }
}
```

[Back to top](#table-of-contents)

### Error Type Guards
Isn't it amazing? You will never see `Error` or `try/catch` blocks again, and everything is typed top to bottom, well-known and intuitive.

But wait, there's more: **Type Guards**!

### Error Type Guards

Since you may want to differentiate between the error kinds, there are couple of helper type guards that you can use to narrow down the error.

Demo calculator below to see it in action.

```ts
import { 
  isValidationError,
  isInternalError,
  isDefinedError,
  isZagoraError,
} from 'zagora/errors';

const za = zagora({ autoCallable: true, disableOptions: true });

/**
 * Adds two numbers.
 * @param a The first number.
 * @param b The second number.
 * @returns ZagoraResult<string>
 */
export const add = za
  .input(z.tuple([z.number(), z.number()]))
  .output(z.string())
  .handler((a, b) => `a + b = ${a + b}` );

/**
 * Subtracts the second number from the first.
 * @param a The first number.
 * @param b The second number to subtract.
 * @returns ZagoraResult<string>
 */
export const sub = za
  .input(z.tuple([z.number(), z.number()]))
  .output(z.string())
  .handler((a, b) => `a - b = ${a - b}` );

/**
 * Divides the first number by the second.
 * Throws an error if the divisor is 0.
 * @param a The numerator.
 * @param b The denominator.
 * @returns ZagoraResult<string>
 */
export const div = zagora({ autoCallable: true })
  .input(z.tuple([z.number(), z.number()])) 
  .output(z.string())
  .errors({
    DIVIDE_BY_ZERO: z.object({ a: z.number(), b: z.number(), msg: z.string() })
  })
  .handler(({ errors }, a, b) => {
    if (b === 0) {
      throw errors.DIVIDE_BY_ZERO({
        a,
        b,
        msg: 'Cannot divide by zero',
      });
    }
    
    return `a / b = ${a / b}`;
  });

// --- Examples ---
console.log(add(5, 3)); // => '5 + 3 = 8'
console.log(sub(10, 4)); // => '10 - 4 = 6'
console.log(div(10, 2)); // => '10 / 2 = 5'

const divRes = div(7, 'foo');
const divResult = div(7, 0);

if (!divResult.ok && isDefinedError(divResult.error)) {
  console.log('err:', divResult.error);
  // ^ { kind: 'DIVIDE_BY_ZERO', a, b, msg }
}

if (!divResult.ok && isValidationError(divResult.error)) {
  console.log('validation err:', divResult.error);
  // ^ { kind: 'VALIDATION_ERROR', message: string, issues: Schema.Issue[] }
}
```

What's even funnier is that you actually have validation on the error objects you pass to the error helper. For example, if in the case above you thrown `throw errors.DIVIDE_BY_ZERO({ a: 1, foo })` you will actually get a `VALIDATION_ERROR` with a `key` property telling WHICH error validation failed and why - because `b` is required and missing, eg. the error object will be something like `{ kind: 'VALIDATION_ERROR', key: 'DIVIDE_BY_ZERO', message, issues }`

This is unmatched and unparalleled granularity and type-safety. Another one of the killer Zagora features. You will get both compile-time and runtime errors at every and any level you can imagine.

Here is a basic example of passing invalid/missing keys to the generated error helpers:

```ts
const hello = zagora()
  .errors({
    RATE_LIMIT: z.object({
      userId: z.string(),
      retryAfter: z.number(),
      limit: z.number().default(1000), // note: it will not be required to be passed!
      message: z.string(),
    }),
  })
  .input(z.string())
  .handler(({ errors }, input) => {
    if (input === 'missing-required-keys') {
      // NOTE: TypeScript WILL report type-error for the missing keys
      throw errors.RATE_LIMIT({ retryAfter: 120 })
    }
    if (input === 'invalid-keys') {
      const userId = crypto.randomUUID();
      throw errors.RATE_LIMIT({ 
        message: `User with id "${userId}" is limited temporarily`
        userId,
        retryAfter: 'invalid', // NOTE: expects number, TypeScript will report type-error
      });
    }
    
    return input;
  });

hello('ok');
// => ZagoraResult OK

hello('missing-required-keys');
// result.error => { kind: 'VALIDATION_ERROR', key: 'RATE_LIMIT', issues: Schema.Issue[] }
// result.error.issues - will contain the issue that `userId` and `messatge` are required

hello('invalid-keys');
// result.error => { kind: 'VALIDATION_ERROR', key: 'RATE_LIMIT', issues: Schema.Issue[] }
// result.error.issues - will contain the issue that `retryAfter` is expected to be number
```

**Important:** if you want the error validation to actually throw on unknown keys passed to the error helper, then you need to make the error object schema more strict - just like `z.object(...).strict()`.

[Back to top](#table-of-contents)

### Context Management

In some advanced scenarios, you may need to pass runtime context to handlers, like `req`, `db`, `user`, sessions, and other dependencies. It's fully typed dependency injection mechanism.

You may or may not provide initial context that will be merged with the context you provide through `.callable({ context })`.

Providing context (and cache for that matter) can be done through the `.callable` method - that's useful for passing it from "execution place", not where you "define" your procedures. Such place is like server `Request/Response` (fetch API) handler.

```ts
const procedure = zagora()
  .context<{ userId: string, foo?: string }>({ userId: 'default' })
  .input(z.string())
  .handler(({ context }, id) => {
    // context is typed
    return `${context.userId} has foo -> ${context.foo || 'unknown'}, id = ${id}`
  })
  // NOTE: a) you will get intellisense here
  // NOTE: b) you can override context
  .callable({ context: { userId: 'foo-bar', foo: 'qux' } });

procedure('charlie');
// => 'foo-bar has foo -> qux, id = charlie'
```

[Back to top](#table-of-contents)

### Object Inputs

```ts
zagora()
  .input(z.object({ name: z.string(), age: z.number().default(18) }))
  .handler((_, { name, age }) => `${name} is ${age}`)
  .callable()
```

[Back to top](#table-of-contents)

### Tuple Inputs (Multiple Arguments)

Tuple schemas is used for defining multiple arguments in a handler. It's one of the ABSOLUTE KEY features of Zagora, and it is one of the most complex stuff to achieve - but the end results is astonishing. It just works - you define schema and you get fully typed and validated arguments, INCLUDING per-argument reporting/diagnostics, INCLUDING filling defaults if `.default()` is used and respecting `.optional()`.

```ts
// NOTE: ignore that for now, we'll get to it later
const za = zagora({ autoCallable: true, disableOptions: true })

const fnOne = za
  .input(z.tuple([z.string(), z.number()]))
  .handler((name, age) => {
    // name: string
    // age: number
    return `${name} is ${age}`
  })

const fnTwo = za
  .input(z.tuple([z.string(), z.number().default(18), z.string().optional()]))
  .handler((name, age, country) => {
    // name: string
    // age: number <-- because there is a default value in schema!
    // country: string | undefined <-- because it's marked as optional in schema!
    return `${name} is ${age}, from ${country || 'unknown'}`
  })

fnOne('John', 30);
// => John is 30

// @ts-expect-error -- reported at compile-time AND runtime, invalid second argument
fnOne('John', 'foo');

// @ts-expect-error -- reported at compile-time AND runtime, missing required second argument
fnOne('John');

// NOTE: fine, because second and third arguments are optional
fnTwo('Barry') // => Barry is 18, from unknown

fnTwo('Barry', 25) // => Barry is 25, from unknown
fnTwo('Barry', 33, 'USA') // => Barry is 33, from USA
```

[Back to top](#table-of-contents)

### Default Values

Optionals and default values are supported at any level with any schema, whether it's through the Tuple Args, or if it's primitive schema for `string`, `array`, or `object`.

```ts
const fn = zagora()
  .input(z.object({
    name: z.string(),
    age: z.number().default(18),
    country: z.string().optional()
  }))
  .handler((_, { name, age, country }) => `${name} is ${age}, from ${country || 'unknown'}`)
  .callable()
  
fn({ name: 'John' }) // age defaults to 18
// => 'John is 18, from unknown'
```

[Back to top](#table-of-contents)

### Async Support

Zagora is fully async-aware at every level of the system:

- **Sync Handler**: Procedure is sync -> returns `ZagoraResult`
- **Promise-returning handler**: handler returns a promise -> procedure is async -> `Promise<ZagoraResult>`
- **Async Handler**: Procedure is async -> returns `Promise<ZagoraResult>`
- **Sync/async Schemas**: Input/output/error validation can be async -> procedure becomes async
- **Sync/async Cache**: If any cache method is async -> procedure becomes async

**Important:** Due to StandardSchema limitation, if you provide async schema, the created procedure will be with synchronous signature, and will return a `ZagoraResult` object, instead of `Promise<ZagoraResult>`. That is because we cannot know on type-level whether the schema is async or not. So, make sure you always `await` at procedure callsite when you know the that any part of the schema is async! There is an opened issue in the StandardSchema issue tracker, we will see.

Funnily, ArkType does not support async schemas and it's incredibly fast, so using it you won't have that problem to begin with.

```ts
// Async handler
const asyncProc = zagora()
  .input(z.string())
  .handler(async (_, input) => {
    await someAsyncWork();
    return input.toUpperCase();
  })
  .callable();

// TypeScript WILL NOT complain and correctly infer Promise<ZagoraResult>
// because the handler is marked as `async`
const result = await asyncProc('hello'); // Promise<Result>

const syncHandlerPromiseProc = zagora()
  .input(z.string())
  .handler((_, input) => {
    return Promise.resolve(input.toUpperCase());
  })
  .callable();

// TypeScript WILL NOT complain and correctly infer Promise<ZagoraResult>
// because the handler in reality is async, eg. returns a Promise.
const promiseRes = await syncHandlerPromiseProc('hello'); // Promise<Result>

const procAsyncInput = zagora()
  // Async input schema
  .input(z.string().refine(async (val) => val.length > 10))
  .handler((_, input) => input)
  .callable();

// NOTE: TypeScript will REPORT as warning that you may not need `await` but you do,
// because async schemas force the handler to become async
const result2 = await procAsyncInput('hello'); // ZagoraResult

const procAsyncOutput = zagora()
  // Async output schema
  .input(z.string())
  .output(z.string().refine(async (val) => val.length > 10))
  .handler((_, input) => input)
  .callable();

// NOTE: TypeScript will REPORT as warning that you may not need `await` but you do,
// because async schemas force the handler to become async
const result2 = await procAsyncOutput('hello'); // ZagoraResult
```

[Back to top](#table-of-contents)

### Caching/Memoization

Built-in caching with custom cache adapter. Cache key includes the input, the input/output/error schemas, and handler function body. That can be used to implement custom caching strategies, and memoization.

**Couple of notes:**

- any method of the cache adapter can be async, and this will force the procedure to be async
- if cache method throws, the process never crash - you can find the error at the standard `result.error`
- failures in cache adapter will be reported as `UNKNOWN_ERROR` in `result.error` with `result.error.cause` set to the error thrown 
- in future this could change to be `CACHE_ERROR` with `cause`
- when cache is passed through `.callable` - and has async methods, make sure to await the procedure and ignore the TypeScript warning that "you may not need await here" - you do need to await

```ts
const cache = new Map();

const procedure = zagora()
  // NOTE: you can either pass through `.cache` or through `.callable({ cache })`
  // .cache(cache)
  .input(z.string())
  // NOTE: the handler is NOT marked as async!
  .handler((_, input) => {
    // Expensive operation
    return input.toUpperCase();
  })
  .callable({ cache });

// First call executes handler
const result1 = procedure('hello');
// Second call returns cached result instantly
const result2 = procedure('hello');

const proc = zagora()
  .cache({
    async has(key: string) { return cache.has(key); },
    get(key: string) { return cache.get(key); },
    set(key: string, value: unknown) { cache.set(key, value); }
  })
  .input(z.number().default(10))
  .handler((_, num) => num * 2)
  .callable();

// TypeScript will warn you if you do not `await` here,
// because the `has` method of the cache adapter is async,
// thus the whole procedure becomes asynchronous.
const res = await proc(22);
```

You can also provide the cache through `.callable({ cache })`. That is useful, if you want to provide it at "execution place", not at "definition place". For example, you'd have a set of procedures written at one place, then throgh "router" or some object that combiens them you want to call them at a `Request/Response` server handler.

[Back to top](#table-of-contents)

### Environment Variables

You can provide the runtime env vars (either `process.env` or `import.meta.env`) through the second argument of `.env(schema, envs)` or at later stage through the `.callable({ env })` call. Either way, they will be validated. The parsed variables will be accessible through the handler's `options` object.

```ts
const zaWithEnv = zagora()
  .env(z.object({
    DATABASE_URL: z.string().min(1).default('file://db.sqlite'),
    BETTER_AUTH_SECRET: z.string().min(1)
  }))
  .cache(new Map())

const fn1 = zaWithEnv
  .handler(({ env }) => {
    // env: { DATABASE_URL: string, BETTER_AUTH_SECRET: string }
  })
  .callable({ env: process.env })
````

Keep in mind that if you have `autoCallable: true` enabled in the instance, then you may need to provide the runtime env vars through the second argument, otherwise the types will say you have something, but in runtime you will get error.

Also important to note that when `disableOptions` you will loose access to the `env` vars, as well `context` and `errors` which is normal behavior.

[Back to top](#table-of-contents)

### Handler Options Object

Handlers receive an `options` (or "config") object as the first parameter containing:

- `context`: The typed & merged context (initial + runtime)
- `errors`: Constructed error helpers (if errors map schemas are defined)
- `env`: Parsed and validated environment variables (if env schema provided)

```ts
const procedure = zagora()
  .context({ user: 'bobby' })
  .errors({ NOT_FOUND: z.object({ id: z.string() }) })
  .input(z.string())
  .env(z.object({
    DATABASE_URL: z.string().min(1).default('file://db.sqlite'),
    AUTH_SECRET: z.string().min(1),
    PORT: z.coerce.number(), // env.PORT type will be number
  }), process.env)
  .handler((options, userId) => {
    const { context, errors, env } = options;
    // context: { user: 'bobby', id: 123 }
    // errors: { NOT_FOUND: (data) => throw { kind: 'NOT_FOUND', ...data } }
    // env: { DATABASE_URL: string, AUTH_SECRET: string, PORT: number }
    
    if (context.user !== 'bobby') {
      throw errors.NOT_FOUND({ id: userId });
    }
    return 'bobby found';
  })
  .callable({ context: { user: 'bobby ' }});

procedure('bob-id-123');
```

Use `disableOptions: true` to make the options object be omitted from the handler arguments:

```ts
zagora({ disableOptions: true })
  .input(z.string())
  .handler((userId) => userId); // No options
```

[Back to top](#table-of-contents)

### Auto-Callable Mode

Skip the need for `.callable()` call and get the procedure function directly:

```ts
const zagoraInstance = zagora()
  .input(z.string())
  .handler((_, input) => input);

const procedure = zagoraInstance.callable();
procedure('foo'); // ZagoraResult => 'foo'

const hello = zagora({ autoCallable: true, disableOptions: true })
  .input(z.string())
  .handler((name) => `Hello, ${name.toUpperCase()}`);

hello('bob'); // ZagoraResult => 'Hello, BOB'
hello('alice'); // ZagoraResult => 'Hello, ALICE'
```

[Back to top](#table-of-contents)

### Never-Throwing Guarantees

Zagora ensures functions never throw - all errors are wrapped in the `Result` object:

- Validation errors - `VALIDATION_ERROR`
- Handler errors (typed or untyped) - `UNKNOWN_ERROR` or user-defined typed error kind
- Cache adapter errors - `UNKNOWN_ERROR` with `cause` holding the original cache error

```ts
const procedure = zagora()
  .handler(() => { throw new Error('Oops'); })
  .callable();

const result = procedure();
// result.ok === false
// result.error.kind === 'UNKNOWN_ERROR'
// result.error.cause instanceof Error
// result.error.cause.message === 'Oops'
```

[Back to top](#table-of-contents)

### Type Safety Guarantees

Full TypeScript support with type inference:

- `result.ok` - `true` if the procedure was successful, `false` otherwise
- `result.data` - typed as the output schema or inferred from the handler return type
- `result.error` - discriminated union of all possible errors

And because the type system of Zagora is pretty complex, we also have tests not only for the implementation and the code, but ALSO the type-system and most of the types. This guarantees robust type-system, type-safety, and type-compatibility across changes. It's just impossible to break, since any minimal change to the behavior of the type system will be caught by the type-testing.

If you are interested, you can inspect the [test/types-testing.test.ts](./test/types-testing.test.ts) file.

[Back to top](#table-of-contents)

## API Reference

### `zagora(config?)`

Creates a new Zagora instance.

**Config**:
- `disableOptions?: boolean` - Omit options from handler, default `false`
- `autoCallable?: boolean` - Return callable directly from `.handler()` call, default `false`

### Instance Methods

- `.input(schema)` - Set input validation schema
- `.output(schema)` - Set output validation schema  
- `.errors(Record<string, schema>)` - Define typed errors
- `.context<TInitialContext>(initialContext)` - Type the context with generic, and optionally set initial context
- `.cache(adapter)` - Set cache adapter that should have `has`, `get`, `set`, methods
- `.handler(fn)` - Set handler/procedure function
- `.env(schema, processEnv?)` - Set env vars schema, and optionally runtime envs.
- `.callable(opts?: { context?, cache?, env? })` - Create callable procedure
  + passed `context` (if any) will be deep-merged with the `initialContext` (if any)
  + if `cache` passed, it will override the previously passed through `.cache` method (if so)
  + if `env` passed, it will be deep-merged with the provided through the `.env` method (if so)

[Back to top](#table-of-contents)

## Error Types

- `VALIDATION_ERROR` kind - Schema validation failures
- `UNKNOWN_ERROR` kind - When any unexpected error is thrown or promise rejects, with `cause` property
- User-defined kinds - Custom and typed errors, defined through schemas

## ZagoraResult Type

I wish it was as easy as just the below.. but roughly, yeah, it looks like this.

```ts
type ZagoraResult<TData, TError> = 
  | { ok: true; data: TData; error: undefined }
  | { ok: false; error: TError; isTypedError: boolean }
```

and of course, for async stuff, it's wrapped with Promise.

```ts
Promise<ZagoraResult>
````

If you are interested, you can check out the [src/types.ts](./src/types.ts) and [src/is-promise.ts](./src/is-promise.ts) files which are the core of the type-system of Zagora.

---

## License

Released under the Apache-2.0 License.
