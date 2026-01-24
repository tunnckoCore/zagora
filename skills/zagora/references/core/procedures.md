# Procedures

Zagora uses a fluent builder API to define procedures. Each procedure encapsulates validation, error handling, and business logic.

## Builder API

Chain methods to configure your procedure:

```ts
const proc = zagora()
  .input(schema)      // Validate input arguments
  .output(schema)     // Validate return values
  .errors(errorsMap)  // Define custom error types, Record<string, schema>
  .context(context)   // Inject dependencies
  .env(envSchema)     // Validate environment variables
  .cache(cache)       // Add caching/memoization, or Redis
  .handler(handler)   // Define business logic
  .callable();        // Create callable function
```

## Calling Procedures

Just call the produced function like a regular function:

```ts
const add = zagora()
  .input(z.tuple([z.number(), z.number()]))
  .handler((_, a, b) => a + b)
  .callable();

const result = add(1, 2);
if (result.ok) {
  console.log(result.data); // 3
}
```

Provide context, env vars, cache at callsite (http handlers for example, through `.callable`):

```ts
const greetUser = zagora()
  .input(z.string())
  .handler(async ({ context }, user) => `Hello, ${user}, ${await context.db.getProfile(user)}`)
  .callable({ context: { db: prodDb } });

const result = await greetUser('alice');
```

## Handler Function

The handler receives options and input arguments:

```ts
.handler((options, ...inputs) => {
  const { context, errors, env } = options;
  // Business logic here
  return result;
})
```

### Options Object

- `context`: Merged context object from `.context()` and "runtime" provided through `.callable({ context })`
- `errors`: Typed error helper functions from `.errors()` defined schemas, like `.errors({ NOT_FOUND: z.object({ id: z.string() }) })`
- `env`: Validated environment variables from `.env(z.object({ DATABASE_URL: z.string().url() }), process.env as any)`

### Disabling Options

Omit the options object with `disableOptions: true`:

```ts
const add = zagora({ disableOptions: true })
  .input(z.tuple([z.number(), z.number()]))
  .handler((a, b) => a + b)
  .callable();
```

When disabled, you cannot access context, errors, or env in the handler.

The `options` object passed to handlers as first argument is useful to inject context/dependency to procedures, to get error helpers, or environment variables, see more at:

- [Context Management](../advanced/context-management.md): Pass shared dependencies
- [Caching & Memoization](../advanced/caching-memoization.md): Avoid redundant computations
- [Environment Variables](../advanced/environment-variables.md): Type-safe env var validation

### Handler Signatures

#### Object Input
```ts
.input(z.object({ name: z.string() }))
.handler((options, input) => {
  // input: { name: string }
})
```

#### Tuple Input (Spread multiple arguments)

Schema tuples are used to define a function/procedure with multiple arguments, the tuple types get spread into the handler arguments.

```ts
.input(z.tuple([z.string(), z.number()]))
.handler((options, name, age) => {
  // name: string, age: number
})
```

#### Primitive Input

Can handle strings, numbers, booleans, arrays, and etc.

```ts
// string
.input(z.string())
.handler((options, name) => { /* name: string */ })

// number
.input(z.number())
.handler((options, age) => { /* age: number */ })

// array of strings
.input(z.array(z.string()))
.handler((options, ids) => { /* ids: string[] */ })

// boolean
.input(z.boolean())
.handler((options, isValid) => { /* isValid: boolean */ })
```

#### No Input
```ts
.handler((options) => {
  // No input arguments
})
```

Use the builder API to create procedures that fit your needs. Combine with validation and error handling for robust code.
