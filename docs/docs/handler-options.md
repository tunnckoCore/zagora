---
description: "The options object reference. The handler's first argument is an options object containing context, errors, and other utilities."
head:
  - - meta
    - property: og:description
      content: "The options object reference. The handler's first argument is an options object containing context, errors, and other utilities."
---

# Handler Options


The handler's first argument is an options object containing context, errors, and other utilities.

## Options Structure

```ts
.handler((options, ...inputs) => {
  const { 
    context,  // Merged context object
    errors,   // Typed error helpers (if .errors() defined)
    env       // Validated environment variables (if .env() defined)
  } = options;
  
  // Your logic here
})
```

## context

The merged context from `.context()` and `.callable({ context })`:

```ts
const proc = zagora()
  .context({ db: myDb })
  .input(z.string())
  .handler(({ context }, id) => {
    return context.db.find(id);
  })
  .callable({ context: { logger: console } });

// Handler receives: { db: myDb, logger: console }
```

## errors

Typed error helper functions when `.errors()` is defined:

```ts
const proc = zagora()
  .errors({
    NOT_FOUND: z.object({ id: z.string() }),
    FORBIDDEN: z.object({ reason: z.string() })
  })
  .handler(({ errors }, id) => {
    throw errors.NOT_FOUND({ id });
    // or
    throw errors.FORBIDDEN({ reason: 'No access' });
  })
  .callable();
```

Each helper creates a throwable error that Zagora catches and returns as a typed result.

## env

Validated environment variables when `.env()` is defined:

```ts
const proc = zagora()
  .env(z.object({
    API_KEY: z.string(),
    TIMEOUT: z.coerce.number().default(5000)
  }))
  .handler(({ env }) => {
    console.log(env.API_KEY);   // string
    console.log(env.TIMEOUT);   // number
  })
  .callable({ env: process.env });
```

## Disabling Options

Use `disableOptions: true` to omit the options object entirely:

```ts
const add = zagora({ disableOptions: true })
  .input(z.tuple([z.number(), z.number()]))
  .handler((a, b) => a + b)  // No options object!
  .callable();
```

:::warning
When `disableOptions` is enabled, you cannot use:
- `context` (not accessible in handler)
- `errors` (not accessible in handler)  
- `env` (not accessible in handler)
:::

## Options with Different Input Types

### Object Input

```ts
.input(z.object({ name: z.string() }))
.handler((options, input) => {
  // input: { name: string }
})
```

### Tuple Input (Spread)

```ts
.input(z.tuple([z.string(), z.number()]))
.handler((options, name, age) => {
  // name: string, age: number
})
```

### Primitive Input

```ts
.input(z.string())
.handler((options, input) => {
  // input: string
})
```

### Array Input

```ts
.input(z.array(z.number()))
.handler((options, numbers) => {
  // numbers: number[]
})
```

### No Input

```ts
.handler((options) => {
  // No input arguments
})
```

## Pattern: Destructuring

Common pattern for cleaner handlers:

```ts
.handler(({ context, errors, env }, input) => {
  const { db, logger } = context;
  
  logger.info('Processing:', input);
  const result = db.query(input);
  
  if (!result) {
    throw errors.NOT_FOUND({ id: input });
  }
  
  return result;
})
```

## Next Steps

- [Context Management](/docs/context) - Deep dive into context
- [Environment Variables](/docs/env-vars) - Type-safe env vars
- [Auto-Callable Mode](/docs/auto-callable) - Simplified API
