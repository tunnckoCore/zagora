# vs Plain TypeScript

Zagora vs plain TypeScript: when to add runtime safety.

## Feature Comparison

| Feature | Plain TypeScript | Zagora |
|---------|------------------|--------|
| Type Safety | Static only | Static + runtime |
| Error Handling | Throws exceptions | Never throws |
| Input Validation | Manual or separate libs | Built-in |
| Return Types | Inferred | Guaranteed discriminated unions |
| Async Support | Manual | Automatic sync/async inference |
| Dependencies | No injection | Context management |

## Key Differences

### Error Handling

Plain TypeScript

```ts
function getUser(id: string): User {
  if (!id) throw new Error('Invalid id');
  const user = db.find(id);
  if (!user) throw new Error('Not found');
  return user;
}

// Must try/catch everywhere
try {
  const user = getUser(id);
} catch (e) {
  // e is unknown
}
```

Zagora

```ts
const getUser = zagora()
  .input(z.string().min(1))
  .errors({ NOT_FOUND: z.object({ id: z.string() }) })
  .handler(({ errors }, id) => {
    const user = db.find(id);
    if (!user) throw errors.NOT_FOUND({ id });
    return user;
  })
  .callable();

const result = getUser(id);
if (!result.ok) {
  // result.error is fully typed
}
```

### Validation

With plain TypeScript you can still have runtime errors

```ts
function createUser(data: any): User {
  if (!data.name) throw new Error('Name required');
  return db.create(data);
}
```

Zagora - compile-time + runtime safety

```ts
const createUser = zagora()
  .input(z.object({ name: z.string().min(1) }))
  .handler((_, data) => db.create(data))
  .callable();

const result = createUser({ name: '' });  // Validation error at runtime
```

## Philosophy

**Plain TypeScript**: Trust the types, handle errors manually.

**Zagora**: Types are contracts - enforce them at compile-time AND runtime. Never throw - return structured results.

## When to Use Each

### Use Plain TypeScript when:

* Performance-critical code where validation overhead matters
* Simple internal functions with trusted inputs
* You prefer manual error handling control
* No need for runtime type checking

### Use Zagora when:

* Building APIs or libraries with external inputs
* You want guaranteed error handling
* Runtime safety is important
* You need dependency injection
* Complex business logic with multiple error cases

## Migration Path

Start with plain TypeScript, add Zagora when:
- Adding external inputs
- Needing better error handling
- Building reusable procedures

Zagora is plain TypeScript with superpowers - no lock-in.
