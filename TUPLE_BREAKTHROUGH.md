# Tuple Handling Breakthrough - Implementation Status

## The Problem

Zagora handlers with tuple schemas don't catch type errors on individual arguments:

```typescript
const tuplePub = zagora().input(z.tuple([z.string(), z.number()]));

const tupleHandler = tuplePub.output(z.string()).handler((name, id) => {
  return `${name}-${id}`;
});

tupleHandler("test", "foo bar"); // Should error - "foo bar" is not a number, but doesn't!
```

## Root Cause

TypeScript **cannot generate function overloads dynamically**. The current `TupleForwardOverloads` type tried to generate overloads via `ValuePrefixes` and type unions, but this loses type information and produces incorrect signatures.

For proper type checking, each tuple position must have an explicit, concrete function signature:

```typescript
function handler(): void;
function handler(arg1: string): void;
function handler(arg1: string, arg2: number): void;
```

## The Breakthrough

**Solution**: Use explicit conditional type branches to build `UnionToIntersection` of concrete function signatures for each tuple length (0-5 elements).

### What Was Changed

1. **`src-v2/types.ts`**:
   - Rewrote `TupleForwardOverloads` to use explicit branches for tuple sizes 0-5
   - Each branch generates a specific set of overload signatures via `UnionToIntersection`
   - Added `Mutable` helper to convert readonly tuples to mutable (no longer needed, but kept for compatibility)

2. **`src-v2/index.ts`**:
   - Fixed `ForwardType` conditional to check for tuple BEFORE context
   - Tuple inputs now correctly route to `TupleForwardOverloads`

### Current Implementation

```typescript
export type TupleForwardOverloads<
  TInputArgs extends readonly any[],
  THandlerResult,
> = TInputArgs extends readonly []
  ? () => THandlerResult
  : TInputArgs extends readonly [infer A]
    ? UnionToIntersection<(() => THandlerResult) | ((a: A) => THandlerResult)>
    : TInputArgs extends readonly [infer A, infer B]
      ? UnionToIntersection<
          | (() => THandlerResult)
          | ((a: A) => THandlerResult)
          | ((a: A, b: B) => THandlerResult)
        >
    // ... continues for 3, 4, 5 elements
```

## Status

✅ Type utility rewrites complete
✅ `TupleForwardOverloads` generates correct overload unions
✅ `UnionToIntersection` properly converts unions to callable intersections
⚠️ **PENDING**: Runtime cast mechanics - the `as unknown as ForwardType` cast in the handler may need adjustment

## Next Steps

1. **Debug the cast** - The explicit overloads are generated correctly (proven by direct type tests), but the runtime function cast may not preserve them
2. **Alternative approaches**:
   - Use `satisfies` instead of `as`
   - Manually type the forwardImpl implementation
   - Check if TypeScript version affects casting behavior

3. **Validation** - Once working, `tupleHandler("test", "foo")` will correctly error

## Files

- `src-v2/types.ts` - Updated `TupleForwardOverloads` with explicit branches
- `src-v2/index.ts` - Fixed `ForwardType` conditional logic
- `tuple-debugging/working-overloads.ts` - Proof of concept with manual overloads
- `tuple-debugging/simple-solution.ts` - Basic tuple usage patterns

## Key Insight

The problem wasn't the concept - it was the execution method. **Explicit overloads work. Dynamic generation doesn't.** Each tuple length needs its own concrete signature branch, and TypeScript's `UnionToIntersection` pattern correctly converts function unions into callable intersections.
