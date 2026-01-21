---
description: "Guidelines for using Zagora effectively. These best practices help you get the most out of Zagora while avoiding common pitfalls."
head:
  - - meta
    - property: og:description
      content: "Guidelines for using Zagora effectively. These best practices help you get the most out of Zagora while avoiding common pitfalls."
---

# Best Practices


These best practices help you get the most out of Zagora while avoiding common pitfalls.

## Procedure Design

### Define Output Schemas for Public APIs

Always define output schemas for procedures that are part of your public API:

```ts
// Good - output is guaranteed
const getUser = zagora()
  .input(z.string())
  .output(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string()
  }))
  .handler((_, id) => db.findUser(id))
  .callable();

// Avoid - consumers don't know the shape
const getUser = zagora()
  .input(z.string())
  .handler((_, id) => db.findUser(id))
  .callable();
```

### Use Tuple Inputs for Natural APIs

Prefer tuple inputs for better developer experience:

```ts
// Good - natural function signature
const sendEmail = zagora()
  .input(z.tuple([z.string(), z.string(), z.string()]))
  .handler((_, to, subject, body) => /* ... */)
  .callable();

sendEmail('to@example.com', 'Subject', 'Body');

// Less ergonomic
const sendEmail = zagora()
  .input(z.object({ to: z.string(), subject: z.string(), body: z.string() }))
  .handler((_, input) => /* ... */)
  .callable();

sendEmail({ to: 'to@example.com', subject: 'Subject', body: 'Body' });
```

### Define All Error Cases Upfront

Enumerate all possible error cases:

```ts
const createUser = zagora()
  .input(userSchema)
  .errors({
    EMAIL_EXISTS: z.object({ email: z.string() }),
    INVALID_DOMAIN: z.object({ domain: z.string() }),
    RATE_LIMITED: z.object({ retryAfter: z.number() })
  })
  .handler(({ errors }, input) => {
    // Handle each case explicitly
  })
  .callable();
```

## Error Handling

### Always Handle Both Paths

Never ignore the error case:

```ts
// Good
const result = getUser(id);
if (result.ok) {
  return result.data;
} else {
  logger.error('Failed to get user', result.error);
  throw new HttpError(500);
}

// Bad - ignoring error case
const result = getUser(id);
return result.data;  // undefined if error!
```

### Use Error Type Guards

Narrow error types with guards:

```ts
import { isValidationError, isDefinedError } from 'zagora/errors';

if (!result.ok) {
  if (isValidationError(result.error)) {
    return { status: 400, body: { issues: result.error.issues } };
  }
  if (isDefinedError(result.error)) {
    return { status: 422, body: { code: result.error.kind } };
  }
  // Unknown error
  logger.error(result.error.cause);
  return { status: 500 };
}
```

### Create Error Handler Utilities

Centralize error handling:

```ts
function handleProcedureError(error: ZagoraError) {
  if (isValidationError(error)) {
    return { status: 400, code: 'VALIDATION_ERROR', issues: error.issues };
  }
  
  switch (error.kind) {
    case 'NOT_FOUND':
      return { status: 404, code: error.kind, ...error };
    case 'FORBIDDEN':
      return { status: 403, code: error.kind, ...error };
    default:
      logger.error('Unhandled error', error);
      return { status: 500, code: 'INTERNAL_ERROR' };
  }
}
```

## Context Management

### Use Context for Dependencies

Inject dependencies through context, not closures:

```ts
// Good - testable via context override
const getUser = zagora()
  .context({ db: defaultDb })
  .input(z.string())
  .handler(({ context }, id) => context.db.find(id))
  .callable();

// Test with mock
const testGetUser = getUser.callable({ context: { db: mockDb } });

// Avoid - hard to test
const db = productionDb;
const getUser = zagora()
  .input(z.string())
  .handler((_, id) => db.find(id))  // Closure over db
  .callable();
```

### Keep Context Focused

Don't put everything in context:

```ts
// Good - focused context
.context({ db, logger })

// Avoid - kitchen sink
.context({ db, logger, config, utils, helpers, constants, ... })
```

## Performance

### Use Caching Strategically

Cache expensive operations:

```ts
const expensiveQuery = zagora()
  .cache(new Map())  // Or Redis, etc.
  .input(z.string())
  .handler((_, query) => {
    // Expensive database aggregation
    return db.aggregate(query);
  })
  .callable();
```

### Prefer Sync When Possible

Don't make things async unnecessarily:

```ts
// Good - sync when possible
const validate = zagora()
  .input(z.string().email())
  .handler((_, email) => ({ valid: true, normalized: email.toLowerCase() }))
  .callable();

const result = validate(email);  // Immediate result

// Avoid - unnecessary async
const validate = zagora()
  .input(z.string().email())
  .handler(async (_, email) => ({ valid: true, normalized: email.toLowerCase() }))
  .callable();

const result = await validate(email);  // Forced to await
```

## Code Organization

### Group Related Procedures

Organize by domain:

```ts
// users/procedures.ts
export const createUser = zagora()...
export const getUser = zagora()...
export const updateUser = zagora()...

// posts/procedures.ts
export const createPost = zagora()...
export const getPost = zagora()...
```

### Create Reusable Instances

Share configuration:

```ts
// lib/zagora.ts
export const za = zagora({ autoCallable: true, disableOptions: true });

// Usage
import { za } from './lib/zagora';

export const validate = za.input(z.string()).handler((s) => s.trim());
```

## Testing

### Test All Code Paths

Cover success, validation errors, and custom errors:

```ts
describe('createUser', () => {
  it('creates user successfully', () => { /* ... */ });
  it('returns VALIDATION_ERROR for invalid email', () => { /* ... */ });
  it('returns EMAIL_EXISTS for duplicate', () => { /* ... */ });
  it('returns RATE_LIMITED when throttled', () => { /* ... */ });
});
```

### Mock via Context

Use context for dependency injection in tests:

```ts
const testProc = createUser.callable({
  context: {
    db: mockDb,
    email: mockEmailService
  }
});
```

## Common Pitfalls

### Don't Forget `.callable()`

```ts
// Wrong - returns builder, not function
const proc = zagora().input(z.string()).handler((_, s) => s);
proc('test');  // Error: proc is not a function

// Right
const proc = zagora().input(z.string()).handler((_, s) => s).callable();
proc('test');  // Works
```

### Await Async Results

```ts
// Wrong - result is Promise
const result = asyncProc(input);
console.log(result.data);  // undefined

// Right
const result = await asyncProc(input);
console.log(result.data);  // actual data
```

### Handle Async Schema Quirks

```ts
// With async schemas, always await
const proc = zagora()
  .input(z.string().refine(async (s) => checkAsync(s)))
  .handler((_, s) => s)
  .callable();

// Always await, even if TypeScript doesn't require it
const result = await proc('test');
```
