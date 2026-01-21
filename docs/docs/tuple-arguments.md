---
description: "Natural function signatures with multiple arguments. Zagora's tuple argument support lets you define procedures with multiple arguments that feel like native TypeScript functions."
head:
  - - meta
    - property: og:description
      content: "Natural function signatures with multiple arguments. Zagora's tuple argument support lets you define procedures with multiple arguments that feel like native TypeScript functions."
---

# Tuple Arguments


Zagora's tuple argument support lets you define procedures with multiple arguments that feel like native TypeScript functions.

## Basic Tuple Input

Use `z.tuple([...])` to define multiple arguments:

```ts
import { z } from 'zod';
import { zagora } from 'zagora';

const add = zagora()
  .input(z.tuple([z.number(), z.number()]))
  .handler((_, a, b) => a + b)
  .callable();

// Call like a normal function
add(5, 10);  // { ok: true, data: 15 }
```

Compare to oRPC/tRPC style:

```ts
// Zagora - natural function signature
add(5, 10);

// oRPC/tRPC - always object input
add({ a: 5, b: 10 });
```

## Argument Spreading

Tuple elements are spread as handler arguments:

```ts
const greet = zagora()
  .input(z.tuple([z.string(), z.string(), z.number()]))
  .handler((_, firstName, lastName, age) => {
    return `Hello, ${firstName} ${lastName}! You are ${age}.`;
  })
  .callable();

greet('John', 'Doe', 30);
// { ok: true, data: 'Hello, John Doe! You are 30.' }
```

## Default Values

Use `.default()` to make arguments optional with defaults:

```ts
const createUser = zagora()
  .input(z.tuple([
    z.string(),                      // name - required
    z.number().default(18),          // age - optional, defaults to 18
    z.string().default('user')       // role - optional, defaults to 'user'
  ]))
  .handler((_, name, age, role) => {
    // age: number (never undefined!)
    // role: string (never undefined!)
    return { name, age, role };
  })
  .callable();

createUser('Alice');              // { name: 'Alice', age: 18, role: 'user' }
createUser('Bob', 25);            // { name: 'Bob', age: 25, role: 'user' }
createUser('Carol', 30, 'admin'); // { name: 'Carol', age: 30, role: 'admin' }
```

## Optional Arguments

Use `.optional()` for truly optional arguments:

```ts
const greet = zagora()
  .input(z.tuple([
    z.string(),              // name - required
    z.string().optional()    // title - optional (can be undefined)
  ]))
  .handler((_, name, title) => {
    // title: string | undefined
    return title ? `${title} ${name}` : name;
  })
  .callable();

greet('Alice');           // 'Alice'
greet('Bob', 'Dr.');      // 'Dr. Bob'
```

## Mixed Required, Default, and Optional

Combine all three patterns:

```ts
const search = zagora()
  .input(z.tuple([
    z.string(),                    // query - required
    z.number().default(1),         // page - default 1
    z.number().default(10),        // limit - default 10
    z.string().optional()          // sortBy - optional
  ]))
  .handler((_, query, page, limit, sortBy) => {
    // query: string
    // page: number (never undefined)
    // limit: number (never undefined)
    // sortBy: string | undefined
    return db.search(query, { page, limit, sortBy });
  })
  .callable();

search('typescript');                        // page=1, limit=10, sortBy=undefined
search('typescript', 2);                     // page=2, limit=10, sortBy=undefined
search('typescript', 1, 20);                 // page=1, limit=20, sortBy=undefined
search('typescript', 1, 10, 'relevance');    // page=1, limit=10, sortBy='relevance'
```

## Per-Argument Validation

Each tuple element is validated independently:

```ts
const register = zagora()
  .input(z.tuple([
    z.string().min(3).max(20),        // username: 3-20 chars
    z.string().email(),                // email: valid email
    z.number().min(13).max(120)        // age: 13-120
  ]))
  .handler((_, username, email, age) => {
    return { username, email, age };
  })
  .callable();

// Validation error points to specific argument
const result = register('ab', 'invalid', 10);
// result.error.issues:
// [
//   { path: [0], message: 'String must contain at least 3 character(s)' },
//   { path: [1], message: 'Invalid email' },
//   { path: [2], message: 'Number must be greater than or equal to 13' }
// ]
```

## TypeScript Inference

Full type inference for all arguments:

```ts
const fn = zagora()
  .input(z.tuple([
    z.string(),
    z.number().default(0),
    z.boolean().optional()
  ]))
  .handler((_, a, b, c) => {
    // a: string
    // b: number (not number | undefined!)
    // c: boolean | undefined
  })
  .callable();

// TypeScript knows the call signatures:
fn('hello');                    // OK
fn('hello', 5);                 // OK
fn('hello', 5, true);           // OK
fn();                           // Error: missing required argument
fn('hello', 'wrong');           // Error: string not assignable to number
```

## Next Steps

- [Default Values](/docs/default-values) - More on auto-filling defaults
- [Input Validation](/docs/input-validation) - All input types
