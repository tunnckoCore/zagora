---
description: "Define structured error responses. Zagora lets you define error schemas upfront, giving you strongly-typed error helpers inside handlers and typed error responses for consumers."
head:
  - - meta
    - property: og:description
      content: "Define structured error responses. Zagora lets you define error schemas upfront, giving you strongly-typed error helpers inside handlers and typed error responses for consumers."
---

# Typed Errors

Zagora lets you define error schemas upfront, giving you strongly-typed error helpers inside handlers and typed error responses for consumers.

## Defining Errors

Use the `.errors()` method with an object mapping error kinds to schemas:

```ts
import { z } from 'zod';
import { zagora } from 'zagora';

const getUser = zagora()
  .input(z.string())
  .errors({
    NOT_FOUND: z.object({
      userId: z.string(),
      message: z.string()
    }),
    UNAUTHORIZED: z.object({
      requiredRole: z.string()
    })
  })
  .handler(({ errors }, userId) => {
    if (!currentUser) {
      throw errors.UNAUTHORIZED({ requiredRole: 'user' });
    }
    
    const user = db.find(userId);
    if (!user) {
      throw errors.NOT_FOUND({ 
        userId, 
        message: 'User not found' 
      });
    }
    
    return user;
  })
  .callable();
```

## Error Keys Must Be Uppercase

Error keys represent error "kinds" and must be UPPERCASE:

```ts
// Good
.errors({
  NOT_FOUND: z.object({ id: z.string() }),
  RATE_LIMITED: z.object({ retryAfter: z.number() })
})

// Bad - TypeScript will error
.errors({
  notFound: z.object({ id: z.string() })  // Must be uppercase!
})
```

## Using Error Helpers

Inside the handler, `errors` provides typed helper functions:

```ts
.handler(({ errors }, input) => {
  // errors.NOT_FOUND() - creates NOT_FOUND error
  // errors.UNAUTHORIZED() - creates UNAUTHORIZED error
  
  throw errors.NOT_FOUND({ userId: '123', message: 'Gone' });
})
```

The helper validates the error payload at runtime:

```ts
// This will cause a VALIDATION_ERROR because retryAfter should be number
throw errors.RATE_LIMITED({ retryAfter: 'invalid' });
```

## Consuming Typed Errors

Consumers can narrow error types using the `kind` property:

```ts
const result = getUser('123');

if (!result.ok) {
  switch (result.error.kind) {
    case 'NOT_FOUND':
      console.log(result.error.userId);   // string
      console.log(result.error.message);  // string
      break;
    case 'UNAUTHORIZED':
      console.log(result.error.requiredRole);  // string
      break;
    case 'VALIDATION_ERROR':
      console.log(result.error.issues);  // Schema.Issue[]
      break;
    case 'UNKNOWN_ERROR':
      console.log(result.error.cause);  // unknown
      break;
  }
}
```

## Built-in Error Kinds

Zagora includes two built-in error kinds:

### VALIDATION_ERROR

Returned when input, output, or error payload validation fails:

```ts
{
  kind: 'VALIDATION_ERROR',
  message: 'Validation failed',
  issues: [{ path: ['email'], message: 'Invalid email' }],
  key?: 'NOT_FOUND'  // Present if error helper validation failed
}
```

### UNKNOWN_ERROR

Returned when an untyped error is thrown:

```ts
.handler(() => {
  throw new Error('Something went wrong');
})

// Results in:
{
  kind: 'UNKNOWN_ERROR',
  message: 'Something went wrong',
  cause: Error('Something went wrong')
}
```

## Error Validation

Error payloads are validated at runtime. Invalid payloads become `VALIDATION_ERROR`:

```ts
const proc = zagora()
  .errors({
    RATE_LIMITED: z.object({ retryAfter: z.number() })
  })
  .handler(({ errors }) => {
    // Wrong type for retryAfter
    throw errors.RATE_LIMITED({ retryAfter: 'soon' });
  })
  .callable();

const result = proc();
// result.error.kind === 'VALIDATION_ERROR'
// result.error.key === 'RATE_LIMITED'
```

## Strict Error Schemas

Use `.strict()` to reject unknown properties:

```ts
.errors({
  NOT_FOUND: z.object({ id: z.string() }).strict()
})

// This will fail validation:
throw errors.NOT_FOUND({ id: '123', extra: 'field' });
```

## Next Steps

- [Error Type Guards](/docs/error-guards) - Narrow error types with utilities
- [Never-Throwing Guarantees](/docs/never-throwing) - How errors are always captured
