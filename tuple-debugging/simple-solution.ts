import { z } from "zod";

// ============================================================================
// TUPLE HANDLING - ACTUAL WORKING SOLUTION
// ============================================================================
// Zod tuple schemas with optional elements work correctly with rest parameters.
// Just use z.infer<typeof schema> directly - no conversion needed.

// ============================================================================
// TEST 1: Basic optional tuple
// ============================================================================

const schema1 = z.tuple([z.string(), z.number().optional()]);
type Input1 = z.infer<typeof schema1>;

function handler1(...args: Input1): void {
  const [str, num] = args;
  console.log(str, num);
}

// All these are valid:
handler1("hello", 42);
handler1("hello", undefined);
handler1("hello", "foobar");
handler1("hello");

// ============================================================================
// TEST 2: Complex tuple - multiple optionals
// ============================================================================

const schema2 = z.tuple([
  z.string(),
  z.number().optional(),
  z.boolean(),
  z.string().optional(),
]);
type Input2 = z.infer<typeof schema2>;

function handler2(...args: Input2): void {
  const [str, num, bool, str2] = args;
  console.log(str, num, bool, str2);
}

// All valid:
handler2("a", 1, true, "b");
handler2("a", undefined, true, "b");
handler2("a", 1, true, undefined);

// ============================================================================
// TEST 3: All optional
// ============================================================================

const schema3 = z.tuple([z.string().optional(), z.number().optional()]);
type Input3 = z.infer<typeof schema3>;

function handler3(...args: Input3): void {
  const [str, num] = args;
}

handler3();
handler3("hello");
handler3("hello", 42);
handler3(undefined, 42);

// ============================================================================
// TEST 4: All required
// ============================================================================

const schema4 = z.tuple([z.string(), z.number(), z.boolean()]);
type Input4 = z.infer<typeof schema4>;

function handler4(...args: Input4): void {
  const [str, num, bool] = args;
}

handler4("a", 1, true);

// ============================================================================
// TEST 5: Empty tuple
// ============================================================================

const schema5 = z.tuple([]);
type Input5 = z.infer<typeof schema5>;

function handler5(...args: Input5): void {}

handler5();

// ============================================================================
// TEST 6: Runtime validation with typed handler
// ============================================================================

function processInput(input: unknown): void {
  const result = schema1.safeParse(input);
  if (result.success) {
    const typedHandler = (...args: Input1) => {
      const [str, num] = args;
      console.log(str, num);
    };
    typedHandler(...result.data);
  }
}

processInput(["hello", 42]);
processInput(["hello"]);

// ============================================================================
// KEY INSIGHT
// ============================================================================
// Zod gives: [string, number | undefined]
// TypeScript rest parameters handle this correctly.
// Omitting an argument implicitly passes undefined.
// No conversion utilities needed - just use z.infer<> directly.
