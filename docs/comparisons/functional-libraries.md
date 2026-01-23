---
description: "Comparison with functional libraries. Zagora, neverthrow, and Effect."
head:
  - - meta
    - property: og:description
      content: "Comparison with functional libraries. Zagora, neverthrow, and Effect."
---

# vs neverthrow / Effect.ts


Zagora, neverthrow, and Effect.ts all solve the "exceptions are bad" problem, but with different approaches.

**Philosophy**: Zagora gives you error-safe results without functional programming overhead. The `neverthrow` requires monadic operations, Effect.ts requires learning an entirely new paradigm. Zagora is "just functions" with predictable results.

## Feature Comparison

| Feature | Zagora | neverthrow | Effect.ts |
|---------|--------|------------|-----------|
| Result unwrapping | Not needed | Required (`.unwrap()`) | Complex API |
| Learning curve | Minimal | Low | Very steep |
| Validation included | Yes (StandardSchema) | No | Yes (own system) |
| Error schema support | Yes (typed helpers) | No | Yes (different approach) |
| Functional programming focus | No | Yes | Yes (heavy FP) |
| Type inference | Full | Good | Excellent |
| Bundle size | Tiny | Small | Large |
| Primary philosophy | Practical type-safety | Monadic errors | Full effect system |

## Key Differences

### 1. Result Access

**Zagora:** Direct access via discriminated union

```ts
const result = getUser('123');

if (result.ok) {
  console.log(result.data);  // Direct access
} else {
  console.log(result.error); // Direct access
}
```

**neverthrow:** Requires unwrapping or monadic operations

```ts
const result = getUser('123');

// Option 1: unwrap (throws if error!)
const user = result.unwrap();

// Option 2: match
result.match(
  (user) => console.log(user),
  (error) => console.error(error)
);

// Option 3: map chain
result
  .map(user => user.name)
  .mapErr(err => new Error(err.message));
```

**Effect.ts:** Complex API with generators or pipe

```ts
const program = pipe(
  getUser('123'),
  Effect.map(user => user.name),
  Effect.catchTag('NotFound', () => Effect.succeed('Unknown'))
);

await Effect.runPromise(program);
```

### 2. Validation

**Zagora:** Built-in via StandardSchema

```ts
const createUser = zagora()
  .input(z.object({
    email: z.string().email(),
    age: z.number().min(18)
  }))
  .handler((_, input) => input)
  .callable();

// Invalid input -> VALIDATION_ERROR
createUser({ email: 'bad', age: 10 });
```

**neverthrow:** No validation, just error wrapping

```ts
// Must validate separately
const validated = emailSchema.safeParse(input);
if (!validated.success) {
  return err(new ValidationError(validated.error));
}
return ok(createUser(validated.data));
```

**Effect.ts:** Own validation system (Schema)

```ts
import { Schema } from '@effect/schema';

const User = Schema.struct({
  email: Schema.string.pipe(Schema.email),
  age: Schema.number.pipe(Schema.greaterThan(17))
});
```

### 3. Error Typing

**Zagora:** Schema-validated typed errors

```ts
const proc = zagora()
  .errors({
    NOT_FOUND: z.object({ id: z.string() }),
    FORBIDDEN: z.object({ reason: z.string() })
  })
  .handler(({ errors }) => {
    throw errors.NOT_FOUND({ id: '123' });
  });

// Error is validated AND typed
if (result.error.kind === 'NOT_FOUND') {
  result.error.id;  // string, guaranteed
}
```

**neverthrow:** Custom error classes

```ts
class NotFoundError extends Error {
  constructor(public id: string) {
    super('Not found');
  }
}

// No runtime validation
return err(new NotFoundError('123'));
```

**Effect.ts:** Tagged errors with `Effect.fail`

```ts
class NotFound {
  readonly _tag = 'NotFound';
  constructor(public id: string) {}
}

Effect.fail(new NotFound('123'));
```

### 4. Learning Curve

**Zagora:** Minimal - just functions with results

```ts
const fn = zagora().handler(() => 'result').callable();
const result = fn();
if (result.ok) use(result.data);
```

**neverthrow:** Low - learn monadic operations

```ts
// Need to understand: ok, err, Result, map, mapErr, match, andThen, unwrap...
```

**Effect.ts:** Very steep - new paradigm

```ts
// Need to understand: Effect, Layer, Runtime, Fiber, pipe, generators, do notation...
```

## Code Comparison

### Simple Operation

**Zagora:**

```ts
const divide = zagora()
  .input(z.tuple([z.number(), z.number()]))
  .errors({ DIVISION_BY_ZERO: z.object({}) })
  .handler(({ errors }, a, b) => {
    if (b === 0) throw errors.DIVISION_BY_ZERO({});
    return a / b;
  })
  .callable();

const result = divide(10, 2);
if (result.ok) console.log(result.data);
```

**neverthrow:**

```ts
const divide = (a: number, b: number): Result<number, DivisionByZero> => {
  if (b === 0) return err(new DivisionByZero());
  return ok(a / b);
};

divide(10, 2).match(
  value => console.log(value),
  error => console.error(error)
);
```

**Effect.ts:**

```ts
const divide = (a: number, b: number) =>
  b === 0
    ? Effect.fail(new DivisionByZero())
    : Effect.succeed(a / b);

await pipe(
  divide(10, 2),
  Effect.match({
    onSuccess: value => console.log(value),
    onFailure: error => console.error(error)
  }),
  Effect.runPromise
);
```

## When to Use Each

### Use Zagora When

- You want error-safe functions without learning new paradigms
- You need input/output validation built-in
- You prefer direct result access over unwrapping
- You want typed errors with runtime validation

### Use neverthrow When

- You're comfortable with monadic operations
- You want a lightweight error-handling library
- Validation is handled separately
- You like functional composition

### Use Effect.ts When

- You want a complete effect system
- You need advanced features (fibers, layers, retries)
- Your team is comfortable with functional programming
- You're building a large application with complex requirements

## Philosophy

**Zagora:** Practical type-safety with minimal ceremony. Just functions with validated inputs, typed errors, and predictable results.

**neverthrow:** Monadic error handling for JavaScript. Learn a few concepts, apply them consistently.

**Effect.ts:** A full effect system bringing Scala ZIO / Haskell IO patterns to TypeScript. Maximum power, maximum complexity.
