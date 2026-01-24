# vs RPC Frameworks like oRPC/tRPC

Zagora vs RPC frameworks: when to choose local procedures over network APIs.

## Feature Comparison

| Feature | oRPC/tRPC | Zagora |
|---------|-----------|--------|
| Network Layer | Yes | No |
| Type Safety | Yes | Yes |
| Runtime Validation | Yes | Yes |
| Error Handling | Throws/returns | Never throws |
| Sync Support | No (always async) | Yes |
| Bundle Size | Large | Small |
| Setup Complexity | High | Low |

## Key Differences

### Network vs Local

```js
// tRPC - network calls
const appRouter = router({
  getUser: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.find(input.id);
    })
});

// Client
const user = await trpc.getUser.query({ id: 'foo' });
```

```js
// Zagora - local calls
const getUser = zagora()
  .input(z.object({ id: z.string() }))
  .handler(async (_, { id }) => {
    return db.find(id);
  })
  .callable();

const result = await getUser({ id: '123' });
if (result.ok) {
  // Use result.data
}
```

### Sync Procedures

tRPC - always async, even for sync operations

```js
const add = publicProcedure
  .input(z.tuple([z.number(), z.number()]))
  .query(async ({ input: [a, b] }) => a + b);

const result = await add.query([1, 2]);  // Always await
```

Zagora - sync when possible

```js
const add = zagora()
  .input(z.tuple([z.number(), z.number()]))
  .handler((_, a, b) => a + b)
  .callable();

const result = add(1, 2);  // No await needed!
```

### Error Handling

```js
// tRPC - throws on client, complex error handling
try {
  const user = await trpc.getUser.query({ id: 'missing' });
} catch (e) {
  // Network error or procedure error?
}
```

```js
// Zagora - structured local errors
const result = getUser({ id: 'missing' });
if (!result.ok) {
  // result.error is fully typed
}
```

## When to Use Each

### Use oRPC/tRPC when:

* You need network communication
* Building distributed systems
* You want auto-generated clients
* Multiple services/languages

### Use Zagora when:

* Procedures are local (same process)
* You want sync support
* Building libraries or internal APIs
* You prefer simple, direct calls

## Migration from tRPC

Replace tRPC procedures with Zagora procedures:

```js
// Before
export const getUser = publicProcedure
  .input(z.string())
  .query(({ input }) => db.find(input));

// After
export const getUser = zagora()
  .input(z.string())
  .handler((_, input) => db.find(input))
  .callable();
```

Zagora is tRPC for local procedures - same validation, better ergonomics.
