---
description: "Why use Zagora over plain functions. **Philosophy**: Plain TypeScript offers types but no runtime guarantees."
head:
  - - meta
    - property: og:description
      content: "Why use Zagora over plain functions. **Philosophy**: Plain TypeScript offers types but no runtime guarantees."
---

# vs Plain TypeScript



**Philosophy**: Plain TypeScript offers types but no runtime guarantees. Zagora bridges the gap with runtime validation while maintaining full type inference. You get the ergonomics of pure functions with the safety of schema validation. Here's what Zagora adds.

## Feature Comparison

| Aspect | Zagora | Plain TypeScript |
|--------|--------|------------------|
| Runtime validation | Yes (StandardSchema) | Manual implementation |
| Compile-time types | Yes (full inference) | Manual type annotations |
| Error handling | Structured `{ ok, error }` | try/catch or manual |
| Default values at runtime | Automatic from schema | Manual implementation |
| Tuple argument spreading | Built-in | Not applicable |
| Caching/memoization | Built-in adapter | Manual implementation |
| Context injection | Built-in | Manual prop drilling |

## Key Differences

### 1. Runtime Validation

**Plain TypeScript:** Types exist only at compile-time

```ts
function createUser(data: { name: string; age: number }) {
  // Types say this is safe, but at runtime...
  return { id: '1', ...data };
}

// TypeScript is happy, but runtime disaster awaits
createUser(JSON.parse(untrustedInput));  // Could be anything!
```

**Zagora:** Validates at runtime

```ts
const createUser = zagora()
  .input(z.object({
    name: z.string().min(1),
    age: z.number().min(0)
  }))
  .handler((_, data) => ({ id: '1', ...data }))
  .callable();

// Safe even with untrusted input
createUser(JSON.parse(untrustedInput));
// If invalid: { ok: false, error: { kind: 'VALIDATION_ERROR', ... } }
```

### 2. Error Handling

**Plain TypeScript:** Unpredictable exceptions

```ts
function getUser(id: string): User {
  const user = db.find(id);
  if (!user) throw new Error('Not found');  // Caller might forget to catch
  return user;
}

// Easy to forget error handling
const user = getUser('123');  // Might crash!
```

**Zagora:** Predictable results

```ts
const getUser = zagora()
  .input(z.string())
  .errors({ NOT_FOUND: z.object({ id: z.string() }) })
  .handler(({ errors }, id) => {
    const user = db.find(id);
    if (!user) throw errors.NOT_FOUND({ id });
    return user;
  })
  .callable();

// Caller must handle both cases
const result = getUser('123');
if (result.ok) {
  // use result.data
} else {
  // handle result.error
}
```

### 3. Default Values

**Plain TypeScript:** Manual defaults

```ts
function greet(
  name: string,
  greeting: string = 'Hello',
  punctuation: string = '!'
) {
  return `${greeting}, ${name}${punctuation}`;
}
```

**Zagora:** Schema-driven defaults

```ts
const greet = zagora()
  .input(z.tuple([
    z.string(),
    z.string().default('Hello'),
    z.string().default('!')
  ]))
  .handler((_, name, greeting, punctuation) => {
    return `${greeting}, ${name}${punctuation}`;
  })
  .callable();

// Same behavior, but with validation too
greet('World');  // "Hello, World!"
```

### 4. Type Inference

**Plain TypeScript:** Manual annotations

```ts
interface UserInput {
  name: string;
  email: string;
  age?: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
}

function createUser(input: UserInput): User {
  return {
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email,
    age: input.age ?? 18
  };
}
```

**Zagora:** Inferred from schemas

```ts
const createUser = zagora()
  .input(z.object({
    name: z.string(),
    email: z.string().email(),
    age: z.number().default(18)
  }))
  .output(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    age: z.number()
  }))
  .handler((_, input) => ({
    id: crypto.randomUUID(),
    ...input
  }))
  .callable();

// Types are inferred from schemas - no manual interface definitions
```

### 5. Dependency Injection

**Plain TypeScript:** Prop drilling or class patterns

```ts
class UserService {
  constructor(
    private db: Database,
    private logger: Logger,
    private cache: Cache
  ) {}

  async getUser(id: string) {
    this.logger.log('Fetching user');
    // ...
  }
}
```

**Zagora:** Built-in context

```ts
const getUser = zagora()
  .context({ db: myDb, logger: myLogger })
  .input(z.string())
  .handler(({ context }, id) => {
    context.logger.log('Fetching user');
    return context.db.find(id);
  })
  .callable();

// Override for testing
const testGetUser = getUser.callable({
  context: { db: mockDb, logger: mockLogger }
});
```

## What You Get with Zagora

1. **Runtime safety** - Invalid data is caught before it causes problems
2. **Predictable errors** - Never crash from unhandled exceptions
3. **Type inference** - Define once in schema, get types everywhere
4. **Less boilerplate** - Defaults, validation, and error handling built-in
5. **Testability** - Easy dependency injection via context

## What Plain TypeScript Is Better For

- Simple utility functions with no validation needs
- Performance-critical hot paths (Zagora adds overhead)
- When you're already using another validation solution
- One-off scripts where robustness isn't critical

## Philosophy

Plain TypeScript gives you types but trusts your code to be correct. Zagora adds a runtime safety net with validation, structured errors, and predictable results.

Choose Zagora when reliability and type-safety at runtime matter.
