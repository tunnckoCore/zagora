# Async Support

Zagora dynamically infers whether a procedure is sync or async based on your handler and schemas.

## Automatic Inference

#### Sync Handler = Sync Result

```ts
const add = zagora()
  .input(z.tuple([z.number(), z.number()]))
  .handler((_, a, b) => a + b)  // Sync handler
  .callable();

const result = add(1, 2);  // ZagoraResult<number> (not Promise!)
console.log(result.data);  // 3
```

#### Async Handler = Async Result

```ts
const fetchUser = zagora()
  .input(z.string())
  .handler(async (_, id) => {  // Async handler
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  })
  .callable();

const result = await fetchUser('123');  // Promise<ZagoraResult<User>>
console.log(result.data);
```

## Why This Matters

Unlike oRPC/tRPC where everything is async, Zagora preserves synchronicity:

```ts
// oRPC/tRPC - always async, even for sync operations
const result = await add({ a: 1, b: 2 });

// Zagora - sync when possible
const result = add(1, 2);  // No await needed!
```

This matters for:
* Library APIs that should be sync
* Performance-sensitive code
* Simpler call sites

## Async Schemas

If your schema has async validation, the procedure becomes async:

```ts
const createUser = zagora()
  .input(z.object({
    email: z.string().refine(
      async (email) => await isUniqueEmail(email),
      'Email already exists'
    )
  }))
  .handler((_, input) => input)  // Sync handler
  .callable();

// Must await due to async schema validation
const result = await createUser({ email: 'test@example.com' });
```

## Async Cache

If your cache adapter has async methods, the procedure becomes async:

```ts
const proc = zagora()
  .cache(redisCache)  // has async .has() and .get()
  .input(z.string())
  .handler((_, input) => expensiveSync(input))
  .callable();

// Must await due to async cache
const result = await proc('key');
```

**NOTE: If any of the cache adapter methods are async, then the whole procedure becomes async too and MUST BE awaited at callsite!**

## Mixed Sync/Async

You can have both sync and async procedures in the same codebase:

```ts
// Sync - for simple operations
const validate = zagora()
  .input(z.string().email())
  .handler((_, email) => ({ valid: true, email }))
  .callable();

// Async - for I/O operations
const sendEmail = zagora()
  .input(z.object({ to: z.string(), body: z.string() }))
  .handler(async (_, { to, body }) => {
    await emailService.send(to, body);
    return { sent: true };
  })
  .callable();

// Use them appropriately
const validation = validate('test@example.com');  // Sync
const sent = await sendEmail({ to: 'test@example.com', body: 'Hi' });  // Async
```

## Type Inference

TypeScript correctly infers the result type:

```ts
const syncProc = zagora()
  .input(z.number())
  .handler((_, n) => n * 2)
  .callable();

const asyncProc = zagora()
  .input(z.number())
  .handler(async (_, n) => n * 2)
  .callable();

// TypeScript infers:
type SyncResult = ReturnType<typeof syncProc>;    // ZagoraResult<number>
type AsyncResult = ReturnType<typeof asyncProc>;  // Promise<ZagoraResult<number>>
```

Use sync procedures for performance, async for I/O.
