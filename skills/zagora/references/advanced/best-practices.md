# Best Practices

Guidelines for effective Zagora usage.

## Procedure Design

### Keep Procedures Focused

Each procedure should do one thing well:

```ts
// Good - single responsibility
const validateEmail = zagora()
  .input(z.string())
  .handler((_, email) => isValidEmail(email))
  .callable();

// Bad - multiple responsibilities
const processUser = zagora()
  .input(z.object({ email: z.string(), name: z.string() }))
  .handler((_, input) => {
    // Validation, creation, notification - too much
    validate(input);
    const user = db.create(input);
    sendWelcomeEmail(user);
    return user;
  })
  .callable();
```

### Use Meaningful Names

Name procedures clearly:

```ts
// Good
const createUserAccount = zagora()...
const validateUserCredentials = zagora()...

// Avoid
const proc1 = zagora()...
const doStuff = zagora()...
```

## Error Handling

While Zagora supports both `return`-ing and `throw`-ing errors from handlers, it’s recommended to always throw, whether a normal `throw new Error` or using typed error helpers like `throw errors.NOT_FOUND`!

### Define Specific Errors

Use descriptive error types:

```ts
const getUser = zagora()
  .context({ db: myProdDatabase })
  .errors({
    NOT_FOUND: z.object({ userId: z.string() }),
    UNAUTHORIZED: z.object({ reason: z.string() }),
    DATABASE_ERROR: z.object({ code: z.string() })
  })
  .handler(async ({ context, errors }, userId) => {
    let user;
    try {
      user = await context.db.find(userId);
    } catch (dbError) {
      throw errors.DATABASE_ERROR({ code: dbError.code });
    }
    
    if (!user) {
      throw errors.NOT_FOUND({ userId });
    }
    if (!user.active) {
      throw errors.UNAUTHORIZED({ reason: 'Account suspended' });
    }
    
    return user;
  })
  .callable();
```

### Handle Errors at Call Sites

Don't swallow errors - handle them appropriately:

```ts
// Good - explicit handling
const result = getUser(id);
if (!result.ok) {
  switch (result.error.kind) {
    case 'NOT_FOUND':
      return { status: 404, body: 'User not found' };
    case 'UNAUTHORIZED':
      return { status: 403, body: 'Access denied' };
    default:
      return { status: 500, body: 'Internal error' };
  }
}
return { status: 200, body: result.data };
```

## Validation

### Prefer Strict Schemas

Use strict validation to disallow extra properties:

```ts
// Good
.input(
  z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    age: z.number().int().min(0).max(150)
  }).strict() // Disallows extra properties
)  

// Avoid
.input(z.object({
  name: z.string(),
  email: z.string(),
  age: z.number()
}))  // Too permissive
```

### Use Defaults Liberally

Provide sensible defaults:

```ts
.input(z.object({
  page: z.number().default(1),
  limit: z.number().default(10),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
}))
```

**NOTE:** You can also use `z.object({ ... }).default({ ... })`, but it is NOT recommended, avoid it!

## Performance

### Cache Expensive Operations

Use caching for costly computations, plug in either JavaScript's `Map`, or a Redis-like caching solution:

```ts
const expensiveCalc = zagora()
  .cache(new Map())
  .input(z.number())
  .handler((_, n) => fibonacci(n))  // Expensive
  .callable();
```

### Avoid Async When Possible

Use sync procedures for performance:

```ts
// Good - sync for simple operations
const add = zagora()
  .input(z.tuple([z.number(), z.number()]))
  .handler((_, a, b) => a + b)  // Sync
  .callable();

// Only async when necessary
const fetchUser = zagora()
  .context({ db: myProdDB })
  .input(z.string())
  .handler(async ({ context }, id) => await context.db.find(id))  // Async
  .callable();
```

## Testing

### Test Both Success and Failure

Cover all paths:

```ts
describe('getUser', () => {
  it('returns user on success', () => {
    const result = getUser('valid-id');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockUser);
    } else {
      // make sure to fail if it's not expected outcome
      expect.fail("expects a success");
    }
  });

  it('returns NOT_FOUND for missing user', () => {
    const result = getUser('missing-id');
    expect(result.ok).toBe(false);
    if (result.error) {
      expect(result.error.kind).toBe('NOT_FOUND');
    } else {
      // make sure to fail if it's not expected outcome
      expect.fail("unexpected success");
    }
  });
});
```

### Mock Dependencies

Use context for testable procedures:

```ts
// Testable procedure
const createUser = zagora()
  .context({ db: defaultDb, emailService: defaultEmail })
  .input(z.object({ name: z.string(), email: z.email() }))
  .handler(async ({ context }, input) => {
    const user = await context.db.create(input);
    await context.emailService.sendWelcome(user.email);
    return user;
  });

// In tests
const createUserFn = createUser.callable({
  context: { db: mockDb, emailService: mockEmail }
})

createUserFn(input);
```

## Related

- [Procedures](../core/procedures.md): Builder API basics
- [Error Handling](../error-handling/never-throwing-guarantees.md): Error handling patterns
- [Caching & Memoization](../advanced/caching-memoization.md): Performance optimization
