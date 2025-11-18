import { z } from "zod";
import type { InferSchemaInput } from "./types";

// Test 1: Tuple with .default() on a number element
const schema1 = z.tuple([z.string(), z.number().default(123)]);
type Input1 = z.infer<typeof schema1>;
type Inferred1 = InferSchemaInput<typeof schema1>;

// Test 2: Tuple with .optional() on a number element
const schema2 = z.tuple([z.string(), z.number().optional()]);
type Input2 = z.infer<typeof schema2>;
type Inferred2 = InferSchemaInput<typeof schema2>;

// Test 3: Check if Input1 matches readonly [any, ...any[]]
type Check1 = Input1 extends readonly [any, ...any[]] ? true : false;

// Test 4: Check if Input2 matches readonly [any, ...any[]]
type Check2 = Input2 extends readonly [any, ...any[]] ? true : false;

// Test 5: Are they the same?
type SameType = Input1 extends Input2
  ? Input2 extends Input1
    ? true
    : false
  : false;

// Test 6: What about the schema itself at runtime?
const inspect1 = {
  type1Def: (schema1 as any)._def,
  type1Items: (schema1 as any)._def?.items,
  type2Def: (schema2 as any)._def,
  type2Items: (schema2 as any)._def?.items,
};

const test1: Input1 = ["hello", 123];
const test2: Input1 = ["hello"]; // Should work if default is applied
const test3: Input2 = ["hello"];
const test4: Input2 = ["hello", 456];
