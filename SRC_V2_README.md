# Zagora v2: Context & Middleware Implementation

This document explains the new context and middleware features added to Zagora in `src-v2/`.

## Overview

The v2 implementation extends Zagora with:
- **Context Support**: Type-safe context objects that flow through procedures
- **Middleware**: Chainable middleware for request enrichment, logging, auth, etc.
- **Three procedure types**: Basic (no context), Public (context, no middleware), Authenticated (context + middleware)

## Key Differences from v1

### v1 (Original)
```ts
const za = zagora();
const proc = za.input(schema).output(schema).handler((input) => {
  // Only receives input, no context
  return result;
});
```

### v2 (With Context)
```ts
// No context - same as v1
const basic = zagora()
  .input(z.string())
  .handler((input) => input.toUpperCase());

// With context, no middleware
const pub = zagora().$context<PublicContext>();
const proc = pub
  .input(schema)
  .handler(({ input, context }) => {
    // Receives input AND context
    return result;
  });

// With context AND middleware
const authed = zagora()
  .$context<AuthContext>()
  .use(authMiddleware)
  .use(loggingMiddleware);
const secure = authed
  .input(schema)
  .handler(({ input, context, errors }) => {
    // Context is enriched by middleware
    return result;
  });
```

## Core Concepts

### 1. Context Type Definition

Define your context interface:

```ts
interface Context {
  user?: User;
  requestId?: string;
  metadata?: Record<string, any>;
}
```

### 2. Creating Context-Aware Procedures

Use `$context<T>()` to enable context:

```ts
const pub = zagora().$context<Context>();
```

This creates a new Zagora instance where:
- The `handler()` receives `{ input, context, errors }` as a single object
- Input must be passed as `input` property
- Context is available but not yet enriched

### 3. Middleware

Middleware is a function that receives context and a `next()` function:

```ts
type Middleware<TContext> = (args: {
  context: TContext;
  next: (opts: { context: TContext }) => any;
}) => any;
```

Example middleware:

```ts
const authMiddleware = async ({ context, next }) => {
  // Enrich context with authenticated user
  const user = await validateToken(context.token);

  return next({
    context: {
      ...context,
      user,
    },
  });
};

const loggingMiddleware = async ({ context, next }) => {
  console.log("Request started:", context.requestId);
  const result = await next({ context });
  console.log("Request completed");
  return result;
};
```

### 4. Chaining Middleware

Use `.use()` to add middleware:

```ts
const authed = zagora()
  .$context<AuthContext>()
  .use(loggingMiddleware)      // Executes first
  .use(authMiddleware)          // Executes second
  .use(rateLimitMiddleware);    // Executes third
```

Middleware executes in order, each one's `next()` calls the next middleware. The final `next()` calls the handler.

### 5. Handler Signatures

The handler signature depends on context and errors:

**No context:**
```ts
.handler((input) => {
  return result;
});
```

**With context, no errors:**
```ts
.handler(({ input, context }) => {
  return result;
});
```

**With context and errors:**
```ts
.handler(({ input, context, errors }) => {
  // errors.ERROR_TYPE({ field: "value" }) to return typed error
  return result;
});
```

## Type System

The type system automatically adjusts based on what you enable:

```ts
// Basic procedure - handler gets single argument
const basic = zagora();
basic.input(z.string()).handler((input: string) => {
  // input is inferred as string
  return input;
});

// Context procedure - handler gets object
const ctx = zagora().$context<Context>();
ctx.input(z.string()).handler(({ input, context }) => {
  // input: string, context: Context
  return input;
});

// Context + errors - handler gets object with errors helper
const err = zagora()
  .$context<Context>()
  .input(z.string())
  .errors({ NOT_FOUND: z.object({ type: z.literal("NOT_FOUND") }) })
  .handler(({ input, context, errors }) => {
    // errors.NOT_FOUND({ ... }) available
    return input;
  });
```

## Implementation Details

### Immutability Through Spreading

Like v1, each method returns a new instance:

```ts
const authed = zagora()
  .$context<AuthContext>();       // New instance with contextType set
const withLogging = authed
  .use(loggingMiddleware);         // New instance with middleware added

// Original authed instance is unchanged
```

### Middleware Execution Flow

1. When handler is called with `{ input, context }` or `context`:
2. First middleware receives initial context
3. Each middleware calls `next({ context: enrichedContext })`
4. Final middleware's `next()` triggers the handler
5. Result is validated (if output schema defined) and returned

### Context vs. Input Handling

When context is enabled:
- `handler()` receives `{ input, context, errors }` object (always)
- If no input schema defined, `input: undefined`
- For tuple/array schemas, input is still wrapped in object

When context is NOT enabled:
- Handler receives arguments directly (same as v1)
- `input(z.string())` → handler receives `string`
- `input(z.tuple([...]))` → handler receives spread args
- Optional `errors` as last argument if errors schema defined

## File Structure

```
src-v2/
├── error.ts          # ZagoraError class (same as v1)
├── types.ts          # Type definitions for context and middleware
├── utils.ts          # Utility functions including executeMiddlewares()
└── index.ts          # Main Zagora class with new $context() and use() methods
```

### Key Type Additions

- `AnyContext`: Alias for `Record<string, any>`
- `Middleware<T>`: Middleware function type
- `MiddlewareNext<T>`: Next function type
- `HandlerArg<TInput, TContext, TErrors>`: Determines handler argument type
- `ZagoraDef` extended with `contextType` and `middlewares`

### Key Utility Additions

- `executeMiddlewares()`: Runs middleware chain and returns final context

## Examples

### Example 1: Basic Authentication

```ts
const authMiddleware = async ({ context, next }) => {
  const token = context.authToken;
  if (!token) {
    throw new Error("No auth token");
  }

  const user = await db.users.findByToken(token);
  return next({
    context: { ...context, user },
  });
};

const api = zagora()
  .$context<{ user: User; authToken: string }>()
  .use(authMiddleware);

const getUser = api
  .input(z.undefined().optional())
  .output(UserSchema)
  .handler(({ context }) => {
    return context.user; // user is guaranteed to exist
  });
```

### Example 2: Request Logging and Tracing

```ts
const tracingMiddleware = async ({ context, next }) => {
  const span = tracer.startSpan("request", {
    traceId: context.traceId,
  });

  try {
    return await next({ context });
  } finally {
    span.end();
  }
};

const api = zagora()
  .$context<{ traceId: string }>()
  .use(tracingMiddleware);
```

### Example 3: Rate Limiting

```ts
const rateLimitMiddleware = async ({ context, next }) => {
  const key = `rate:${context.userId}`;
  const count = await redis.incr(key);

  if (count > LIMIT) {
    return next({
      context: { ...context, rateLimited: true },
    });
  }

  await redis.expire(key, WINDOW_SECONDS);
  return next({ context });
};

const api = zagora()
  .$context<{ userId: string }>()
  .use(rateLimitMiddleware);
```

### Example 4: Multi-stage Middleware

```ts
const authed = zagora()
  .$context<AppContext>()
  .use(requestIdMiddleware)      // Add request ID
  .use(authMiddleware)            // Validate and add user
  .use(permissionMiddleware)      // Check permissions
  .use(loggingMiddleware);        // Log execution

const deleteUser = authed
  .input(z.object({ userId: z.string() }))
  .handler(({ input, context }) => {
    // context has requestId, user, permissions, all set up
    if (!context.permissions.includes("DELETE_USER")) {
      throw new Error("Insufficient permissions");
    }

    db.users.delete(input.userId);
  });
```

## Migration from v1

To use v2 alongside v1, import from `src-v2`:

```ts
// v1 - no changes needed
import { zagora as zagoraV1 } from './src/index';

// v2 - new features
import { zagora as zagoraV2 } from './src-v2/index';

// They can coexist and be used independently
```

## Important Notes

1. **Async Middleware**: All middleware is async and returns a Promise
2. **Context Immutability**: Middleware can create new context objects, the original isn't mutated
3. **Middleware Order Matters**: Middleware executes in the order added with `.use()`
4. **Type Safety**: Full type inference for context, input, output, and errors throughout the chain
5. **No Breaking Changes to v1**: The original implementation remains unchanged
6. **Handler Behavior**: Context-enabled handlers always receive a single object, never spread arguments

## Architecture Benefits

- **Separation of Concerns**: Middleware handles cross-cutting concerns (auth, logging, etc.)
- **Type Safety**: TypeScript tracks context shape through middleware chain
- **Composability**: Middleware can be reused across different procedure chains
- **Immutability**: Each `.use()` returns a new instance, preventing accidental mutations
- **Chaining**: Natural builder pattern allows fluent API design
