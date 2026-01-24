# Environment Variables

Zagora lets you inject and validate environment variables with the same schema system used for inputs and outputs.

**IMPORTANT: Make sure to assert with `as any` when you provide `process.env` or `import.meta.env` because if you don't, then TypeScript will report an error since the environment variables will never match your provided schema!**

## Basic Usage

Use `.env(schema, processEnv?)` to define and validate environment variables, pass `process.env` or `import.meta.env` as the second argument.

```ts
const apiCall = zagora()
  .env(z.object({
    API_KEY: z.string().min(1),
    API_URL: z.string().url(),
    TIMEOUT: z.coerce.number().default(5000),
    // NOTE: requires length >1 when provided, but it is also optional!
    DATABASE_URL: z.string().min(1).optional()
  }), process.env as any)
  .input(z.string())
  .handler(({ env }, endpoint) => {
    return fetch(`${env.API_URL}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${env.API_KEY}` },
      signal: AbortSignal.timeout(env.TIMEOUT)
    });
  })
  .callable();
```

## Providing Env at Runtime

Pass environment variables via `.callable()`:

```ts
const proc = zagora()
  .env(z.object({
    DATABASE_URL: z.string()
  }))
  .handler(({ env }) => connectToDatabase(env.DATABASE_URL))
  .callable({ env: process.env as any });
```

**IMPORTANT:** Use `as any` when passing `process.env` or `import.meta.env` because they have different types than your schema.

## Coercion

Use `.coerce` to convert string env vars to proper types:

```ts
.env(z.object({
  PORT: z.coerce.number(),
  DEBUG: z.stringbool(),
  TIMEOUT: z.coerce.number().default(5000)
}))
```

## Default Values

Defaults work as expected:

```ts
.env(z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  MAX_RETRIES: z.coerce.number().default(3)
}))
```

## Optional Env Vars

Use your schema's `.optional()` for truly optional variables:

```ts
.env(z.object({
  API_KEY: z.string(),
  SECONDARY_KEY: z.string().min(1).optional()
}))
.handler(({ env }) => {
  // env.API_KEY: string
  // env.SECONDARY_KEY: string | undefined
})
```

## Env Validation Errors

Invalid env vars result in a `VALIDATION_ERROR`:

```ts
const proc = zagora()
  .env(z.object({
    PORT: z.coerce.number().min(1).max(65535)
  }))
  .handler(({ env }) => env.PORT)
  // NOTICE: the PORT will also be reported/underlined by TypeScript! 
  .callable({ env: { PORT: 'invalid' } });

const result = proc();
// result.ok === false
// result.error.kind === 'VALIDATION_ERROR'
```

## With autoCallable

When using `autoCallable` mode, provide env vars as the second argument to `.env()`:

```ts
const proc = zagora({ autoCallable: true })
  .env(
    z.object({ API_KEY: z.string() }),
    process.env as any  // Second argument: runtime env
  )
  .input(z.string())
  .handler(({ env }, input) => {
    return fetch(`/api/${input}`, {
      headers: { 'X-API-Key': env.API_KEY }
    });
  });

// Direct call - no .callable() needed
proc('users');
```

## If disableOptions is true

When `disableOptions: true` is set, the handler does NOT receive the `env` object. Don't use `disableOptions` if you want to have access to `context` / `env` / `errors`.

## Pattern: Environment Variables Config Loader Procedure

Create a config-loading procedure:

```ts
const getConfig = zagora()
  .env(z.object({
    DATABASE_URL: z.string(),
    REDIS_URL: z.string().optional(),
    JWT_SECRET: z.string().min(32),
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development')
  }))
  .handler(({ env }) => ({
    database: { url: env.DATABASE_URL },
    redis: env.REDIS_URL ? { url: env.REDIS_URL } : null,
    auth: { secret: env.JWT_SECRET },
    server: { port: env.PORT },
    env: env.NODE_ENV
  }))
  .callable({ env: process.env as any });

const config = getConfig();
if (config.ok) {
  startServer(config.data);
}
```

## Pattern: Per-Environment Config

```ts
const createApiClient = zagora()
  .env(z.object({
    API_URL: z.string().url(),
    API_KEY: z.string()
  }))
  .input(z.string())
  .handler(({ env }, endpoint) => {
    return fetch(`${env.API_URL}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${env.API_KEY}` }
    });
  });

// Production
const prodClient = createApiClient.callable({
  env: { API_URL: 'https://api.production.com', API_KEY: prodKey }
});

// Staging
const stagingClient = createApiClient.callable({
  env: { API_URL: 'https://api.staging.com', API_KEY: stagingKey }
});
```

Use environment variables to validate and type runtime configuration.
