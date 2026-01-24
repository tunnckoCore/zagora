# Validation

Zagora provides comprehensive input and output validation using StandardSchema-compliant validators.

## Input Validation

Input validation ensures procedures receive correctly typed and validated data at runtime.

### Basic Input

Define an input schema using any StandardSchema-compliant validator:

```ts
const greet = zagora()
  .input(z.string())
  .handler((_, name) => `Hello, ${name}!`)
  .callable();

greet('Alice');  // { ok: true, data: 'Hello, Alice!' }
greet(123);      // { ok: false, error: { kind: 'VALIDATION_ERROR', ... } }
```

### Object Inputs

Use object schemas for structured data:

```ts
const createUser = zagora()
  .input(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().optional()
  }))
  .handler((_, input) => ({ id: '123', ...input }))
  .callable();
```

### Tuple Inputs (Multiple Arguments)

Use tuple schemas to define multiple arguments with per-argument validation:

```ts
const add = zagora()
  .input(z.tuple([z.number(), z.number()]))
  .handler((_, a, b) => a + b)
  .callable();

add(5, 10);  // { ok: true, data: 15 }
```

With defaults and optionals:

```ts
const greet = zagora()
  .input(z.tuple([
    z.string(),
    z.number().default(18),
    z.string().optional()
  ]))
  .handler((_, name, age, title) => {
    // name: string
    // age: number - notice that it's only number because we have a default in schema!
    // title: string | undefined
    return `${title || 'User'} ${name}, age ${age}`;
  })
  .callable();

greet('Alice');
// NOTE: examples below omit the { ok, data, error } wrapper for brevity.
// => "User Alice, age 18"
greet('Bob', 25);            // => "User Bob, age 25"
greet('Carol', 30, 'Dr.');   // => "Dr. Carol, age 30"
```

### Array Inputs

For variable-length inputs of the same type:

```ts
const sum = zagora()
  .input(z.array(z.number()))
  .handler((_, numbers) => numbers.reduce((a, b) => a + b, 0))
  .callable();

sum([1, 2, 3, 4, 5]);  // { ok: true, data: 15 }
```

### Validation Errors

Invalid inputs produce structured errors:

```ts
const result = createUser({ name: '', email: 'invalid' });

if (!result.ok && result.error.kind === 'VALIDATION_ERROR') {
  console.log(result.error.issues); // StandardSchema.Issue[]
  // [
  //   { path: ['name'], message: 'String must contain at least 1 character(s)' },
  //   { path: ['email'], message: 'Invalid email' }
  // ]
}
```

The `VALIDATION_ERROR` has `result.error.issues` property which is of type `StandardSchema.Issue[]`.

### Using Different Validators

Zagora works with any StandardSchema validator:

#### Valibot

```ts
import * as v from 'valibot';

const greet = zagora()
  .input(v.string())
  .handler((_, name) => `Hello, ${name}!`)
  .callable();
```

#### ArkType

```ts
import { type } from 'arktype';

const greet = zagora()
  .input(type('string'))
  .handler((_, name) => `Hello, ${name}!`)
  .callable();
```

### No Input

Procedures can omit input entirely:

```ts
const getTime = zagora()
  .handler(() => new Date().toISOString())
  .callable();

getTime();  // { ok: true, data: '2024-01-15T10:30:00.000Z' }
```

## Output Validation

Output validation verifies that handlers return correctly shaped data, catching bugs before they reach consumers. 

**NOTE:** If `.output` is omitted, then the type of the `result.data` is inferred from the return type of the handler!

### Basic Output

Define an output schema to validate return values:

```ts
const getUser = zagora()
  .input(z.string())
  .output(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email()
  }))
  .handler((_, id) => ({
    id,
    name: 'Alice',
    email: 'alice@example.com'
  }))
  .callable();

const result = getUser(crypto.randomUUID());
if (result.ok) {
  // result.data => {
  //   id: 'b0ffa564-2ae3-4201-8d0e-2385144fccd7',
  //   name: 'Alice',
  //   email: 'alice@example.com'
  // }
}
```

### Why Validate Outputs?

Output validation catches handler bugs at both compile-time (IDEs, CIs) and at runtime:

```ts
const buggyHandler = zagora()
  .output(z.object({ count: z.number() }))
  .handler(() => ({ count: 'not a number' }))  // Bug!
  .callable();

const result = buggyHandler();
// { ok: false, error: { kind: 'VALIDATION_ERROR', ... } }
```

Without output validation, bugs propagate to consumers.

### Output Type Inference

TypeScript infers the output type from the schema, or if omitted then from the return type of the handler:

```ts
const getUser = zagora()
  .output(z.object({
    id: z.string(),
    name: z.string()
  }))
  .handler(() => ({ id: '1', name: 'Alice' }))
  .callable();

const result = getUser();
if (result.ok) {
  result.data.id;    // string
  result.data.name;  // string
}
```

### Optional Output

Output validation is optional. Without it, the handler's return type is inferred:

```ts
const proc = zagora()
  .handler(() => ({ message: 'Hello' }))
  .callable();
// result.data: { message: string }
```

Use validation to ensure data integrity at both input and output boundaries.

## Related

- [Procedures](../core/procedures.md): Builder API basics
- [Typed Errors](../core/typed-errors.md): Error handling with validation
- [Tuple Arguments](../advanced/tuple-arguments.md): Multiple arguments in detail
