# Error Type Guards

Zagora provides type guard utilities to help narrow error types in your code.

## Available Guards

Import guards from `zagora/errors`:

```ts
import { 
  isValidationError,
  isInternalError,
  isDefinedError,
  isZagoraError
} from 'zagora/errors';
```

## isValidationError

Check if an error is a validation error (input, output, env, or error payload validation failed):

```ts
const result = myProcedure(invalidInput);

if (!result.ok) {
  if (isValidationError(result.error)) {
    // result.error.kind === 'VALIDATION_ERROR'
    console.log(result.error.issues);
    console.log(result.error.key); // undefined or error key if error helper validation failed
  }
}
```

## isInternalError

Check if an error is an unknown/internal error (unhandled exception in handler). Keep in mind that the original error is passed on `result.error.cause` property.

```ts
if (!result.ok) {
  if (isInternalError(result.error)) {
    // result.error.kind === 'UNKNOWN_ERROR'
    console.log(result.error.message); // Something like "Failure in handler"
    console.log(result.error.cause); // SyntaxError("foo bar")
  }
}
```

## isDefinedError

Check if an error is one of your defined error types:

```ts
const proc = zagora()
  .errors({
    NOT_FOUND: z.object({ id: z.string() }),
    FORBIDDEN: z.object({ reason: z.string() })
  })
  .handler(/* ... */)
  .callable();

const result = proc();

if (!result.ok) {
  if (isDefinedError(result.error)) {
    // result.error.kind is 'NOT_FOUND' | 'FORBIDDEN'
    switch (result.error.kind) {
      case 'NOT_FOUND':
        console.log(result.error.id);
        break;
      case 'FORBIDDEN':
        console.log(result.error.reason);
        break;
    }
  }
}
```

## isZagoraError

Check if an error is any Zagora error type:

```ts
if (!result.ok) {
  if (isZagoraError(result.error)) {
    // It's a Zagora-managed error (not a raw throw)
    console.log(result.error.kind);
  }
}
```

## Pattern: Error Handler Utility

Create a reusable error handler:

```ts
import { isValidationError, isInternalError } from 'zagora/errors';

function handleError(error) {
  if (isValidationError(error)) {
    return {
      status: 400,
      body: { 
        message: 'Invalid input',
        issues: error.issues 
      }
    };
  }
  
  if (isInternalError(error)) {
    console.error('Internal error:', error.cause);
    return {
      status: 500,
      body: { message: 'Internal server error' }
    };
  }
  
  // Defined error
  return {
    status: 422,
    body: { 
      code: error.kind,
      ...error 
    }
  };
}

const result = myProcedure(input);
if (!result.ok) {
  return handleError(result.error);
}
```

## TypeScript Narrowing

The guards work with TypeScript's control flow analysis:

```ts
const result = proc();

if (!result.ok) {
  const error = result.error;
  
  if (isValidationError(error)) {
    // TypeScript knows: error.kind === 'VALIDATION_ERROR'
    error.issues;  // OK
  } else if (isInternalError(error)) {
    // TypeScript knows: error.kind === 'UNKNOWN_ERROR'
    error.cause;  // OK
  } else {
    // TypeScript knows: it's a defined error
    error.kind;  // 'NOT_FOUND' | 'FORBIDDEN' | ...
  }
}
```

Use type guards to handle different error types safely.
