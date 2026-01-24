# Typed Errors

Define structured error types for predictable error handling.

**IMPORTANT: You can either `throw` or `return` errors that are created from error helpers! Zagora detects the built-in error kinds or the custom typed errors. But it's always best to just throw! Error helpers just return objects, so you're effectively throwing plain objects in a specific shape!**

## Defining Errors

Use `.errors()` to define custom error types:

```ts
const getUser = zagora()
  .errors({
    NOT_FOUND: z.object({ id: z.string() }),
    FORBIDDEN: z.object({ reason: z.string() })
  })
  .input(z.string())
  .handler(({ errors }, id) => {
    if (id === 'missing') {
      throw errors.NOT_FOUND({ id });
    }
    if (id === 'private') {
      throw errors.FORBIDDEN({ reason: 'Access denied' });
    }
    return { id, name: 'Alice' };
  })
  .callable();
```

## Error Helpers

Error helpers are functions that create throwable error objects, Zagora never uses Errors or exceptions, it's all plain objects. Handlers can either throw or return such error kind objects.

```ts
throw errors.NOT_FOUND({ id: '123' });
throw errors.FORBIDDEN({ reason: 'No permission' });
```

## Consuming Errors

Handle errors by checking the kind:

```ts
const result = getUser('missing');

if (!result.ok) {
  switch (result.error.kind) {
    case 'NOT_FOUND':
      console.log('User not found:', result.error.id);
      break;
    case 'FORBIDDEN':
      console.log('Access denied:', result.error.reason);
      break;
  }
}
```

## Error Validation

Error payloads are validated/reported at compile-time and runtime:

```ts
// Valid
throw errors.NOT_FOUND({ id: '123' });

// Invalid - validation error
throw errors.NOT_FOUND({ wrongField: 'value' });
// => { kind: 'VALIDATION_ERROR', key: 'NOT_FOUND', ... }
```

## Built-in Errors

Zagora provides built-in error types:

- `VALIDATION_ERROR`: Input/output/error/env payload validation failed
- `UNKNOWN_ERROR`: Unhandled exception in handler

Use typed errors to create your own named & predictable error handling in your procedures.
