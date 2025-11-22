import z from "zod";
import { zagora } from "./sscore";

const za = zagora();

// Test 1: Tuple with defaults
const helloTuple = za
  .context<{ sessionId: string }>({ sessionId: "foo-123" })
  .input(
    z.tuple([
      z.string().min(1).max(100),
      z.number().min(1).max(1000).default(33),
    ]),
  )
  .output(
    z.object({
      role: z.enum(["admin", "user", "guest"]),
      username: z.string(),
    }),
  )
  .errors({
    UNAUTHORIZED: z
      .object({
        // kind: z.literal("UNAUTHORIZED"),
        user: z.string().min(1).max(100),
        id: z.number().min(1).max(1000).default(100),
      })
      .strict(),
  })
  .handler(async (options, user, id) => {
    const { errors, context } = options;

    if (id && id > 100) {
      throw errors.UNAUTHORIZED({ user: user || "unknown" });
    }
    return {
      role: "user",
      username: `${user}-${id}-${context.sessionId}`,
    };

    // TODO: document that both the runtime and the type-system work,
    // and correctly resolve types - if handler is not marked as async,
    // but returns a Promise then the return type of the procedure is correctly Promize<ZagoraResult>
    //
    // return Promise.resolve({
    //   role: "user",
    //   username: `${user}-${id}-${context.sessionId}`,
    // });
  })
  .callable({ sessionId: "foo123" });

// // Test 2: Primitive input
// const helloPrimitive = za
//   .context<{ sessionId: string }>({ sessionId: "foo123" })
//   .input(z.string())
//   .output(z.object({ message: z.string() }))
//   .handler((options, name) => {
//     return { message: `Hello ${name}-${options.context.sessionId}!` };
//   })
//   .callable({ sessionId: "foo123" });

// // Test 3: Object input
// const helloObject = za
//   .input(z.object({ name: z.string(), age: z.number() }))
//   .output(z.object({ greeting: z.string() }))
//   .handler((_, input) => {
//     return { greeting: `Hello ${input.name}, you are ${input.age} years old!` };
//   })
//   .callable();

(async () => {
  console.log("Testing tuple with defaults:");
  const result1 = await helloTuple("alice", 111);

  if (!result1.ok) {
    // result1.data.role;  // ok, the `data` not exist
    const err = result1.error;
    // result1.error.message = "sasa"; // ok, cannot assign to readonly property
    console.error(err);
    return;
  }
  // result1.data.username = "sasa"; // it's fine to assign to data.username
  console.log(result1);

  // console.log("\nTesting tuple with explicit args:");
  // const result1b = await helloTuple("bob", 33);
  // console.log(result1b);

  // console.log("\nTesting error case:");
  // const resultError = await helloTuple("alice", 150);
  // console.log(resultError);

  // console.log("\nTesting primitive input:");
  // const result2 = helloPrimitive("world");
  // console.log(result2);

  // console.log("\nTesting object input:");
  // const result3 = helloObject({ name: "Alice", age: 30 });
  // console.log(result3);
})();
