# Tuple Arguments

Use tuple schemas to define multiple function arguments with per-argument diagnostics and validation.

## Basic Tuple Arguments

Define multiple arguments using tuple schemas:

```ts
const greet = zagora()
  .input(z.tuple([z.string(), z.number()]))
  .handler((_, name, age) => `${name} is ${age} years old`)
  .callable();

// NOTE: all arguments are required
greet('Alice', 30);  // { ok: true, data: 'Alice is 30 years old' }
```

Arguments are spread to the handler:

```ts
.handler((options, arg1, arg2, arg3) => {
  // arg1: type of first tuple element
  // arg2: type of second tuple element
  // etc.
})
```

## Defaults in Tuples

Apply defaults to tuple elements:

```ts
const createUser = zagora()
  .input(z.tuple([
    z.string(),                    // Required name
    z.string().default('user'),    // Default role
    z.number().default(18)         // Default age
  ]))
  .handler((_, name, role, age) => ({ name, role, age }))
  .callable();

createUser('Alice');              // { name: 'Alice', role: 'user', age: 18 }
createUser('Bob', 'admin');       // { name: 'Bob', role: 'admin', age: 18 }
createUser('Carol', 'mod', 25);   // { name: 'Carol', role: 'mod', age: 25 }
```

## Optional Arguments

Use optional elements in tuples:

```ts
const log = zagora()
  .input(z.tuple([
    z.string(),          // Required message
    z.string().optional() // Optional level
  ]))
  .handler((_, message, level) => {
    console.log(`[${level || 'info'}] ${message}`);
  })
  .callable();

log('Starting server');        // [info] Starting server
log('Error occurred', 'error'); // [error] Error occurred
```

## Per-Argument Validation

Each tuple element validates independently:

```ts
const divide = zagora({ autoCallable: true, disableOptions: true  })
  .input(z.tuple([
    z.number(),                    // dividend
    z.number().refine(n => n !== 0, 'Cannot divide by zero')  // non-zero divisor
  ]))
  .handler((a, b) => a / b);

divide(10, 2);   // { ok: true, data: 5 }
divide(10, 0);   // { ok: false, error: { kind: 'VALIDATION_ERROR', ... } }
```

## TypeScript Inference

TypeScript infers tuple types correctly:

```ts
const proc = zagora()
  .input(z.tuple([z.string(), z.number().default(10)]))
  .handler((_, name, count) => {
    // name: string
    // count: number (never undefined due to default!)
    return name.repeat(count);
  })
  .callable();
```

Use tuple arguments for procedures that need multiple, validated parameters.
