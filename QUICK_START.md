# Zagora v2 - Quick Start Guide

## Three Procedure Types

### 1. Basic (No Context) - Same as Original

```ts
import { zagora } from './src-v2/index';
import z from 'zod';

const basic = zagora();

const uppercase = basic
  .input(z.string())
  .output(z.string())
  .handler((input) => input.toUpperCase());

// Call it
const result = await uppercase('hello');
console.log(result.data);  // "HELLO"
```

**Handler receives**: Single argument based on input schema

### 2. Public (Context, No Middleware)

```ts
interface PublicContext {
  requestId?: string;
}

const pub = zagora().$context<PublicContext>();

const getInfo = pub
  .input(z.object({ id: z.string() }))
  .output(z.object({ message: z.string() }))
  .handler(({ input, context }) => {
    return {
      message: `Processing ${input.id} with request ${context.requestId}`
    };
  });

// Call it
const result = await getInfo({
  input: { id: '123' },
  context: { requestId: 'req-456' }
});
console.log(result.data);  // { message: "Processing 123 with request req-456" }
```

**Handler receives**: Object with `{ input, context, errors? }`

### 3. Authenticated (Context + Middleware)

```ts
interface User {
  id: string;
  email: string;
}

interface AuthContext {
  user?: User;
  token?: string;
}

// Define middleware
const authMiddleware = async ({ context, next }) => {
  // Validate token and get user
  const user = await db.users.findByToken(context.token);

  // Pass enriched context to next
  return next({
    context: { ...context, user }
  });
};

// Create authenticated procedures
const authed = zagora()
  .$context<AuthContext>()
  .use(authMiddleware);

const getProfile = authed
  .input(z.undefined().optional())
  .output(z.object({ id: z.string(), email: z.string() }))
  .handler(({ context }) => {
    // context.user is guaranteed to exist (validated by middleware)
    return context.user!;
  });

// Call it
const result = await getProfile({
  context: { token: 'abc123' }
});
console.log(result.data);  // { id: '...', email: '...' }
```

**Handler receives**: Object with `{ input, context, errors? }`

## Middleware Pattern

Every middleware must:
1. Receive `{ context, next }`
2. Optionally modify context
3. Call `next({ context: modifiedContext })`

```ts
const loggingMiddleware = async ({ context, next }) => {
  console.log('Start:', context.requestId);
  const result = await next({ context });
  console.log('End:', context.requestId);
  return result;
};

const rateLimitMiddleware = async ({ context, next }) => {
  const count = await redis.incr(`rate:${context.userId}`);
  if (count > LIMIT) {
    throw new Error('Rate limited');
  }
  return next({ context });
};

// Stack middleware
const api = zagora()
  .$context<AppContext>()
  .use(loggingMiddleware)
  .use(rateLimitMiddleware)
  .use(authMiddleware);
```

**Execution order**: Middleware runs in the order defined with `.use()`

## With Error Handling

```ts
const deleteUser = authed
  .input(z.object({ userId: z.string() }))
  .errors({
    NOT_AUTHORIZED: z.object({
      type: z.literal('NOT_AUTHORIZED'),
      message: z.string(),
    }),
    NOT_FOUND: z.object({
      type: z.literal('NOT_FOUND'),
      userId: z.string(),
    }),
  })
  .handler(({ input, context, errors }) => {
    if (!context.user) {
      return errors.NOT_AUTHORIZED({ message: 'Login required' });
    }

    if (!userExists(input.userId)) {
      return errors.NOT_FOUND({ userId: input.userId });
    }

    db.users.delete(input.userId);
    return { success: true };
  });

// Call it
const result = await deleteUser({
  input: { userId: '123' },
  context: { token: 'abc123' }
});

// Check result
if (result.isDefined) {
  // Typed error
  console.log(result.error.type);
} else if (result.error) {
  // Untyped error
  console.log(result.error.message);
} else {
  // Success
  console.log(result.data);
}
```

## Type Safety

Everything is fully type-safe:

```ts
// Context type flows through middleware
const api = zagora()
  .$context<{ user: User; requestId: string }>();

// Input/output are inferred from schemas
const proc = api
  .input(z.object({ name: z.string() }))
  .output(z.object({ id: z.number() }))
  .handler(({ input, context, errors }) => {
    // input.name: string
    // context.user: User
    // context.requestId: string
    return { id: 1 };
  });

// Handler call is type-checked
proc({
  input: { name: 'John' },           // Must have input
  context: { user: {...}, requestId: 'req-1' }  // Must have context
});
```

## Why Spreading?

Each method creates a **new instance** with a **new definition object**:

```ts
const za = zagora();
const proc1 = za.input(schemaA).output(outputA);
const proc2 = za.input(schemaB).output(outputB);

// proc1 and proc2 have DIFFERENT definition objects
// Updating proc2's definition doesn't affect proc1
// This is why they don't "mess the instance"
```

Without spreading, they'd share the same definition object and interfere with each other.

## Common Patterns

### Pattern: Role-Based Access

```ts
const requireRole = (requiredRole: string) => async ({ context, next }) => {
  if (!context.user?.roles.includes(requiredRole)) {
    throw new Error(`Requires ${requiredRole} role`);
  }
  return next({ context });
};

const admin = zagora()
  .$context<AuthContext>()
  .use(authMiddleware)
  .use(requireRole('admin'));

const deleteAnything = admin
  .input(z.object({ id: z.string() }))
  .handler(({ input, context }) => {
    // Only admins can reach here
    return { deleted: true };
  });
```

### Pattern: Request Tracing

```ts
const tracingMiddleware = async ({ context, next }) => {
  const traceId = context.traceId || crypto.randomUUID();
  context.traceId = traceId;

  console.log(`[${traceId}] Request started`);
  const result = await next({ context });
  console.log(`[${traceId}] Request ended`);

  return result;
};

const api = zagora()
  .$context<{ traceId?: string }>()
  .use(tracingMiddleware);
```

### Pattern: Database Transaction

```ts
const transactionMiddleware = async ({ context, next }) => {
  const tx = await db.transaction();

  try {
    const result = await next({ context: { ...context, db: tx } });
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

const withTx = zagora()
  .$context<{ db?: Transaction }>()
  .use(transactionMiddleware);
```

## Migration from v1

v1 code works unchanged:

```ts
// Old code - still works
import { zagora } from './src/index';  // Use original

const proc = zagora()
  .input(z.string())
  .handler(input => input.toUpperCase());
```

New features are opt-in:

```ts
// New code - use v2
import { zagora } from './src-v2/index';

const proc = zagora()
  .$context<Context>()
  .use(middleware);
```

Both can coexist!

## Key Differences: Handler Arguments

| Scenario | Handler Argument |
|----------|------------------|
| No context | `(input)` |
| With context | `({ input, context })` |
| With context + errors | `({ input, context, errors })` |
| No context + errors | `(input, errors)` |

## Result Structure

All handlers return a result tuple with properties:

```ts
const [data, error, isDefined] = await proc(...);

// Or access as properties
result.data;      // null or the actual data
result.error;     // null or the error object
result.isDefined; // true if error is a typed error, false for success

// Check for typed error
if (result.isDefined && result.error?.type === 'NOT_AUTHORIZED') {
  // Handle specific error
}

// Check for untyped error
if (result.error && !result.isDefined) {
  // Handle unexpected error
}

// Check for success
if (!result.error) {
  console.log(result.data);
}
```

## Files Overview

- `src-v2/index.ts` - Main Zagora class with `$context()` and `use()`
- `src-v2/types.ts` - Type definitions
- `src-v2/utils.ts` - Utilities including `executeMiddlewares()`
- `src-v2/error.ts` - Error handling
- `SRC_V2_README.md` - Comprehensive documentation
- `SPREADING_EXPLAINED.md` - Deep dive into why spreading works
- `example-v2.ts` - Full examples
