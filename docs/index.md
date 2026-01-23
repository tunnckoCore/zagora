---
layout: home

hero:
  name: "Zagora"
  text: "Building robust enhanced functions and APIs"
  # tagline: Type-safe functions with full inference, typed errors, and zero async overhead -- just pure TypeScript. Skip the complexity of RPC frameworks or Effect.ts and build libraries and APIs, the Robust Way™
  actions:
    - theme: brand
      text: Get Started
      link: /docs/getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/tunnckoCore/zagora/tree/feat/docs
    - theme: alt
      text: Agents Ready
      link: https://zagora.wgw.lol/llms-full.txt

features:
  - title: 🛡️ Unmatched Robustness
    details: Zagora achieves <strong>100% test coverage</strong> with dedicated type tests ensuring compile-time and runtime alignment. This provides unmatched guarantees that your procedures are reliable and bug-free in production.
  - title: 🪶 Minimal & Standards-Based
    details: Built on <strong>StandardSchema</strong> with zero dependencies, Zagora works seamlessly with your favorite validators like <strong>Zod</strong>, <strong>Valibot</strong>, or <strong>ArkType</strong>. No lock-in, just the tools you already love and use.
  - title: 🚫 Never-Throwing Execution
    details: Every procedure returns a predictable <code>{ ok, data, error }</code> result, completely eliminating exceptions and crashes. Your process stays stable, similar to libraries like Effect.ts or neverthrow.
  - title: 🎯 Typed Errors System
    details: Define error schemas upfront for strongly-typed error helpers in handlers and typed responses for consumers. Say goodbye to <code>try/catch</code> blocks and guessing error shapes.
  - title: 🔍 Full Type Inference
    details: Complete TypeScript inference across inputs, outputs, errors, context, defaults, and optionals. Even JavaScript users get full IntelliSense and autocomplete support.
  - title: 📋 Multiple Arguments Support
    details: Use schema tuples to define multiple arguments with per-argument validation, enabling natural calls like <code>fn('Alice', 25)</code>. No more wrapping in objects for simple functions.
  - title: ⚡ Granular Diagnostics
    details: Get compile-time feedback on argument mismatches directly in your IDE or CLI. This catches potential errors before runtime, improving productivity and code quality.
  - title: 🔄 Sync & Async Awareness
    details: Zagora dynamically infers sync or async behavior based on your handlers—sync procedures return <code>Result</code>, async ones return <code>Promise&lt;Result&gt;</code>. Unlike oRPC/tRPC, nothing is forced async.
  - title: 💾 Built-in Caching
    details: Add memoization to any procedure with a simple cache adapter. Cache keys intelligently include inputs, schemas, and handler body for smart invalidation.
  - title: ✨ Just Pure Functions
    details: Zagora produces regular TypeScript functions—no special clients, routers, or network layers required. Export and call them like any other function, perfect for libraries and tooling.
  - title: 🌍 Env Vars Validation
    details: Validate environment variables with the same schema system as inputs and outputs. Get type-safe access to <code>process.env</code> with coercion, defaults, and full validation.
  - title: 🎁 No Unwrapping Required
    details: Directly access <code>result.data</code> or <code>result.error</code> without <code>.unwrap()</code>, <code>.map()</code>, or monadic chains. The discriminated union guides you naturally with TypeScript narrowing.
---

## Quick Example

```ts
import { z } from "zod";
import { zagora } from "zagora";

const getUser = zagora()
  .input(z.tuple([z.string(), z.number().default(18), z.string().optional()]))
  .handler((_, name, age, state) => {
    // name: string
    // age: number NOT `number | undefined`
    // state: string | undefined
    return `${name} is ${age}, from ${state || "unknown"}`;
  })
  .callable();

getUser("John", 30);
// => John is 30

// invalid second argument
// @ts-expect-error -- reported at compile-time AND runtime
getUser("John", "foo");

// missing required argument
// @ts-expect-error -- reported at compile-time AND runtime
getUser();

// NOTE: fine, because 2nd && 3rd arg are optional
getUser("Barry"); // => Barry is 18, from unknown

getUser("Barry", 25); // => Barry is 25, from unknown
getUser("Barry", 33, "USA"); // => Barry is 33, from USA

const result = await getUser("Alice");
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

## Learn More

Curious how Zagora compares to other solutions? Check out our detailed comparisons:

- [**vs oRPC / tRPC**](/comparisons/rpc-frameworks) - When to use Zagora vs RPC frameworks
- [**vs neverthrow / Effect.ts**](/comparisons/functional-libraries) - Error handling approaches compared
- [**vs Plain TypeScript**](/comparisons/plain-typescript) - Why add Zagora to your stack
- [**vs Standalone Validators**](/comparisons/standalone-validators) - Beyond just Zod/Valibot

Need routers, middleware, or HTTP integration? Zagora makes it easy - see [Building Routers](/advanced/building-routers) for patterns.
