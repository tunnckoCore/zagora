---
description: "Builder API reference. The `ZagoraBuilder` provides a fluent API for defining procedures."
head:
  - - meta
    - property: og:description
      content: "Builder API reference. The `ZagoraBuilder` provides a fluent API for defining procedures."
---

# Instance Methods


The `ZagoraBuilder` provides a fluent API for defining procedures.

## .input(schema)

Define the input validation schema.

```ts
.input(z.string())
.input(z.object({ name: z.string() }))
.input(z.tuple([z.string(), z.number()]))
.input(z.array(z.number()))
```

**Parameter:** Any StandardSchema-compliant schema  
**Returns:** `ZagoraBuilder` (chainable)

### Tuple Spreading

Tuple inputs are spread as handler arguments:

```ts
.input(z.tuple([z.string(), z.number()]))
.handler((_, name, age) => { /* name: string, age: number */ })
```

## .output(schema)

Define the output validation schema.

```ts
.output(z.string())
.output(z.number())
.output(z.array(z.string()))
.output(z.object({ id: z.string(), name: z.string() }))
```

**Parameter:** Any StandardSchema-compliant schema  
**Returns:** `ZagoraBuilder` (chainable)

Output is validated after the handler returns.

## .errors(Record<string, schema>)

Define typed error schemas.

```ts
.errors({
  NOT_FOUND: z.object({ id: z.string() }),
  FORBIDDEN: z.object({ reason: z.string() })
})
```

**Parameter:** Object mapping UPPERCASE error kinds to schemas  
**Returns:** `ZagoraBuilder` (chainable)

The handler receives typed error helpers:

```ts
.handler(({ errors }) => {
  throw errors.NOT_FOUND({ id: '123' });
})
```

## .context(initial)

Set initial context values.

```ts
.context({ db: myDatabase, logger: console })
```

**Parameter:** Object with initial context values  
**Returns:** `ZagoraBuilder` (chainable)

Context is merged with runtime context from `.callable()`.

```ts
.context({ db: myDatabase, logger: console })
.handler(({ context }) => {
  // ^ context => { db, logger, foo }
  context.logger.info(context.db) // => db
  context.logger.info(context.foo) // => bar
})
.callable({ context: { foo: 'bar' } })
```

## .env(schema, processEnv?)

Define environment variable schema.

```ts
zagora()
  .env(z.object({
    API_KEY: z.string(),
    TIMEOUT: z.coerce.number().default(5000)
  }))
```

**Parameters:**
- `schema` - StandardSchema for env vars
- `processEnv` (optional) - Runtime env vars (useful when `autoCallable` mode enabled)

**Returns:** `ZagoraBuilder` (chainable)

With autoCallable:

```ts
zagora({ autoCallable: true })
  .env(schema, process.env as any)
```

## .cache(adapter)

Set cache adapter for memoization.

```ts
.cache(new Map())
.cache(redisAdapter)
```

**Parameter:** Object with `has`, `get`, `set` methods  
**Returns:** `ZagoraBuilder` (chainable)

Cache interface:

```ts
interface CacheAdapter<K, V> {
  has(key: K): boolean | Promise<boolean>;
  get(key: K): V | undefined | Promise<V | undefined>;
  set(key: K, value: V): void | Promise<void>;
}
```

:::warning
**NOTE:** if any of the methods is async, then the procedure must be `await`-ed!
:::

## .handler(fn)

Define the procedure/handler function. It could be synchronous or async.

```ts
// With options
.handler((options, input) => {
  const { context, errors, env } = options;
  return result;
})

// With tuple input
.handler((options, arg1, arg2) => arg1 + arg2)

// With disableOptions
.handler((input) => input.toUpperCase())
```

**Parameter:** Handler function  
**Returns:** `ZagoraBuilder` (chainable) or callable function (if `autoCallable`)

### Handler Signature

Standard mode:
```ts
(options: { context, errors?, env? }, ...inputs) => Result
```

With `disableOptions`:
```ts
(...inputs) => Result
```

## .callable(options?)

Create the callable function.

```ts
.callable()
.callable({ context: { db: testDb } })
.callable({ cache: requestCache })
.callable({ env: process.env as any })
```

**Parameter (optional):** Runtime options
- `context` - Override/extend context
- `cache` - Override cache adapter
- `env` - Provide environment variables

**Returns:** Callable procedure function

:::wargning
**NOTE:** Make sure to use `process.env as any`, otherwise TypeScript will report because the passed `process.env` object is expected to not match your env schema!
:::

### Return Type

The returned function has signature:

```ts
(...inputs) => ZagoraResult<TOutput, TErrors>
// or if handler is async
(...inputs) => Promise<ZagoraResult<TOutput, TErrors>>
```

## Method Chaining

All methods return the builder, allowing fluent chaining:

```ts
const proc = zagora()
  .context({ db })
  .env(envSchema)
  .input(inputSchema)
  .output(outputSchema)
  .errors(errorsMap) // Record<string, schema>
  .cache(cache)
  .handler(handlerFn)
  .callable(runtimeOptions);
```

## Optional Methods

Only `.handler()` is required. All other methods are optional:

```ts
// Minimal procedure
const proc = zagora()
  .handler(() => 'Hello')
  .callable();
```

## See Also

- [zagora(config)](/api/zagora) - Create builder instance
- [Error Types](/api/error-types) - Error type reference
- [ZagoraResult Type](/api/result-type) - Result type reference
