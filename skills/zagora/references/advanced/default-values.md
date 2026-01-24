# Default Values

Zagora automatically applies schema defaults at runtime, ensuring handlers always receive complete data.

## How Defaults Work

When you define a schema with `.default()`, Zagora fills in missing values:

```ts
const createPost = zagora()
  .input(z.object({
    title: z.string(),
    published: z.boolean().default(false),
    views: z.number().default(0)
  }))
  .handler((_, input) => input)
  .callable();

createPost({ title: 'Hello' });
// { ok: true, data: { title: 'Hello', published: false, views: 0 } }
```

## Defaults in Tuple Arguments

Defaults work seamlessly with tuple inputs:

```ts
const greet = zagora()
  .input(z.tuple([
    z.string(),
    z.string().default('Hello'),
    z.number().default(1)
  ]))
  .handler((_, name, greeting, count) => {
    return `${greeting} ${name}! `.repeat(count).trim();
  })
  .callable();

// NOTE: examples below omit the { ok, data, error } wrapper for brevity.
greet('World');              // => 'Hello World!'
greet('World', 'Hi');        // => 'Hi World!'
greet('World', 'Hey', 3);    // => 'Hey World! Hey World! Hey World!'
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
    page: z.number().default(1),
    limit: z.number().default(10),
    filter: z.string().optional()
  }))
  .handler((_, { page, limit, filter }) => {
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
// NOTE: examples below omit the { ok, data, error } wrapper for brevity.
// => { name: 'Test', createdAt: Date, id: 'uuid-...' }
```

## Nested Defaults

Defaults work at any nesting level, with the caveat that you should put the defaults at the most outer `.default`!

```ts
const createUser = zagora()
  .input(z.object({
    name: z.string(),
    settings: z.object({
      theme: z.string(),
      notifications: z.object({
        email: z.boolean(),
        push: z.boolean()
      })
    }).default({
      theme: 'light',
      notifications: {
        email: true,
        push: false,
      },
    })
  }))
  .handler((_, input) => input)
  .callable();

createUser({ name: 'Alice' });
// NOTE: example below omit the { ok, data, error } wrapper for brevity.
// => {
//   name: 'Alice',
//   settings: {
//     theme: 'light',
//     notifications: { email: true, push: false }
//   }
// }
```

**AVOID DOING IT LIKE SO**

```ts
.input(z.object({
  name: z.string(),
  settings: z.object({
    theme: z.string().default('light'),
    notifications: z.object({
      email: z.boolean().default(true),
      push: z.boolean().default(false),
    }).default({})
  }).default({})
}))
```

This above will not work as expected.

## TypeScript Behavior

Zagora correctly infers non-undefined types for defaults, just like TypeScript:

```ts
const proc = zagora()
  .input(z.tuple([
    z.string(),
    z.number().default(10),
    z.string().optional(),
  ]))
  .handler((_, name, count, state) => {
    // name: string
    // count: number -- and not `number | undefined` because it has a default value!
    // state: string | undefined -- because it is marked optional!
    return name.repeat(count);
  })
  .callable();
```

Use defaults to ensure handlers receive complete, validated data.
