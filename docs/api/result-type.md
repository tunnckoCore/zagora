---
description: "Result type reference. Every Zagora procedure returns a `ZagoraResult`—a discriminated union representing success or failure."
head:
  - - meta
    - property: og:description
      content: "Result type reference. Every Zagora procedure returns a `ZagoraResult`—a discriminated union representing success or failure."
---

# ZagoraResult Type


Every Zagora procedure returns a `ZagoraResult`—a discriminated union representing success or failure.

## Type Definition

```ts
type ZagoraResult<TData, TErrors = never> = 
  | { ok: true; data: TData; error: undefined }
  | { ok: false; data: undefined; error: ZagoraError<TErrors> };
```

## Success Result

When `ok` is `true`, the procedure succeeded:

```ts
{
  ok: true,
  data: TData,       // Your return value
  error: undefined   // Always undefined on success
}
```

**Example:**

```ts
const result = greet('World');

if (result.ok) {
  console.log(result.data);   // 'Hello, World!'
  console.log(result.error);  // undefined
}
```

## Error Result

When `ok` is `false`, the procedure failed:

```ts
{
  ok: false,
  data: undefined,   // Always undefined on error
  error: ZagoraError // Typed error object
}
```

**Example:**

```ts
const result = divide(10, 0);

if (!result.ok) {
  console.log(result.data);   // undefined
  console.log(result.error);  // { kind: 'DIVISION_BY_ZERO', ... }
}
```

## Type Narrowing

TypeScript narrows the type based on `ok`:

```ts
const result = proc(input);

if (result.ok) {
  // TypeScript knows:
  // - result.data is TData
  // - result.error is undefined
  result.data.someProperty;  // OK
} else {
  // TypeScript knows:
  // - result.data is undefined
  // - result.error is ZagoraError<TErrors>
  result.error.kind;  // OK
}
```

## Async Results

Async procedures return `Promise<ZagoraResult>`:

```ts
const asyncProc = zagora()
  .handler(async () => fetchData())
  .callable();

const result = await asyncProc();
// result: ZagoraResult<Data>
```

## Generic Parameters

### TData

The success data type, inferred from:
1. Output schema (if defined)
2. Handler return type (otherwise)

```ts
// From output schema
zagora()
  .output(z.object({ id: z.string() }))
  .handler(() => ({ id: '123' }))
// TData = { id: string }

// From handler return
zagora()
  .handler(() => ({ id: '123', name: 'test' }))
// TData = { id: string, name: string }
```

### TErrors

The union of possible error types:

```ts
zagora()
  .errors({
    NOT_FOUND: z.object({ id: z.string() }),
    FORBIDDEN: z.object({ reason: z.string() })
  })
// TErrors = 
//   | { kind: 'NOT_FOUND', id: string }
//   | { kind: 'FORBIDDEN', reason: string }
//   | ValidationError
//   | UnknownError
```

## Utility Types

### Extracting Data Type

```ts
import type { ZagoraResult } from 'zagora/types';

type Result = ZagoraResult<{ id: string }, never>;

// Extract data type
type Data = Extract<Result, { ok: true }>['data'];
// Data = { id: string }
```

### Extracting Error Type

```ts
type ErrorType = Extract<Result, { ok: false }>['error'];
```

## Pattern: Result Handling

### Basic Pattern

```ts
const result = proc(input);

if (result.ok) {
  return result.data;
} else {
  throw new Error(result.error.message);
}
```

### Switch on Error Kind

```ts
if (!result.ok) {
  switch (result.error.kind) {
    case 'NOT_FOUND':
      return { status: 404, body: result.error };
    case 'FORBIDDEN':
      return { status: 403, body: result.error };
    case 'VALIDATION_ERROR':
      return { status: 400, body: result.error.issues };
    case 'UNKNOWN_ERROR':
      console.error(result.error.cause);
      return { status: 500, body: 'Internal error' };
  }
}
```

### Generic Result Handler

```ts
function handleResult<T>(result: ZagoraResult<T, any>): T {
  if (result.ok) {
    return result.data;
  }
  
  // Log and re-throw as appropriate for your app
  console.error('Procedure failed:', result.error);
  throw new Error(`${result.error.kind}: ${result.error.message}`);
}

const data = handleResult(proc(input));
```

## See Also

- [Error Types](/api/error-types) - All error types
- [Never-Throwing Guarantees](/docs/never-throwing) - Why results never throw
