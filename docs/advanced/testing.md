---
description: "How to test Zagora procedures. Zagora procedures are regular functions, making them easy to test."
head:
  - - meta
    - property: og:description
      content: "How to test Zagora procedures. Zagora procedures are regular functions, making them easy to test."
---

# Testing Procedures


Zagora procedures are regular functions, making them easy to test. Here are patterns and best practices.

## Basic Testing

Test procedures like any function:

```ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zagora } from 'zagora';

const add = zagora()
  .input(z.tuple([z.number(), z.number()]))
  .handler((_, a, b) => a + b)
  .callable();

describe('add', () => {
  it('adds two numbers', () => {
    const result = add(2, 3);
    
    expect(result.ok).toBe(true);
    expect(result.data).toBe(5);
  });
  
  it('returns validation error for invalid input', () => {
    const result = add('a', 'b');
    
    expect(result.ok).toBe(false);
    expect(result.error.kind).toBe('VALIDATION_ERROR');
  });
});
```

## Testing with Context

Override context for testing:

```ts
const getUser = zagora()
  .context({ db: productionDb })
  .input(z.string())
  .handler(({ context }, id) => context.db.find(id))
  .callable();

describe('getUser', () => {
  it('returns user from database', async () => {
    // Create mock database
    const mockDb = {
      find: vi.fn().mockResolvedValue({ id: '123', name: 'Alice' })
    };
    
    // Create test version with mock
    const testGetUser = getUser.callable({ context: { db: mockDb } });
    
    const result = await testGetUser('123');
    
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ id: '123', name: 'Alice' });
    expect(mockDb.find).toHaveBeenCalledWith('123');
  });
});
```

## Testing Errors

Test both success and error cases:

```ts
const divide = zagora()
  .input(z.tuple([z.number(), z.number()]))
  .errors({
    DIVISION_BY_ZERO: z.object({ dividend: z.number() })
  })
  .handler(({ errors }, a, b) => {
    if (b === 0) throw errors.DIVISION_BY_ZERO({ dividend: a });
    return a / b;
  })
  .callable();

describe('divide', () => {
  it('divides numbers', () => {
    const result = divide(10, 2);
    expect(result.ok).toBe(true);
    expect(result.data).toBe(5);
  });
  
  it('returns error for division by zero', () => {
    const result = divide(10, 0);
    
    expect(result.ok).toBe(false);
    expect(result.error.kind).toBe('DIVISION_BY_ZERO');
    expect(result.error.dividend).toBe(10);
  });
  
  it('returns validation error for invalid input', () => {
    const result = divide('ten', 2);
    
    expect(result.ok).toBe(false);
    expect(result.error.kind).toBe('VALIDATION_ERROR');
  });
});
```

## Testing Async Procedures

Use async/await in tests:

```ts
const fetchUser = zagora()
  .input(z.string())
  .handler(async (_, id) => {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  })
  .callable();

describe('fetchUser', () => {
  it('fetches user data', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ id: '123', name: 'Alice' })
    });
    
    const result = await fetchUser('123');
    
    expect(result.ok).toBe(true);
    expect(result.data.name).toBe('Alice');
  });
});
```

## Testing with Type Guards

Use error type guards in tests:

```ts
import { isValidationError, isDefinedError } from 'zagora/errors';

it('returns validation error for bad input', () => {
  const result = proc(invalidInput);
  
  expect(result.ok).toBe(false);
  expect(isValidationError(result.error)).toBe(true);
  
  if (isValidationError(result.error)) {
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0].path).toEqual(['email']);
  }
});
```

## Snapshot Testing

Snapshot test result shapes:

```ts
it('returns expected shape', () => {
  const result = createUser({ name: 'Alice', email: 'alice@test.com' });
  
  expect(result.ok).toBe(true);
  expect(result.data).toMatchSnapshot();
});

it('returns expected error shape', () => {
  const result = createUser({ name: '', email: 'invalid' });
  
  expect(result.ok).toBe(false);
  expect(result.error).toMatchSnapshot();
});
```

## Integration Testing

Test procedure chains:

```ts
describe('user workflow', () => {
  const mockDb = createMockDb();
  const context = { db: mockDb };
  
  const createUser = createUserProc.callable({ context });
  const getUser = getUserProc.callable({ context });
  const deleteUser = deleteUserProc.callable({ context });
  
  it('creates, retrieves, and deletes user', async () => {
    // Create
    const createResult = await createUser({ name: 'Alice' });
    expect(createResult.ok).toBe(true);
    const userId = createResult.data.id;
    
    // Retrieve
    const getResult = await getUser(userId);
    expect(getResult.ok).toBe(true);
    expect(getResult.data.name).toBe('Alice');
    
    // Delete
    const deleteResult = await deleteUser(userId);
    expect(deleteResult.ok).toBe(true);
    
    // Verify deleted
    const getAgain = await getUser(userId);
    expect(getAgain.ok).toBe(false);
    expect(getAgain.error.kind).toBe('NOT_FOUND');
  });
});
```

## Test Helpers

Create test utilities:

```ts
// test-utils.ts
export function expectSuccess<T>(result: ZagoraResult<T, any>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected success');
  return result.data;
}

export function expectError<T>(
  result: ZagoraResult<any, T>,
  kind: string
): T {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected error');
  expect(result.error.kind).toBe(kind);
  return result.error;
}

// Usage
it('creates user', async () => {
  const result = await createUser({ name: 'Alice' });
  const user = expectSuccess(result);
  expect(user.name).toBe('Alice');
});

it('rejects invalid email', async () => {
  const result = await createUser({ name: 'Alice', email: 'bad' });
  const error = expectError(result, 'VALIDATION_ERROR');
  expect(error.issues[0].path).toContain('email');
});
```

## Testing Best Practices

1. **Test both success and error paths**
2. **Mock dependencies via context**
3. **Use type guards for error assertions**
4. **Create test utilities for common patterns**
5. **Test edge cases (empty input, max values, etc.)**
6. **Test validation errors specifically**
