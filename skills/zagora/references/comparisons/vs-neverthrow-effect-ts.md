# vs neverthrow/Effect.ts

Zagora vs functional error handling libraries.

## Feature Comparison

| Feature | neverthrow/Effect.ts | Zagora |
|---------|----------------------|--------|
| Never Throws | Yes | Yes |
| Type Safety | Yes | Yes |
| Validation | Manual | Built-in |
| Async Support | Complex | Automatic |
| Learning Curve | Steep | Gentle |
| Bundle Size | Large | Small |
| StandardSchema | No | Yes |

## Key Differences

### API Complexity

neverthrow

```ts
import { Result, ok, err } from 'neverthrow';

function getUser(id: string): Result<User, Error> {
  if (!id) return err(new Error('Invalid id'));
  const user = db.find(id);
  return user ? ok(user) : err(new Error('Not found'));
}

const result = getUser(id);
if (result.isOk()) {
  result.unwrap();  // Throws if error!
} else {
  result.error;
}
```

with zagora

```ts
const getUser = zagora()
  .input(z.string().min(1))
  .handler((_, id) => {
    const user = db.find(id);
    if (!user) throw new Error('Not found');
    return user;
  })
  .callable();

const result = getUser(id);
if (result.ok) {
  result.data;  // Direct access
} else {
  result.error;  // Typed error
}
```

### Validation Integration

If you use `neverthrow`, you should integrate validators manually.

```ts
// neverthrow + Zod
function createUser(input: unknown): Result<User, ValidationError> {
  const result = schema.safeParse(input);
  if (!result.success) {
    return err(new ValidationError(result.error.issues));
  }
  return ok(db.create(result.data));
}
```

While with Zagora, you have a cleaner built-in API

```ts
// Zagora
const createUser = zagora()
  .input(schema)
  .handler((_, input) => db.create(input))
  .callable();

const result = createUser(input);
// Validation errors are automatic
```

## When to Use Each

### Use neverthrow/Effect.ts when:

* You love functional programming
* You need complex error handling flows
* You're already using fp-ts or similar
* You want maximum type safety guarantees

### Use Zagora when:

* You want simple, imperative code
* You need built-in validation
* You're building APIs or libraries
* You prefer minimal abstraction

### Effect.ts Dependency Injection & Resource Management

Effect.ts offers more than error handling - it provides powerful dependency injection and resource management:

```ts
// Effect.ts - complex dependency injection
import { Effect, Context } from 'effect';

const DatabaseService = Context.Tag<DatabaseService>();
const LoggerService = Context.Tag<LoggerService>();

const program = Effect.gen(function* () {
  const db = yield* DatabaseService;
  const logger = yield* LoggerService;

  const user = yield* Effect.tryPromise(() =>
    db.findUser('123')
  );

  yield* logger.log(`Found user: ${user.name}`);
  return user;
});

// Running with dependencies
const runnable = program.pipe(
  Effect.provideService(DatabaseService, myDatabase),
  Effect.provideService(LoggerService, myLogger)
);

const result = await Effect.runPromise(runnable);
```

While Zagora provides similar functionality through context:

```ts
// Zagora - simple dependency injection
const getUser = zagora()
  .context({ db: myDatabase, logger: myLogger })
  .input(z.string())
  .handler(async ({ context }, id) => {
    const user = await context.db.findUser(id);
    context.logger.log(`Found user: ${user.name}`);
    return user;
  })
  .callable();

// Direct call with context
const result = await getUser('123');
```

## Philosophy

**neverthrow/Effect.ts**: Pure functional programming, no exceptions, complex APIs for error flows, dependency injection, and resource management.

**Zagora**: Practical functional programming, no exceptions, simple and powerful with built-in validation and dependency injection.

Zagora takes the best of neverthrow/Effect.ts (never throws, typed errors, dependency injection) and makes it simpler with built-in validation.
