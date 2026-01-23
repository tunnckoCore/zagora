---
description: "Procedures never crash your process. Zagora procedures are guaranteed to never throw exceptions."
head:
  - - meta
    - property: og:description
      content: "Procedures never crash your process. Zagora procedures are guaranteed to never throw exceptions."
---

# Never-Throwing Guarantees


Zagora procedures are guaranteed to never throw exceptions. Every outcome—success or failure—is returned as a structured result.

## The Guarantee

No matter what happens inside a procedure, you always get a `ZagoraResult`:

```ts
import { z } from 'zod';
import { zagora } from 'zagora';

const riskyOperation = zagora()
  .input(z.string())
  .handler((_, input) => {
    throw new Error('Something went wrong!');
  })
  .callable();

// This does NOT throw - it returns an error result
const result = riskyOperation('test');

console.log(result.ok);           // false
console.log(result.error.kind);   // 'UNKNOWN_ERROR'
console.log(result.error.cause);  // Error: Something went wrong!
```

## What Gets Captured

### Handler Exceptions

Any error thrown in the handler becomes an `UNKNOWN_ERROR`:

```ts
.handler(() => {
  throw new Error('Oops');
})
// => { ok: false, error: { kind: 'UNKNOWN_ERROR', message: 'Oops', cause: Error } }
```

### Validation Failures

Invalid inputs become `VALIDATION_ERROR`:

```ts
const proc = zagora()
  .input(z.number())
  .handler((_, n) => n * 2)
  .callable();

proc('not a number');
// => { ok: false, error: { kind: 'VALIDATION_ERROR', issues: [...] } }
```

### Typed Errors

Your defined errors are captured and typed:

```ts
const proc = zagora()
  .errors({ NOT_FOUND: z.object({ id: z.string() }) })
  .handler(({ errors }) => {
    throw errors.NOT_FOUND({ id: '123' });
  })
  .callable();

const result = proc();
// => { ok: false, error: { kind: 'NOT_FOUND', id: '123' } }
```

### Syntax Errors

Even syntax errors are captured:

```ts
.handler(() => {
  const obj = null;
  return obj.property;  // TypeError: Cannot read property of null
})
// => { ok: false, error: { kind: 'UNKNOWN_ERROR', cause: TypeError } }
```

### Async Rejections

Promise rejections are captured:

```ts
.handler(async () => {
  const response = await fetch('/failing-endpoint');
  if (!response.ok) throw new Error('Request failed');
})
// => { ok: false, error: { kind: 'UNKNOWN_ERROR', ... } }
```

## Result Structure

### Success

```ts
{
  ok: true,
  data: T,          // Your return value
  error: undefined
}
```

### Failure

```ts
{
  ok: false,
  data: undefined,
  error: {
    kind: 'VALIDATION_ERROR' | 'UNKNOWN_ERROR' | YourErrorKinds,
    message: string,
    // ... additional fields based on error kind
  }
}
```

## Why Never-Throwing?

### Predictable Control Flow

```ts
// Traditional - must remember to try/catch
try {
  const user = getUser(id);
  processUser(user);
} catch (e) {
  // What type is e? Unknown!
  handleError(e);
}

// Zagora - explicit error handling
const result = getUser(id);
if (result.ok) {
  processUser(result.data);
} else {
  // result.error is fully typed
  handleError(result.error);
}
```

### No Accidental Crashes

```ts
// Traditional - unhandled rejection can crash process
await riskyAsyncOperation();  // Might throw!

// Zagora - always safe
const result = await riskyAsyncOperation();  // Never throws
if (!result.ok) {
  console.error('Failed:', result.error);
}
```

### Typed Errors

```ts
if (!result.ok) {
  switch (result.error.kind) {
    case 'NOT_FOUND':
      // TypeScript knows the shape
      console.log(result.error.id);
      break;
    case 'VALIDATION_ERROR':
      console.log(result.error.issues);
      break;
    case 'UNKNOWN_ERROR':
      console.log(result.error.cause);
      break;
  }
}
```

## Comparison with Other Approaches

### vs try/catch

```ts
// try/catch - error type is unknown
try {
  const result = dangerousOperation();
} catch (e) {
  // e is `unknown` - must cast or check
}

// Zagora - error is fully typed
const result = safeOperation();
if (!result.ok) {
  result.error.kind;  // Typed!
}
```

### vs neverthrow

```ts
// neverthrow - requires unwrapping
const result = await operation();
const value = result.unwrap();  // Throws if error!

// Zagora - direct access
const result = operation();
if (result.ok) {
  result.data;  // Direct access, no unwrap
}
```

### vs Effect.ts

```ts
// Effect - complex API
const program = Effect.tryPromise({
  try: () => operation(),
  catch: (e) => new CustomError(e)
});
await Effect.runPromise(program);

// Zagora - simple
const result = operation();
```

## Edge Cases

### Cache Failures

```ts
const brokenCache = {
  has() { throw new Error('Cache failed'); },
  // ...
};

const result = proc();
// => { ok: false, error: { kind: 'UNKNOWN_ERROR', cause: Error('Cache failed') } }
```

### Invalid Error Payloads

```ts
throw errors.NOT_FOUND({ wrongField: 'value' });
// => { ok: false, error: { kind: 'VALIDATION_ERROR', key: 'NOT_FOUND', ... } }
```

## Next Steps

- [Typed Errors](/docs/typed-errors) - Define structured errors
- [Error Type Guards](/docs/error-guards) - Narrow error types
