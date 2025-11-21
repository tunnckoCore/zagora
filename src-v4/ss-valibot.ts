import * as v from "valibot";
import { zagora } from "./sscore";

// ============================================================================
// TESTS
// ============================================================================

// Test 1: Tuple with defaults
const proc1 = zagora()
  .input(v.tuple([v.string(), v.optional(v.number(), 42)]))
  .handler((options, name, age) => ({
    // passing!
    // name: string
    // age: number - must be, because it's defaulted to 42
    message: `${name} is ${age}`,
  }))
  .callable();

console.log("Test 1a:", proc1("Alice"));
console.log("Test 1b:", proc1("Bob", 30));

// Test 1b: Tuple with default + optional
const proc1b = zagora()
  .input(
    v.tuple([v.string(), v.optional(v.number(), 42), v.optional(v.boolean())]),
  )
  .handler((options, name, age, verified) => ({
    // passing!
    // name: string
    // age: number - must be, because it's defaulted to 42
    // verified: boolean | undefined - because it's optional
    message: `${name} is ${age}, verified: ${verified ?? false}`,
  }))
  .callable();

// should pass because verified is optional
// and because age is defaulted to 42
console.log("Test 1b1:", proc1b("Alice"));

// should pass because verified is optional and age is passed
console.log("Test 1b2:", proc1b("Bob", 30));
console.log("Test 1b3:", proc1b("Carol", 25, true));

// Test 2: Primitive input
const proc2 = zagora()
  .input(v.string())
  .handler((options, name) => {
    // passing!
    // name: string
    return `Hello ${name}!`;
  })
  .callable();

console.log("Test 2:", proc2("World"));

// Test 3: Object input
const proc3 = zagora()
  .input(v.object({ x: v.number(), y: v.optional(v.number(), 2) }))
  .handler((options, input) => {
    // input: { x: number, y: number } - because y is defaulted to 2
    return input.x + input.y;
  })
  .callable();

console.log("Test 3:", proc3({ x: 5, y: 3 }));

// Test 4: Object with defaults and optionals
const proc4 = zagora()
  .input(
    v.tuple([
      v.string(),
      v.object({
        user: v.string(),
        role: v.optional(v.string(), "admin"),
        paid: v.optional(v.boolean()),
      }),
    ]),
  )
  .handler((options, name, config) => ({
    // passing!
    // config: { user: string, role: string, paid: boolean | undefined }
    result: `${name}: role=${config.role}, paid=${config.paid ?? false}`,
  }))
  .callable();

// SHOULD NOT REQUIRE `role` to be passed because it has a default value!
console.log("Test 4a:", proc4("Alice", { user: "alice" }));
console.log("Test 4b:", proc4("Bob", { user: "bob", role: "moderator" }));
console.log(
  "Test 4c:",
  proc4("Carol", { user: "carol", role: "admin", paid: true }),
);

console.log("\nAll tests passed!");
