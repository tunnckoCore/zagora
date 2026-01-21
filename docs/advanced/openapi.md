---
description: "API documentation from Zagora procedures. Zagora doesn't include built-in OpenAPI generation, but you can easily create OpenAPI specs using native JSON Schema conversion."
head:
  - - meta
    - property: og:description
      content: "API documentation from Zagora procedures. Zagora doesn't include built-in OpenAPI generation, but you can easily create OpenAPI specs using native JSON Schema conversion."
---

# Generating OpenAPI


Zagora doesn't include built-in OpenAPI generation, but you can easily create OpenAPI specs using native JSON Schema conversion. Modern validators like Zod v4, Valibot, and ArkType all provide built-in conversion - no extra libraries needed.

## Why DIY OpenAPI?

Zagora focuses on being minimal and unopinionated. Rather than bundling OpenAPI generation (which adds dependencies and constraints), we show you how to build exactly what you need using standard tools.

**Benefits:**
- Use any OpenAPI version (3.0, 3.1)
- Customize output format
- Integrate with your existing tooling
- No extra dependencies in Zagora core

## StandardJSONSchema

The [StandardSchema](https://standardschema.dev) project includes a **StandardJSONSchema** specification that defines a standard interface for JSON Schema conversion. Libraries implementing this spec expose `~standard.jsonSchema.input()` and `~standard.jsonSchema.output()` methods.

This means you can write generic conversion code that works with any compliant validator:

```ts
// Generic JSON Schema extraction (works with any StandardJSONSchema-compliant library)
function toJsonSchema(schema, options = { target: 'draft-2020-12' }) {
  if (schema['~standard']?.jsonSchema) {
    return schema['~standard'].jsonSchema.output(options);
  }
  throw new Error('Schema does not support JSON Schema conversion');
}
```

## Converting Schemas to JSON Schema

### With Zod v4

Zod v4 includes native JSON Schema conversion via `z.toJSONSchema()`:

```ts
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  age: z.int().min(0).optional(),
});

// Native Zod v4 conversion
const jsonSchema = z.toJSONSchema(userSchema);
// {
//   type: 'object',
//   properties: {
//     name: { type: 'string', minLength: 1 },
//     email: { type: 'string', format: 'email' },
//     age: { type: 'integer', minimum: 0 }
//   },
//   required: ['name', 'email'],
//   additionalProperties: false
// }

// Target specific JSON Schema version
z.toJSONSchema(userSchema, { target: 'openapi-3.0' });
z.toJSONSchema(userSchema, { target: 'draft-07' });
z.toJSONSchema(userSchema, { target: 'draft-2020-12' });
```

See the [Zod JSON Schema docs](https://zod.dev/json-schema) for full options including handling unrepresentable types, cycles, and metadata.

### With Valibot

Valibot provides `@valibot/to-json-schema`:

```ts
import * as v from 'valibot';
import { toJsonSchema } from '@valibot/to-json-schema';

const userSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  email: v.pipe(v.string(), v.email()),
  age: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
});

const jsonSchema = toJsonSchema(userSchema);
```

### With ArkType

ArkType has built-in `toJsonSchema()`:

```ts
import { type } from 'arktype';

const userSchema = type({
  name: 'string>0',
  email: 'email',
  'age?': 'integer>=0',
});

const jsonSchema = userSchema.toJsonSchema();
```

## Pattern: Example OpenAPI Generator (for Zod v4+)

Create a utility that extracts schemas from Zagora procedures. Zagora stores all metadata in `procedure["~zagora"]`:

```ts
import { z } from 'zod';

// Helper to extract OpenAPI operation from procedure metadata
function procedureToOperation(name, procedure, options = {}) {
  const { method = 'post', path, description, tags = [] } = options;
  
  // Access Zagora's internal metadata
  const meta = procedure["~zagora"];
  const inputSchema = meta.inputSchema;
  const outputSchema = meta.outputSchema;
  const errorsMap = meta.errorsMap;
  
  const operation = {
    operationId: name,
    description,
    tags,
  };

  // Add request body if procedure has input schema
  if (inputSchema) {
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: z.toJSONSchema(inputSchema, { target: 'openapi-3.0' }),
        },
      },
    };
  }

  // Add response schemas
  operation.responses = {
    '200': {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: outputSchema 
            ? z.toJSONSchema(outputSchema, { target: 'openapi-3.0' })
            : { type: 'object' },
        },
      },
    },
    '400': {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['VALIDATION_ERROR'] },
              message: { type: 'string' },
              issues: { type: 'array' },
            },
          },
        },
      },
    },
  };

  // Add custom error responses
  if (errorsMap) {
    for (const [errorKind, errorSchema] of Object.entries(errorsMap)) {
      const statusCode = getStatusCodeForError(errorKind);
      const errorJsonSchema = z.toJSONSchema(errorSchema, { target: 'openapi-3.0' });
      operation.responses[statusCode] = {
        description: errorKind,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: [errorKind] },
                ...errorJsonSchema.properties,
              },
            },
          },
        },
      };
    }
  }

  return { [path]: { [method]: operation } };
}

function getStatusCodeForError(kind) {
  const mapping = {
    NOT_FOUND: '404',
    UNAUTHORIZED: '401',
    FORBIDDEN: '403',
    RATE_LIMIT: '429',
    CONFLICT: '409',
  };
  return mapping[kind] || '400';
}
```

## Pattern: Router to OpenAPI

Generate a complete OpenAPI spec from a router object:

```ts
function routerToOpenAPI(router, options = {}) {
  const { 
    title = 'API',
    version = '1.0.0',
    description = '',
    servers = [{ url: 'http://localhost:3000' }],
  } = options;

  const spec = {
    openapi: '3.1.0',
    info: { title, version, description },
    servers,
    paths: {},
    components: { schemas: {} },
  };

  // Walk the router and extract procedures
  function walkRouter(obj, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const path = `${prefix}/${key}`;
      
      // Check if it's a Zagora procedure by looking for the ~zagora metadata
      if (typeof value === 'function' && value["~zagora"].inputSchema) {
        const operation = procedureToOperation(key, value, {
          path,
          method: 'post',
          tags: [prefix.split('/')[1] || 'default'],
        });
        Object.assign(spec.paths, operation);
      } else if (typeof value === 'object') {
        // Nested router
        walkRouter(value, path);
      }
    }
  }

  walkRouter(router);
  return spec;
}

// Usage
const openAPISpec = routerToOpenAPI(appRouter, {
  title: 'My API',
  version: '1.0.0',
  description: 'API built with Zagora',
});

// Write to file
import { writeFileSync } from 'fs';
writeFileSync('openapi.json', JSON.stringify(openAPISpec, null, 2));
```

## Accessing Procedure Metadata

Zagora stores all procedure metadata in the `["~zagora"]` property. Here's what's available:

```ts
// After building a procedure (before .callable())
const builder = zagora()
  .input(z.object({ id: z.string() }))
  .output(z.object({ name: z.string() }))
  .errors({ NOT_FOUND: z.object({ id: z.string() }) })
  .handler(async (_, input) => { /* ... */ });

// Access metadata from the builder
const meta = builder["~zagora"];
meta.inputSchema;      // The input schema
meta.outputSchema;     // The output schema  
meta.errorsMap;        // Map of error schemas { NOT_FOUND: schema, ... }
meta.envVarsMapSchema; // Environment variables schema
meta.cacheAdapter;     // Cache adapter if set
meta.initialContext;   // Initial context if set
meta.handler;          // The handler function
```

This metadata is preserved on the callable procedure too, making it easy to introspect for documentation generation.

For example:

```ts
const meta = builder["~zagora"];
const someProc = builder.callable({ context: { foo: 123 }});

const someProcMeta = someProc['~zagora'];

someProcMeta.inputSchema; // same as meta.inputSchema
someProcMeta.outputSchema; // same as meta.outputSchema
// and so on
````

## Pattern: HTTP Framework Integration

Combine with your HTTP framework for automatic route generation:

```ts
import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';

const app = new Hono();

// Generate spec from router
const spec = routerToOpenAPI(appRouter, { title: 'My API' });

// Serve OpenAPI spec
app.get('/openapi.json', (c) => c.json(spec));

// Serve Swagger UI
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

// Auto-generate routes from router
function mountRouter(app, router, prefix = '') {
  for (const [key, value] of Object.entries(router)) {
    const path = `${prefix}/${key}`;
    
    if (typeof value === 'function') {
      app.post(path, async (c) => {
        const input = await c.req.json();
        const result = await value(input);
        
        if (result.ok) {
          return c.json(result.data);
        }
        
        const status = getStatusCodeForError(result.error.kind);
        return c.json(result.error, parseInt(status));
      });
    } else if (typeof value === 'object') {
      mountRouter(app, value, path);
    }
  }
}

mountRouter(app, appRouter);
```

## Complete Example

```ts
import { z } from 'zod';
import { zagora } from 'zagora';
import { Hono } from 'hono';

// Define procedures
const createUser = zagora()
  .input(z.object({
    name: z.string().min(1),
    email: z.email(),
  }))
  .output(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }))
  .errors({
    CONFLICT: z.object({ message: z.string() }),
  })
  .handler(async ({ errors }, input) => {
    if (await db.users.exists({ email: input.email })) {
      throw errors.CONFLICT({ message: 'Email already registered' });
    }
    return db.users.create(input);
  })
  .callable();

const getUser = zagora()
  .input(z.object({ id: z.string() }))
  .output(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }))
  .errors({
    NOT_FOUND: z.object({ id: z.string() }),
  })
  .handler(async ({ errors }, { id }) => {
    const user = await db.users.find(id);
    if (!user) throw errors.NOT_FOUND({ id });
    return user;
  })
  .callable();

// Group into router
const userRouter = {
  create: createUser,
  get: getUser,
};

const appRouter = {
  users: userRouter,
};

// Generate OpenAPI spec using Zod v4's native conversion
const spec = routerToOpenAPI(appRouter, {
  title: 'User API',
  version: '1.0.0',
});

// Serve with Hono
const app = new Hono();
app.get('/openapi.json', (c) => c.json(spec));
mountRouter(app, appRouter);

export default app;
```

## When to Use This Pattern

**Good for:**
- Internal APIs that need documentation
- Generating client SDKs from specs
- Teams familiar with OpenAPI tooling
- Gradual migration from other frameworks

**Consider oRPC instead when:**
- You need production-ready OpenAPI generation out of the box
- You want contract-first development
- You need advanced OpenAPI features (callbacks, links, etc.)

Zagora's DIY approach gives you full control over the output, but requires more setup. For complex public APIs with extensive documentation needs, dedicated API frameworks may be more appropriate.
