---
description: "Error type reference. Zagora provides a structured error system with built-in and user-defined error types."
head:
  - - meta
    - property: og:description
      content: "Error type reference. Zagora provides a structured error system with built-in and user-defined error types."
---

# Error Types


Zagora provides a structured error system with built-in and user-defined error types.

## Import

```ts
import { 
  isValidationError,
  isInternalError,
  isDefinedError,
  isZagoraError
} from 'zagora/errors';
```

## Built-in Error Types

### VALIDATION_ERROR

Returned when input, output, or error payload validation fails.

```ts
{
  kind: 'VALIDATION_ERROR',
  message: string,
  issues: Array<{
    path: (string | number)[],
    message: string
  }>,
  key?: string  // Present if error helper validation failed
}
```

**Causes:**
- Invalid input to procedure
- Invalid output from handler
- Invalid payload to error helper

**Example:**

```ts
const result = proc({ email: 'invalid' });

if (!result.ok && result.error.kind === 'VALIDATION_ERROR') {
  console.log(result.error.issues);
  // [{ path: ['email'], message: 'Invalid email' }]
}
```

### UNKNOWN_ERROR

Returned when an unhandled exception occurs in the handler.

```ts
{
  kind: 'UNKNOWN_ERROR',
  message: string,
  cause: unknown  // The original error
}
```

**Causes:**
- Throwing a non-Zagora error in handler
- Runtime errors (TypeError, ReferenceError, etc.)
- Cache adapter failures

**Example:**

```ts
const result = proc();

if (!result.ok && result.error.kind === 'UNKNOWN_ERROR') {
  console.log(result.error.message);
  console.log(result.error.cause);  // Original Error object
}
```

## User-Defined Error Types

Define custom errors with `.errors()`:

```ts
const proc = zagora()
  .errors({
    NOT_FOUND: z.object({
      id: z.string(),
      resource: z.string()
    }),
    RATE_LIMITED: z.object({
      retryAfter: z.number()
    }),
    FORBIDDEN: z.object({
      requiredRole: z.string()
    })
  })
  .handler(({ errors }) => {
    throw errors.NOT_FOUND({ id: '123', resource: 'User' });
  })
  .callable();
```

The result error will have the shape:

```ts
{
  kind: 'NOT_FOUND',
  id: '123',
  resource: 'User'
}
```

## Type Guards

### isValidationError(error)

Check if error is a validation error:

```ts
if (!result.ok && isValidationError(result.error)) {
  // result.error.kind === 'VALIDATION_ERROR'
  result.error.issues;  // Available
}
```

### isInternalError(error)

Check if error is an unknown/internal error:

```ts
if (!result.ok && isInternalError(result.error)) {
  // result.error.kind === 'UNKNOWN_ERROR'
  result.error.cause;  // Available
}
```

### isDefinedError(error)

Check if error is one of your defined error types:

```ts
if (!result.ok && isDefinedError(result.error)) {
  // result.error.kind is one of your defined kinds
  switch (result.error.kind) {
    case 'NOT_FOUND':
      result.error.id;       // string
      result.error.resource; // string
      break;
  }
}
```

### isZagoraError(error)

Check if error is any Zagora error type:

```ts
if (!result.ok && isZagoraError(result.error)) {
  result.error.kind;  // Always available
}
```

## Error Hierarchy

```
ZagoraError
├── VALIDATION_ERROR (built-in)
├── UNKNOWN_ERROR (built-in)
└── [User-Defined Errors]
    ├── NOT_FOUND
    ├── FORBIDDEN
    └── ... (your custom error kinds)
```

## TypeScript Types

```ts
import type { 
  ValidationError,
  UnknownError,
  DefinedError,
  ZagoraError
} from 'zagora/types';

type ValidationError = {
  kind: 'VALIDATION_ERROR';
  message: string;
  issues: Array<{ path: (string | number)[], message: string }>;
  key?: string;
};

type UnknownError = {
  kind: 'UNKNOWN_ERROR';
  message: string;
  cause: unknown;
};

type DefinedError<TErrors> = {
  kind: keyof TErrors;
  // ... properties from error schema
};
```

## See Also

- [Typed Errors](/docs/typed-errors) - Defining custom errors
- [Error Type Guards](/docs/error-guards) - Using type guards
- [ZagoraResult Type](/api/result-type) - Full result type
