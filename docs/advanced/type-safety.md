---
description: "How Zagora ensures type correctness. Zagora provides comprehensive type safety across inputs, outputs, errors, context, and more."
head:
  - - meta
    - property: og:description
      content: "How Zagora ensures type correctness. Zagora provides comprehensive type safety across inputs, outputs, errors, context, and more."
---

# Type Safety Guarantees


Zagora provides comprehensive type safety across inputs, outputs, errors, context, and more. Here's how it works.

## Type Inference Sources

### From Input Schema

```ts
const proc = zagora()
  .input(z.object({
    name: z.string(),
    age: z.number().optional()
  }))
  .handler((_, input) => {
    // input is typed as:
    // { name: string, age?: number | undefined }
  });
```

### From Output Schema

```ts
const proc = zagora()
  .output(z.object({
    id: z.string(),
    createdAt: z.date()
  }))
  .handler(() => ({
    id: '123',
    createdAt: new Date()
  }));

// Result type: ZagoraResult<{ id: string, createdAt: Date }>
```

### From Error Schemas

```ts
const proc = zagora()
  .errors({
    NOT_FOUND: z.object({ id: z.string() }),
    FORBIDDEN: z.object({ reason: z.string() })
  })
  .handler(({ errors }) => {
    // errors.NOT_FOUND and errors.FORBIDDEN are typed
  });

// Error type includes all defined kinds
```

## Tuple Argument Inference

Tuple schemas spread into handler arguments with full type inference:

```ts
const proc = zagora()
  .input(z.tuple([
    z.string(),                    // arg1: string
    z.number().default(10),        // arg2: number (not number | undefined!)
    z.boolean().optional()         // arg3: boolean | undefined
  ]))
  .handler((_, arg1, arg2, arg3) => {
    // TypeScript knows exact types
  });
```

### Default Values

When a schema has `.default()`, the type is **not optional**:

```ts
.input(z.tuple([
  z.number().default(0)  // Handler receives: number (not number | undefined)
]))
```

This is different from `.optional()`:

```ts
.input(z.tuple([
  z.number().optional()  // Handler receives: number | undefined
]))
```

## Result Type Narrowing

The `ok` property enables TypeScript narrowing:

```ts
const result = proc(input);

if (result.ok) {
  // TypeScript knows:
  result.data;   // TData (your output type)
  result.error;  // undefined
} else {
  // TypeScript knows:
  result.data;   // undefined
  result.error;  // ZagoraError (union of all error types)
}
```

## Error Kind Narrowing

Switch on `error.kind` for type-safe error handling:

```ts
if (!result.ok) {
  switch (result.error.kind) {
    case 'NOT_FOUND':
      // TypeScript knows: result.error has NOT_FOUND schema shape
      result.error.id;
      break;
    case 'VALIDATION_ERROR':
      // TypeScript knows: result.error has issues array
      result.error.issues;
      break;
    case 'UNKNOWN_ERROR':
      // TypeScript knows: result.error has cause
      result.error.cause;
      break;
  }
}
```

## Context Type Safety

Context is fully typed from both sources:

```ts
const proc = zagora()
  .context({ db: myDatabase })  // Initial context
  .handler(({ context }) => {
    context.db;      // typeof myDatabase
    context.logger;  // Logger (from runtime)
  })
  .callable({ context: { logger: myLogger } });  // Runtime context
```

## Env Type Safety

Environment variables are typed from schema:

```ts
const proc = zagora()
  .env(z.object({
    API_KEY: z.string(),
    PORT: z.coerce.number()
  }))
  .handler(({ env }) => {
    env.API_KEY;  // string
    env.PORT;     // number (coerced from string)
  });
```

## Type Tests

Zagora includes dedicated type-level tests to ensure type inference works correctly. See `test/types-testing.test.ts` in the repository.

Example type test:

```ts
// Verify tuple spreading preserves types
const proc = zagora()
  .input(z.tuple([z.string(), z.number().default(5)]))
  .handler((_, a, b) => {
    // Type assertions
    expectTypeOf(a).toEqualTypeOf<string>();
    expectTypeOf(b).toEqualTypeOf<number>();  // Not number | undefined!
  });
```

## Edge Cases

### Async Schema Inference

When using async schemas, TypeScript may not require `await`. Always await anyway:

```ts
const proc = zagora()
  .input(z.string().refine(async (val) => checkAsync(val)))
  .handler((_, input) => input);

// Always await with async schemas
const result = await proc('test');
```

### Handler Return Type vs Output Schema

If both are present, output schema takes precedence:

```ts
const proc = zagora()
  .output(z.object({ name: z.string() }))
  .handler(() => ({
    name: 'Alice',
    secret: 'hidden'  // Not in output schema
  }));

// result.data type is { name: string }, not { name: string, secret: string }
```

## Best Practices

1. **Define output schemas** for public APIs to guarantee return shape
2. **Use tuple inputs** for natural function signatures
3. **Define all error kinds** upfront for complete error typing
4. **Enable strict mode** in tsconfig.json for best type safety
5. **Run type tests** to verify type inference in your procedures
