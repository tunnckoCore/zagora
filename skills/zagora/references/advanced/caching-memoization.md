# Caching & Memoization

Zagora supports caching via an adapter interface, allowing you to memoize expensive operations. You can use it with `Map` or a Redis storage like Upstash.

## Basic Caching

Pass a Map or compatible cache to `.cache()`:

```ts
const cache = new Map();

const expensiveCalc = zagora()
  .cache(cache)
  .input(z.number())
  .handler((_, n) => {
    console.log('Computing...');
    return fibonacci(n);
  })
  .callable();

expensiveCalc(40);  // "Computing..." - cache miss
expensiveCalc(40);  // No log - cache hit!
```

## Cache Key Composition

Cache keys are computed from:
* Input values
* Input/output/error schemas
* Handler function body

This means:
* Same input, same handler = cache hit
* Same schemas = cache hit
* Different input or schemas = cache miss, cache invalidated
* Changed handler = all cache invalidated

### Manual Cache Invalidation

To manually invalidate cache entries:
* Change input values (even slightly)
* Modify input/output/error schemas
* Alter the handler function body (even a comment)
* Use different cache instances per request/environment

The cache is smart enough to detect changes automatically - you don't need explicit invalidation methods.

## Runtime Cache Override

Provide cache at call time via `.callable()`:

```ts
const calc = zagora()
  .input(z.number())
  .handler((_, n) => fibonacci(n))
  .callable({ cache: requestCache });
```

Create multiple callables with different caches:

```ts
const prodCalc = calc.callable({ cache: redisCache });
const testCalc = calc.callable({ cache: new Map() });
```

## Cache Adapter Interface

Any object with `has`, `get`, and `set` methods works:

```ts
interface CacheAdapter<K, V> {
  has(key: K): boolean | Promise<boolean>;
  get(key: K): V | undefined | Promise<V | undefined>;
  set(key: K, value: V): void | Promise<void>;
}
```

#### Sync Cache (Map)

```ts
const cache = new Map();
```

#### Async Cache (Redis-like)

```ts
const asyncRedisCache = {
  async has(key) { return await redis.exists(key); },
  async get(key) {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : undefined;
  },
  async set(key, value) { await redis.set(key, JSON.stringify(value)); }
};
```

**NOTE** If ANY of the cache methods is async then the procedure becomes async. Always `await` the procedure/result at callsite!

```ts
const calc = zagora()
  .cache(asyncRedisCache)
  .input(z.tuple([z.number(), z.number()]))
  .handler((opts, a, b) => a + b)
  .callable()

// NOTE: must always await, even though TypeScript may warn "you may not need to await here"
const result = await calc(1, 2);
````

## Cache with Errors

Failed executions are never cached:

```ts
const fetchUser = zagora()
  .cache(cache)
  .input(z.string())
  .errors({ NOT_FOUND: z.object({ id: z.string() }) })
  .handler(async ({ context, errors }, id) => {
    const user = await context.db.find(id);
    if (!user) throw errors.NOT_FOUND({ id });
    return user;
  })
  .callable({ context: { db: myProdDatabase }});

fetchUser('missing');  // NOT_FOUND error - not cached
fetchUser('missing');  // Will try again (not cached)

fetchUser('exists');   // Success - cached
fetchUser('exists');   // Cache hit!
```

## Cache Error Handling

If the cache adapter throws, you get an `UNKNOWN_ERROR`, for now - in future, we may have a dedicated error kind like `CACHE_ERROR`.

```ts
const cache = new Map();
const brokenCache = {
  has() { throw new Error('Failure in has call'); },
  get(key) { return cache.get(key) },
  set(key, val) { cache.set(key, val) }
};

const proc = zagora()
  .cache(brokenCache)
  .handler(() => 'result')
  .callable();

// result.error.kind === 'UNKNOWN_ERROR'
// result.error.cause === Error('Failure in has call')
```

## Pattern: Request-Scoped Cache

Use per-request caches to avoid leaking between requests:

```ts
const DB = myProdDB;

const getUser = zagora()
  .input(z.string())
  .handler(async ({ context }, id) => context.db.findUser(id));

// In request handler
app.get('/user/:id', (req, res) => {
  const requestCache = new Map();
  const proc = getUser.callable({ context: { db: DB }, cache: requestCache });
  
  // Multiple calls in same request share cache
  const user1 = await proc(req.params.id);
  const user2 = await proc(req.params.id);  // Cache hit
  
  // Cache is garbage collected after request
});
```

## Pattern: TTL Cache

Implement time-based expiration:

```ts
function createTTLCache(ttlMs) {
  const cache = new Map();
  
  return {
    has(key) {
      const entry = cache.get(key);
      if (!entry) {
        return false;
      }
      if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return false;
      }
      return true;
    },
    get(key) {
      const entry = cache.get(key);
      if (!entry || Date.now() > entry.expiresAt) {
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs
      });
    }
  };
}

const proc = zagora()
  .cache(createTTLCache(60000))  // 1 minute TTL
  .handler(() => expensiveOperation())
  .callable();
```

Use caching to improve performance of expensive operations.
