# vs Standalone Validators

Zagora vs Zod/Valibot alone: when to add procedure management.

## Feature Comparison

| Feature | Standalone Validator | Zagora |
|---------|----------------------|--------|
| Validation | Yes | Yes |
| Error Handling | Throws or returns | Never throws |
| Handler Integration | Manual | Built-in |
| Async Support | Manual | Automatic |
| Context Injection | Manual | Built-in |
| Caching | Manual | Built-in |
| Environment Vars | Manual | Built-in |

## Key Differences

### Procedure Management

With standalone validators, you have to manually handle with `schema.parse` or `schema.safeParse`

```ts
const validateUser = z.object({
  name: z.string().min(1),
  email: z.string().email()
});

function createUser(input: unknown) {
  const result = validateUser.safeParse(input);
  if (!result.success) {
    throw new Error('Validation failed');
  }
  return db.create(result.data);
}
```

with zagora, you just write functions

```ts
const createUser = zagora()
  .input(z.object({
    name: z.string().min(1),
    email: z.string().email()
  }))
  .handler((_, input) => db.create(input))
  .callable();

const result = createUser(input);
if (!result.ok) {
  // Handle validation error
}
```

### Error Handling

Standalone - inconsistent error handling

```ts
function process(input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Sometimes throw
    throw new Error(JSON.stringify(result.error.issues));
  }
  // Sometimes return
  return { success: false, errors: result.error.issues };
}
```

Zagora - consistent error results
 
```ts
const process = zagora()
  .input(schema)
  .handler((_, input) => doWork(input))
  .callable();

// Always returns { ok, data, error }
const result = process(input);
```

## When to Use Each

### Use Standalone Validators when:

* You only need validation, no procedures
* Building custom validation logic
* You have existing error handling patterns
* Performance-critical validation only

### Use Zagora when:

* You want validation + procedure management
* You need consistent error handling
* You're building APIs or libraries
* You want dependency injection and caching

## Integration

Zagora uses StandardSchema - works with any compliant validator:

```ts
// Use Zod
.input(z.object({ name: z.string() }))

// Use Valibot
.input(v.object({ name: v.string() }))

// Use ArkType
.input(type({ name: 'string' }))
```

Zagora is validator-agnostic - choose your favorite validation library.
