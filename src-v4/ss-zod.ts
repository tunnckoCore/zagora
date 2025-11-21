import z from "zod";
import { zagora } from "./sscore";

// ============================================================================
// TESTS
// ============================================================================

// Test 1: Tuple with defaults
const proc1 = zagora()
  .context<{ foo: string }>()
  .input(z.tuple([z.string(), z.number().default(42)]))
  .handler((opts, name, age) => ({
    // passing!
    // name: string
    // age: number - must be, because it's defaulted to 42
    message: `${name} is ${age}`,
  }))
  .callable({ foo: "bar", sasa: 123 });

console.log("Test 1a:", proc1("Alice"));
console.log("Test 1b:", proc1("Bob", 30));

// Test 1b: Tuple with default + optional
const proc1b = zagora()
  .input(z.tuple([z.string(), z.number().default(42), z.boolean().optional()]))
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
  .context<{ foo?: string; bar: string }>({ bar: "quxie" })
  .input(z.string())
  .handler((options, name) => {
    options;
    // passing!
    // name: string
    return `Hello ${name}!`;
  })
  .callable();

console.log("Test 2:", proc2("World"));

// Test 3: Object input
const proc3 = zagora()
  .input(z.object({ x: z.number(), y: z.number().default(2) }))
  .handler((options, input) => {
    options;

    // input: { x: number, y: number } - because y is defaulted to 2
    return input.x + input.y;
  })
  .callable();

console.log("Test 3:", proc3({ x: 5, y: 3 }));

// Test 4: Object with defaults and optionals
const proc4 = zagora()
  .input(
    z.tuple([
      z.string(),
      z.object({
        user: z.string(),
        role: z.string().default("admin"),
        paid: z.boolean().optional(),
      }),
    ]),
  )
  .handler((options, name, config) => {
    options;

    // passing!
    // config: { user: string, role: string, paid: boolean | undefined }
    return `${name}: role=${config.role}, paid=${config.paid ?? false}`;
  })
  .callable();

// SHOULD NOT REQUIRE `role` to be passed because it has a default value!
console.log("Test 4a:", proc4("Alice", { user: "alice" }));
console.log("Test 4b:", proc4("Bob", { user: "bob", role: "moderator" }));
console.log(
  "Test 4c:",
  proc4("Carol", { user: "carol", role: "admin", paid: true }),
);

const ping = zagora()
  .input(z.number())
  .output(z.object({ pong: z.number() }))
  .errors({
    NOT_FOUND: z.object({ type: z.literal("NOT_FOUND"), userId: z.string() }),
    AUTH_ERR: z.object({ type: z.literal("AUTH_ERR"), retryAfter: z.number() }),
  })
  .handler(({ errors }, id) => {
    if (id === 42) {
      throw errors.AUTH_ERR({ retryAfter: Date.now() + 1000 });
    }
    if (id <= 20) {
      throw errors.NOT_FOUND({ userId: "123" });
    }

    return { pong: id + 1 };
  })
  .callable();

// Call synchronously, no try-catch needed
const resPing = ping(42);
console.log("Test 5 ping-pong:", resPing);

if (
  resPing.error &&
  resPing.isTypedError &&
  !(resPing.error instanceof Error)
) {
  console.log(
    "foo::::",
    // Type checking now correctly infers resPing.error as PingCallableError
    // and then further narrows it based on the 'type' property.
    resPing.error.type === "AUTH_ERR" ? resPing.error.retryAfter : "sasa",
    "<<<",
  );
} else if (resPing.error && resPing.error instanceof Error) {
  // This block handles cases where resPing has a generic error object (e.g., an Error instance)
  // which is not a specific typed error as defined in the .errors() method.
  console.log("unknown err:", resPing.error);
}

console.log("\nAll tests passed!");
