import { z } from "zod";
import { zagora } from "./index";

// ============================================
// CONTEXT EXAMPLES
// ============================================

// Example 1: Basic context (sync handler)
const basicWithContext = zagora()
  .$context<{ userId: string }>({ userId: "default" })
  .input(z.string())
  .handler(({ input, context }) => {
    return `${input} by ${context.userId}`;
  });

// Usage
// const result1 = basicWithContext("hello");
// console.log(result1); // [ "hello by default", null, false ]

// Example 2: Context with async handler
const withAsyncContext = zagora()
  .$context<{ userId: string }>({ userId: "foo" })
  .input(z.string())
  .handler(async ({ input, context }) => {
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 100));
    return `${input} processed for ${context.userId}`;
  });

// Usage (context provided at call time)
// const result2 = await withAsyncContext({
//   input: "hello",
//   context: { userId: "user-123" }
// });
// console.log(result2); // [ "hello processed for user-123", null, false ]

// Example 3: Context with typed errors
const withErrors = zagora()
  .$context<{ userId: string }>({ userId: "test" })
  .input(z.object({ action: z.string() }))
  .errors({
    UNAUTHORIZED: z.object({
      type: z.literal("UNAUTHORIZED"),
      message: z.string(),
    }),
  })
  .handler(({ input, context }, errors) => {
    if (context.userId !== "admin") {
      throw errors.UNAUTHORIZED({ message: "Not admin" });
    }
    return { success: true, action: input.action, user: context.userId };
  });

// Usage
const result3 = withErrors({
  input: { action: "read" },
  context: { userId: "test" },
});
console.log(result3); // [ { success: true, action: "read", user: "test" }, null, false ]

// Example 4: Context with complex types
const complexContext = zagora()
  .$context<{ user: { id: string; name: string }; requestId: string }>()
  .input(z.object({ message: z.string() }))
  .output(z.object({ response: z.string(), userId: z.string() }))
  .handler(({ input, context }) => {
    // context.user and context.requestId are fully typed
    return {
      response: `Hello ${context.user.name}, ${input.message}`,
      userId: context.user.id,
    };
  });

// Usage
const result4 = complexContext({
  input: { message: "how are you?" },
  context: {
    user: { id: "123", name: "John" },
    requestId: "req-456",
  },
});
console.log(result4); // [ { response: "Hello John, how are you?", userId: "123" }, null, false ]

// export { basicWithContext, withAsyncContext, withErrors, complexContext };
