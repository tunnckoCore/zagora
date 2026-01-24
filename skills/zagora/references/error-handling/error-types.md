# Error Types

Zagora provides built-in error types and supports user-defined errors for structured error handling.

## Built-in Error Types

### VALIDATION_ERROR

Occurs when input, output, or error payload validation fails:

```ts
{
  kind: 'VALIDATION_ERROR',
  message: string,
  issues: Array<{
    path: string[],
    message: string,
    code: string
  }>,
  key?: string  // Present if error helper validation failed
}
```

### UNKNOWN_ERROR

Occurs when an unhandled exception is thrown in the handler:

```ts
{
  kind: 'UNKNOWN_ERROR',
  message: string,
  cause: Error  // The original error
}
```

## User-Defined Errors

Define custom error types with `.errors()`:

```ts
const proc = zagora()
  .errors({
    NOT_FOUND: z.object({ id: z.string() }),
    FORBIDDEN: z.object({ reason: z.string() })
  })
  .handler(({ errors }) => {
    throw errors.NOT_FOUND({ id: 'foo' });
  })
  .callable();
```

Results in:

```ts
{
  kind: 'NOT_FOUND',
  id: 'foo'
}
```

## Importing Error Types

Import built-in types from `zagora/errors`:

```ts
import type { 
  ValidationError,
  InternalError,
  DefinedError,
  ZagoraError,
  ErrorHelpers,
} from 'zagora/errors';

const result = proc();
if (!result.ok) {
  const error: ZagoraError = result.error;
  // error is fully typed
}
```

## Importing error creation helpers

```ts
import {
  createValidationError,
  createInternalError,
  createErrorHelpers,
} from 'zagora/errors';
```

Use built-in and custom error types for comprehensive error handling.
