---
description: "Build your first procedure. This guide walks you through creating type-safe, error-safe procedures with Zagora."
head:
  - - meta
    - property: og:description
      content: "Build your first procedure. This guide walks you through creating type-safe, error-safe procedures with Zagora."
---

# Quick Start

This guide walks you through creating type-safe, error-safe procedures with Zagora.

## Your First Procedure

A procedure is a type-safe function with validated inputs and predictable outputs:

```ts
import { z } from 'zod';
import { zagora } from 'zagora';

const addNumbers = zagora()
  .input(z.tuple([z.number(), z.number()]))
  .output(z.number())
  .handler((_, a, b) => a + b)
  .callable();

const result = addNumbers(5, 10);

if (result.ok) {
  console.log(result.data); // 15
}
```

## Understanding the Result

Every procedure returns a `ZagoraResult` with a discriminated union:

```ts
const result = addNumbers(5, 10);

if (result.ok) {
  // Success path
  console.log(result.data); // number
  console.log(result.error); // undefined
} else {
  // Error path
  console.log(result.data); // undefined
  console.log(result.error.kind); // 'VALIDATION_ERROR' | 'UNKNOWN_ERROR' | ...
}
```

## Input Validation

Invalid inputs are caught at runtime and returned as validation errors:

```ts
const result = addNumbers('not', 'numbers');

if (!result.ok) {
  console.log(result.error.kind); // 'VALIDATION_ERROR'
  console.log(result.error.issues); // Array of validation issues
}
```

## Adding Typed Errors

Define custom errors with schemas for strongly-typed error handling:

```ts
const divide = zagora()
  .input(z.tuple([z.number(), z.number()]))
  .output(z.number())
  .errors({
    DIVISION_BY_ZERO: z.object({ 
      dividend: z.number() 
    })
  })
  .handler(({ errors }, a, b) => {
    if (b === 0) {
      throw errors.DIVISION_BY_ZERO({ dividend: a });
    }
    return a / b;
  })
  .callable();

const result = divide(10, 0);

if (!result.ok && result.error.kind === 'DIVISION_BY_ZERO') {
  console.log(result.error.dividend); // 10
}
```

## Using Context

Pass shared dependencies through context:

```ts
const getUser = zagora()
  .input(z.string())
  .handler(({ context }, userId) => {
    return context.db.findUser(userId);
  })
  .callable({ context: { db: myDatabase } });
```

## Async Procedures

Zagora automatically infers sync vs async based on your handler:

```ts
const fetchUser = zagora()
  .input(z.string())
  .handler(async (_, userId) => {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  })
  .callable();

// Returns Promise<ZagoraResult<...>>
const result = await fetchUser('123');
```

## Next Steps

- Learn about [Procedures](/docs/procedures) in depth
- Explore [Tuple Arguments](/docs/tuple-arguments) for natural function signatures
- See [Typed Errors](/docs/typed-errors) for robust error handling
