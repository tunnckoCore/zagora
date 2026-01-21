---
description: "Auto-fill missing arguments. Zagora automatically applies schema defaults at runtime, ensuring handlers always receive complete data."
head:
  - - meta
    - property: og:description
      content: "Auto-fill missing arguments. Zagora automatically applies schema defaults at runtime, ensuring handlers always receive complete data."
---

# Default Values


Zagora automatically applies schema defaults at runtime, ensuring handlers always receive complete data.

## How Defaults Work

When you define a schema with `.default()`, Zagora fills in missing values:

```ts
import { z } from 'zod';
import { zagora } from 'zagora';

const createPost = zagora()
  .input(z.object({
    title: z.string(),
    published: z.boolean().default(false),
    views: z.number().default(0)
  }))
  .handler((_, input) => {
    // input.published: boolean (not boolean | undefined!)
    // input.views: number (not number | undefined!)
    return input;
  })
  .callable();

createPost({ title: 'Hello' });
// { ok: true, data: { title: 'Hello', published: false, views: 0 } }
```

## Defaults in Tuple Arguments

Defaults work seamlessly with tuple inputs:

```ts
const greet = zagora()
  .input(z.tuple([
    z.string(),                  // Required
    z.string().default('Hello'), // Default greeting
    z.number().default(1)        // Default count
  ]))
  .handler((_, name, greeting, count) => {
    // greeting: string (never undefined!)
    // count: number (never undefined!)
    return `${greeting} ${name}!`.repeat(count);
  })
  .callable();

greet('World');              // 'Hello World!'
greet('World', 'Hi');        // 'Hi World!'
greet('World', 'Hey', 3);    // 'Hey World!Hey World!Hey World!'
```

## Default vs Optional

These behave differently:

```ts
// Default - value is guaranteed
z.number().default(0)
// Handler receives: number (never undefined)

// Optional - value may be undefined
z.number().optional()
// Handler receives: number | undefined
```

Choose defaults when you need a guaranteed value:

```ts
const paginate = zagora()
  .input(z.object({
    page: z.number().default(1),      // Always has a value
    limit: z.number().default(10),    // Always has a value
    filter: z.string().optional()     // May be undefined
  }))
  .handler((_, { page, limit, filter }) => {
    // No need to check if page/limit exist
    const offset = (page - 1) * limit;
    return { offset, limit, filter };
  })
  .callable();
```

## Dynamic Defaults

Use functions for dynamic default values:

```ts
const createRecord = zagora()
  .input(z.object({
    name: z.string(),
    createdAt: z.date().default(() => new Date()),
    id: z.string().default(() => crypto.randomUUID())
  }))
  .handler((_, input) => input)
  .callable();

createRecord({ name: 'Test' });
// { name: 'Test', createdAt: Date, id: 'uuid-...' }
```

## Nested Defaults

Defaults work at any nesting level:

```ts
const createUser = zagora()
  .input(z.object({
    name: z.string(),
    settings: z.object({
      theme: z.string().default('light'),
      notifications: z.object({
        email: z.boolean().default(true),
        push: z.boolean().default(false)
      }).default({})
    }).default({})
  }))
  .handler((_, input) => input)
  .callable();

createUser({ name: 'Alice' });
// {
//   name: 'Alice',
//   settings: {
//     theme: 'light',
//     notifications: { email: true, push: false }
//   }
// }
```

## TypeScript Behavior

Zagora correctly infers non-undefined types for defaults:

```ts
const proc = zagora()
  .input(z.tuple([
    z.string(),
    z.number().default(10)
  ]))
  .handler((_, name, count) => {
    // name: string
    // count: number (NOT number | undefined)
    
    // TypeScript knows count is always defined
    return name.repeat(count);
  })
  .callable();
```

## Defaults in Output Schemas

Defaults also work in output schemas:

```ts
const getUser = zagora()
  .input(z.string())
  .output(z.object({
    name: z.string(),
    role: z.string().default('user')
  }))
  .handler((_, id) => {
    // Can return without role, default applies
    return { name: 'Alice' };
  })
  .callable();
```

## Next Steps

- [Tuple Arguments](/docs/tuple-arguments) - Multiple function arguments
- [Input Validation](/docs/input-validation) - All input types
