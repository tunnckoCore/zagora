import { z } from "zod";

// ============================================================================
// WORKING TUPLE OVERLOADS - THE REAL SOLUTION
// ============================================================================
// The breakthrough: TypeScript CANNOT generate function overloads dynamically.
// You must write explicit overloads for each tuple signature.

// ============================================================================
// TEST 1: Simple 2-element tuple
// ============================================================================

const schema1 = z.tuple([z.string(), z.number()]);
type Input1 = z.infer<typeof schema1>; // [string, number]

function handler1Impl(...args: Input1): void {}

function handler1(): void;
function handler1(arg1: string): void;
function handler1(arg1: string, arg2: number): void;
function handler1(arg1?: string, arg2?: number): void {
  handler1Impl(arg1 as string, arg2 as number);
}

// Now TYPE ERRORS are caught:
handler1("test", 123); // ✓ OK
handler1("test"); // ✓ OK
// @ts-expect-error - wrong type for arg2
handler1("test", "foo");

// ============================================================================
// TEST 2: Tuple with optional element
// ============================================================================

const schema2 = z.tuple([z.string(), z.number().optional()]);
type Input2 = z.infer<typeof schema2>; // [string, number | undefined]

function handler2Impl(...args: Input2): void {}

function handler2(): void;
function handler2(arg1: string): void;
function handler2(arg1: string, arg2: number | undefined): void;
function handler2(arg1?: string, arg2?: number | undefined): void {
  handler2Impl(arg1 as string, arg2);
}

handler2("test"); // ✓ OK
handler2("test", 123); // ✓ OK
handler2("test", undefined); // ✓ OK
// @ts-expect-error - wrong type
handler2("test", "foo");

// ============================================================================
// TEST 3: Complex tuple
// ============================================================================

const schema3 = z.tuple([
  z.string(),
  z.number().optional(),
  z.boolean(),
  z.string().optional(),
]);
type Input3 = z.infer<typeof schema3>;

function handler3Impl(...args: Input3): void {}

function handler3(): void;
function handler3(arg1: string): void;
function handler3(arg1: string, arg2: number | undefined): void;
function handler3(arg1: string, arg2: number | undefined, arg3: boolean): void;
function handler3(
  arg1: string,
  arg2: number | undefined,
  arg3: boolean,
  arg4: string | undefined,
): void;
function handler3(
  arg1?: string,
  arg2?: number | undefined,
  arg3?: boolean,
  arg4?: string | undefined,
): void {
  handler3Impl(arg1 as string, arg2, arg3 as boolean, arg4);
}

handler3("a", 1, true, "b"); // ✓ OK
handler3("a", undefined, true, "b"); // ✓ OK
handler3("a", 1, true); // ✓ OK
// @ts-expect-error - wrong type
handler3("a", true, true, "b");

// ============================================================================
// THE BREAKTHROUGH
// ============================================================================
// The problem: ValuePrefixes and TupleForwardOverloads can't generate
// proper function overloads. TypeScript doesn't support dynamic overloads.
//
// The solution: Write explicit overloads for 0-N elements where each
// position has its EXACT type. This way type errors ARE caught.
//
// handler("test", "foo") with z.tuple([z.string(), z.number()])
// NOW ERRORS because "foo" doesn't match number in the overload signature.
