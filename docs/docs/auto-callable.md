---
description: "Simplified API without .callable(). Auto-callable mode lets you skip the `."
head:
  - - meta
    - property: og:description
      content: "Simplified API without .callable(). Auto-callable mode lets you skip the `."
---

# Auto-Callable Mode


Auto-callable mode lets you skip the `.callable()` step for a cleaner API.

## Enabling Auto-Callable

Pass `autoCallable: true` to the zagora config:

```ts
import { z } from 'zod';
import { zagora } from 'zagora';

const greet = zagora({ autoCallable: true })
  .input(z.string())
  .handler((_, name) => `Hello, ${name}!`);
  // No .callable() needed!

const result = greet('World');
// { ok: true, data: 'Hello, World!' }
```

## Comparison

### Standard Mode

```ts
const add = zagora()
  .input(z.tuple([z.number(), z.number()]))
  .handler((_, a, b) => a + b)
  .callable();  // Required

add(1, 2);
```

### Auto-Callable Mode

```ts
const add = zagora({ autoCallable: true })
  .input(z.tuple([z.number(), z.number()]))
  .handler((_, a, b) => a + b);
  // No .callable()

add(1, 2);
```

## Combining with disableOptions

For the cleanest API, combine with `disableOptions`:

```ts
const add = zagora({ autoCallable: true, disableOptions: true })
  .input(z.tuple([z.number(), z.number()]))
  .handler((a, b) => a + b);  // No options object!

add(1, 2);  // { ok: true, data: 3 }
```

Compare the handler signatures:

```ts
// Standard
.handler((options, a, b) => a + b)

// disableOptions: true
.handler((a, b) => a + b)
```

## Providing Runtime Options

With auto-callable, provide runtime options differently:

### Context

```ts
const proc = zagora({ autoCallable: true })
  .context({ db: defaultDb })  // Initial context here
  .input(z.string())
  .handler(({ context }, id) => context.db.find(id));
```

### Env Vars

```ts
const proc = zagora({ autoCallable: true })
  .env(
    z.object({ API_KEY: z.string() }),
    process.env as any  // Pass as second argument to .env()
  )
  .handler(({ env }) => env.API_KEY);
```

### Cache

```ts
const cache = new Map();

const proc = zagora({ autoCallable: true })
  .cache(cache)  // Provide at definition time
  .input(z.string())
  .handler((_, input) => expensiveOperation(input));
```

## Trade-offs

### Advantages

- Cleaner API for simple procedures
- Less boilerplate
- Natural function-like exports

### Disadvantages

- No runtime override of context/cache/env
- Must provide all dependencies at definition time
- Less flexibility for testing (can't swap dependencies)

## When to Use

**Use auto-callable when:**
- Building simple utility functions
- Dependencies are known at definition time
- You want the cleanest possible API

**Use standard mode when:**
- You need to override context per-call
- Testing with mock dependencies
- Different environments need different config

## Pattern: Library Export

```ts
// lib/validators.ts
import { z } from 'zod';
import { zagora } from 'zagora';

const za = zagora({ autoCallable: true, disableOptions: true });

export const validateEmail = za
  .input(z.string().email())
  .handler((email) => ({ valid: true, normalized: email.toLowerCase() }));

export const validatePhone = za
  .input(z.string().regex(/^\+?[1-9]\d{1,14}$/))
  .handler((phone) => ({ valid: true, normalized: phone.replace(/\D/g, '') }));

// Usage
import { validateEmail, validatePhone } from './lib/validators';

const email = validateEmail('Test@Example.com');
const phone = validatePhone('+1-555-123-4567');
```

## Next Steps

- [Handler Options](/docs/handler-options) - Understanding the options object
- [Procedures](/docs/procedures) - Full builder API reference
