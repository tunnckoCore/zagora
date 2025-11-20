# Zagora v2 - Implementation Summary

## What Was Built

A complete enhancement to the Zagora library adding **context** and **middleware** support while maintaining immutability and type safety.

## Key Features

### 1. Context Type Support

**New generic parameter:**

```typescript
class Zagora<
  TInputSchema,
  TOutputSchema,
  TErrorsSchema,
  TContext          // ← NEW
>
```

**Enabled via `.$context<T>()`:**

```typescript
const authed = zagora().$context<{ user: User; requestId: string }>();
```

### 2. Middleware System

**Middleware signature:**

```typescript
type Middleware<TContext> = (args: {
  context: TContext;
  next: (opts: { context: TContext }) => any;
}) => any;
```

**Added via `.use(middleware)`:**

```typescript
const authed = zagora()
  .$context<Context>()
  .use(authMiddleware)
  .use(loggingMiddleware);
```

### 3. Immutable Builder Pattern

**Spreading mechanism ensures each branch is independent:**
```typescript
input<TSchema>(schema: TSchema) {
  return new Zagora({
    ...this["~zagora"],      // ← Creates NEW object
    inputSchema: schema,
  });
}
```

**Why this matters:**
- Each method creates a **new instance** with a **new definition object**
- Sibling chains never interfere (no "meme" situation)
- TypeScript tracks the full type chain

### 4. Adaptive Handler Signatures

**Handler receives different arguments based on configuration:**

| Config | Handler Signature |
|--------|------------------|
| Basic | `(input) => ...` |
| With context | `({ input, context }) => ...` |
| With context + errors | `({ input, context, errors }) => ...` |
| With errors (no context) | `(input, errors) => ...` |

**Type system automatically determines signature:**
```typescript
type HandlerArg<TInput, TContext, TErrors> =
  TContext extends AnyContext
    ? { input: TInput; context: TContext; errors: TErrors }
    : TInput;  // Falls back to simple input
```

## Three Procedure Types

### Type 1: Basic (No Context)

```typescript
const basic = zagora();
const proc = basic
  .input(z.string())
  .handler((input) => input.toUpperCase());

await proc("hello");  // "HELLO"
```

**Handler receives:** Input directly (original Zagora behavior)

### Type 2: Public (Context, No Middleware)

```typescript
const pub = zagora().$context<PublicContext>();
const proc = pub
  .input(z.object({ name: z.string() }))
  .handler(({ input, context }) => {
    return `Hello ${input.name}`;
  });

await proc({
  input: { name: "Alice" },
  context: { requestId: "req-123" }
});
```

**Handler receives:** Object with `{ input, context, errors? }`

### Type 3: Authenticated (Context + Middleware)

```typescript
const authMiddleware = async ({ context, next }) => {
  const user = await validateToken(context.token);
  return next({ context: { ...context, user } });
};

const authed = zagora()
  .$context<AuthContext>()
  .use(authMiddleware);

const proc = authed
  .input(z.object({ id: z.string() }))
  .handler(({ input, context }) => {
    // context.user is enriched by middleware
    return { userId: context.user.id };
  });

await proc({
  input: { id: "item-1" },
  context: { token: "abc123" }
});
```

**Handler receives:** Object with enriched context from middleware

## Type System Enhancements

### Context Type Flows Through Chain

```typescript
const authed = zagora().$context<AuthContext>();
// ↓ TContext = AuthContext

const withAuth = authed.use(authMiddleware);
// ↓ TContext = AuthContext (preserved!)

const proc = withAuth.input(z.string()).handler(({ input, context }) => {
  // context: AuthContext (fully typed!)
  return result;
});
```


## Middleware Execution

### Middleware Chain

When you call a procedure with middleware:

```typescript
const authed = zagora()
  .$context<Context>()
  .use(middleware1)
  .use(middleware2)
  .use(middleware3);

const proc = authed.input(...).handler(...);
```

**Execution flow:**
```
Call: proc({ input, context })
  ↓
middleware1 receives { context, next }
  ├─ Can modify context
  ├─ Calls next({ context: modifiedContext })
  ↓
middleware2 receives { context, next }
  ├─ Can modify context further
  ├─ Calls next({ context: modifiedContext })
  ↓
middleware3 receives { context, next }
  ├─ Can modify context further
  ├─ Calls next({ context: modifiedContext })
  ↓
HANDLER runs with fully enriched context
  ├─ Returns result
  ↓
Result bubbles back through middleware chain
  ↓
Final result returned to caller
```


## API Surface

### New Methods

#### `.$context<T>()`
- Enables context for the procedure
- Sets context type to T
- Initializes empty middleware array
- Must be called first in chain

#### `.use(middleware)`
- Adds middleware to execution chain
- Only works after `.$context()`
- Creates new instance with updated middlewares array
- Middlewares execute in order added

### Existing Methods (Enhanced)

#### `.input(schema)`
- Same behavior, now works with context
- When context enabled, input is passed as `input` property in handler object

#### `.output(schema)`
- Same behavior, now works with context
- Output validation still works the same way

#### `.errors(errorsMap)`
- Same behavior, now works with context
- Error helpers available in context handlers via `errors` property

#### `.handler(impl)`
- **NEW**: Handler signature adapts based on context
- Without context: original behavior (single argument)
- With context: receives `{ input, context, errors }` object
- Full type inference for all properties

## Return Values

All handlers return a typed result tuple:

```typescript
type Result = [data, error, isDefined];

// Accessible as array
const [data, error, isDefined] = await proc(...);

// Accessible as properties
const { data, error, isDefined } = await proc(...);

// Semantics:
// isDefined = true → error is a typed error
// isDefined = false + error exists → untyped error
// isDefined = false + error null → success
```


## Backwards Compatibility

### v1 Code Works Unchanged

```typescript
import { zagora } from './src/index';  // Original

const proc = zagora()
  .input(z.string())
  .handler(input => input.toUpperCase());

await proc("hello");  // Still works!
```

### v2 Features Are Opt-In

```typescript
import { zagora } from './src-v2/index';  // New

const proc = zagora()
  .$context<Context>()           // ← Optional
  .use(middleware)               // ← Optional
  .input(z.string())
  .handler(({ input, context }) => input.toUpperCase());
```

### Coexistence

Both v1 and v2 can be used in the same project:

```typescript
import { zagora as zaV1 } from './src/index';
import { zagora as zaV2 } from './src-v2/index';

// Use v1 for simple cases
const simple = zaV1().input(z.string()).handler(input => ...);

// Use v2 for complex cases with context
const complex = zaV2()
  .$context<Context>()
  .use(middleware)
  .handler(({ input, context }) => ...);
```

## Type Safety Benefits

1. **Full context type tracking** through middleware chain
2. **Handler signature inference** based on configuration
3. **Input/output validation** at compile and runtime
4. **Error type discrimination** for typed errors
5. **No type casting needed** - all inferred automatically

## Error Handling

### Typed Errors

```typescript
const proc = zagora()
  .$context<Context>()
  .errors({
    NOT_FOUND: z.object({
      type: z.literal("NOT_FOUND"),
      id: z.string(),
    }),
    NOT_AUTH: z.object({
      type: z.literal("NOT_AUTH"),
    }),
  })
  .handler(({ context, errors }) => {
    if (!context.user) {
      return errors.NOT_AUTH({});
    }
    return errors.NOT_FOUND({ id: "123" });
  });

// Result discriminates error types
const result = await proc(...);
if (result.isDefined && result.error?.type === 'NOT_FOUND') {
  console.log(result.error.id);  // Type-safe!
}
```

## File Organization

### Implementation Files

- `src-v2/error.ts` - Error class (67 lines, unchanged from v1)
- `src-v2/types.ts` - Type definitions (220+ lines, all new)
- `src-v2/utils.ts` - Utilities (310+ lines, mostly unchanged from v1 + new executeMiddlewares())
- `src-v2/index.ts` - Main Zagora class (341 lines, enhanced with new methods)

### Documentation Files

- `SRC_V2_README.md` - Comprehensive feature documentation (363 lines)
- `SPREADING_EXPLAINED.md` - Deep technical explanation (384 lines)
- `QUICK_START.md` - Quick reference guide (358 lines)
- `IMPLEMENTATION_SUMMARY.md` - This file

### Example File

- `example-v2.ts` - Working code examples (211 lines)

## Testing the Implementation

See `example-v2.ts` for working examples of:
- Basic procedures (no context)
- Public procedures (context, no middleware)
- Authenticated procedures (context + middleware)
- Middleware stacking
- Error handling with typed errors
- Multi-stage middleware chains

## Key Design Decisions

1. **Spreading over mutations** → Prevents state mixing between sibling chains
2. **New generic parameter** → Preserves backwards compatibility while enabling context
3. **`.use()` returns new instance** → Maintains immutability pattern
4. **Middleware in arrays** → Allows stacking and execution order control
5. **Handler signature inference** → Reduces boilerplate and improves type safety
6. **Separate `src-v2` directory** → Allows parallel development and gradual migration
7. **Async middleware only** → Simplifies execution model, matches web standards
8. **Context always object** → Simplifies handler signature when context enabled

## Performance Considerations

1. **Spreading has minimal cost** - shallow copy of small definition objects
2. **Middleware execution** - sequential, no unnecessary async operations
3. **Type checking only at compile time** - no runtime type overhead
4. **Handler validation** - only happens when handler is called

## Future Enhancements

Potential areas for extension:
- Middleware composition helpers
- Built-in middleware (auth, logging, etc.)
- Context interceptors
- Request/response transformation
- Cache invalidation helpers
- Dependency injection support

## Summary

This implementation successfully adds context and middleware to Zagora while:
- ✅ Maintaining immutability through spreading
- ✅ Preserving full type safety
- ✅ Keeping backwards compatibility
- ✅ Following builder pattern conventions
- ✅ Enabling powerful middleware patterns (like tRPC/oRPC)
- ✅ Preventing the "state mixing" problem through independent definition objects

The spreading mechanism is the key - each method creates a new instance with a new definition object, ensuring sibling chains never interfere. This is why `za.input().output().handler()` and `za.input().output().handler()` don't mess with each other.
