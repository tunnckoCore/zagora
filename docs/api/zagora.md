---
description: "Create a Zagora instance. The `zagora` function creates a builder instance for defining type-safe procedures."
head:
  - - meta
    - property: og:description
      content: "Create a Zagora instance. The `zagora` function creates a builder instance for defining type-safe procedures."
---

# zagora(config)

The `zagora` function creates a builder instance for defining type-safe procedures.

## Import

```ts
import { zagora } from 'zagora';
```

## Signature

```ts
function zagora(config?: ZagoraConfig): ZagoraBuilder
```

## Config Options

### autoCallable

Skip the `.callable()` step and return a callable function directly from `.handler()`.

```ts
const proc = zagora({ autoCallable: true })
  .input(z.string())
  .handler((_, name) => `Hello, ${name}!`);
  // No .callable() needed

proc('World');
```

**Type:** `boolean`  
**Default:** `false`

### disableOptions

Omit the options object from the handler signature.

```ts
const proc = zagora({ disableOptions: true })
  .input(z.tuple([z.number(), z.number()]))
  .handler((a, b) => a + b)  // No options object
  .callable();
```

**Type:** `boolean`  
**Default:** `false`

:::warning
When `disableOptions` is `true`, the handler cannot access `context`, `errors`, or `env`.
:::

## Combining Options

```ts
const za = zagora({ autoCallable: true, disableOptions: true });

const add = za
  .input(z.tuple([z.number(), z.number()]))
  .handler((a, b) => a + b);

add(1, 2);  // { ok: true, data: 3 }
```

## Return Value

Returns a `ZagoraBuilder` instance with the following methods:

| Method | Description |
|--------|-------------|
| `.input(schema)` | Define input validation schema |
| `.output(schema)` | Define output validation schema |
| `.errors(map)` | Define typed error schemas |
| `.context(initial)` | Set initial context |
| `.env(schema, runtime?)` | Define env var schema |
| `.cache(adapter)` | Set cache adapter |
| `.handler(fn)` | Define the handler function |
| `.callable(options?)` | Create the callable function |

## Examples

### Basic Usage

```ts
const greet = zagora()
  .input(z.string())
  .handler((_, name) => `Hello, ${name}!`)
  .callable();
```

### With All Options

```ts
const createUser = zagora()
  .context({ db: myDatabase })
  .env(z.object({ API_KEY: z.string() }))
  .input(z.object({ name: z.string(), email: z.string() }))
  .output(z.object({ id: z.string(), name: z.string() }))
  .errors({
    ALREADY_EXISTS: z.object({ email: z.string() })
  })
  .cache(new Map())
  .handler(async ({ context, errors, env }, input) => {
    const existing = await context.db.findByEmail(input.email);
    if (existing) {
      throw errors.ALREADY_EXISTS({ email: input.email });
    }
    return context.db.create(input);
  })
  .callable({ env: process.env as any });
```

### Reusable Instance

```ts
const za = zagora({ autoCallable: true, disableOptions: true });

export const validators = {
  email: za.input(z.string().email()).handler((email) => email.toLowerCase()),
  phone: za.input(z.string()).handler((phone) => phone.replace(/\D/g, '')),
  url: za.input(z.string().url()).handler((url) => new URL(url).href)
};
```

## See Also

- [Instance Methods](/api/methods) - All builder methods
- [Procedures](/docs/procedures) - Building procedures
