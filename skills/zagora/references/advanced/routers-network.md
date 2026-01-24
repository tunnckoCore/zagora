# Routers and Network Patterns

Using Zagora procedures in modern network-bound APIs with fetch-like patterns.

## Users Router Example

Define a router with shared context and related procedures:

```ts
// ./src/lib/routers/users.ts
const db = myDatabase;
const cache = new Map();

const usersZagora = zagora().cache(cache).context({ db });

export const usersRouter = {
  get: usersZagora
    .input(z.string())
    .handler(async ({ context }, id) => context.db.find(id)),
    
  create: usersZagora
    .input(z.object({ name: z.string(), email: z.string() }))
    .handler(async ({ context }, input) => context.db.create(input)),
    
  update: usersZagora
    .input(z.tuple([z.string(), z.object({ name: z.string() })]))
    .handler(async ({ context }, id, updates) => context.db.update(id, updates)),
};
```

## Route Handler

Create a unified handler for the entire "users" router:

```ts
// assuming `@/` is `./src`
import { usersRouter } from "@/lib/routers/users.ts";

// Unified router handler
async function handleUsers(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;
  const pathParts = url.pathname.split('/');
  const id = pathParts[2]; // /users/:id

  try {
    let result;

    if (method === 'GET' && id) {
      result = await usersRouter.get.callable({ context: { req, url } })(id);
    } else if (method === 'POST') {
      const body = await req.json();
      result = await usersRouter.create.callable({ context: { req, url } })(body);
    } else if (method === 'PUT' && id) {
      const body = await req.json();
      result = await usersRouter.update.callable({ context: { req, url } })(id, body);
    } else {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (result.ok) {
      return new Response(JSON.stringify(result.data), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Handle procedure errors
      return new Response(JSON.stringify({ message: 'Operation failed', error: result.error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Usage in routing
app.all('/users/:id?', handleUsers);
```

## Middleware Integration

Use middleware to inject request-scoped context:

```ts
// Authentication middleware
async function authMiddleware(request: Request, next: () => Promise<Response>): Promise<Response> {
  // Authenticate user
  const user = await authenticate(request);
  
  // Add to request context
  (request as any).user = user;
  
  return next();
}

// Procedure with auth context
const getProfile = zagora()
  .context({ db: MY_DB })
  .errors({
    UNAUTHORIZED: z.object({ reason: z.string() }),
  })
  .handler(({ context, errors }) => {
    if (!context.req?.user) {
      throw errors.UNAUTHORIZED({ reason: 'Access denied' });
    }
    return context.db.findProfile(context.req.user.id);
  });

// Route with middleware
app.get('/profile', 
  authMiddleware,
  async (request: Request) => {
    const result = await getProfile.callable({
      context: { req: request }
    });
    
    if (result.ok) {
      return new Response(JSON.stringify(result.data), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ message: 'Profile not found', error: result.error }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
);
```

## Error Handling Middleware

Centralize error responses:

```ts
function handleZagoraResult(result: any): Response {
  if (result.ok) {
    return new Response(JSON.stringify(result.data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } else {
    const { error } = result;
    
    if (error.kind === 'VALIDATION_ERROR') {
      return new Response(JSON.stringify({
        message: 'Validation failed',
        error
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (error.kind === 'UNKNOWN_ERROR') {
      console.error(error.cause);
      return new Response(JSON.stringify({ message: 'Internal server error', error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Custom errors
      return new Response(JSON.stringify({
        message: 'Custom error thrown',
        error
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

// Usage in handler
app.get('/users/:id', async (request: Request) => {
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop();
  
  const result = await getUser(id);
  return handleZagoraResult(result);
});
```

## Caching for Network Calls

Cache external API responses with TTL and Redis adapter:

```ts
// Redis cache adapter
const redisCache = {
  async has(key: string) {
    return await redis.exists(key);
  },
  async get(key: string) {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : undefined;
  },
  async set(key: string, value: any) {
    await redis.set(key, JSON.stringify(value), 'EX', 300); // 5 min TTL
  }
};

const fetchUser = zagora({ autoCallable: true })
  .cache(redisCache)
  .input(z.string())
  .env(z.object({ API_URL: z.url() }), process.env as any)
  .handler(async ({ env }, id) => {
    const resp = await fetch(`${env.API_URL}/users/${id}`);
    if (!resp.ok) {
      throw new Error(`API error: ${resp.statusText}`);
    }
    
    return resp.json();
  })

// Cached calls
const result1 = await fetchUser('alice'); // Network call + cache
const result2 = await fetchUser('alice'); // Cache hit
```

## Related

- [Context Management](../advanced/context-management.md): Dependency injection
- [Caching & Memoization](../advanced/caching-memoization.md): Cache implementation details
- [Environment Variables](../advanced/environment-variables.md): Config management
- [Error Type Guards](../error-handling/error-type-guards.md): Error handling utilities
