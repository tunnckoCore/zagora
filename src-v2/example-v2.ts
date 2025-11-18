import { z } from "zod";
import { zagora } from "./index";

// ============================================================================
// Example 1: Simple procedure without context or middleware
// ============================================================================

const ping = zagora()
  .input(z.number())
  .output(z.object({ pong: z.number() }))
  .handler((id) => {
    return { pong: id + 1 };
  });

// Call synchronously, no try-catch needed
ping(42);

// ============================================================================
// Example 2: Simple procedure with middleware (no context)
// ============================================================================

const pubWithInput = zagora().input(z.number());

// Middleware defined from builder with input already set
const logger = pubWithInput.middleware(({ input, context, next }) => {
  console.log("Logging input:", input);
  // input is typed as number because pubWithInput has .input(z.number())
  return next({ context, input });
});

const pingWithLogger = pubWithInput
  .use(logger)
  .output(z.object({ pong: z.number() }))
  .handler((id) => {
    return { pong: id + 1 };
  });

pingWithLogger(42);

// ============================================================================
// Example 3: Middleware with input mapper
// ============================================================================

const getUserPub = zagora().input(
  z.object({ id: z.number(), name: z.string() }),
);

// Middleware explicitly typed to receive only the ID (number)
// When used with a mapper, the middleware input type matches the mapper's return type
const validateId = getUserPub.middleware<number>(({ input, next }) => {
  // input is explicitly typed as number (from the generic TMWInput)
  if (input < 0) {
    throw new Error("ID must be positive");
  }
  return next({ input });
});

const getUserWithValidation = getUserPub
  // mapper transforms full input to just the ID (number), which matches validateId's input type
  .use(validateId, (fullInput) => fullInput.id)
  .output(z.object({ user: z.string() }))
  .handler((input) => {
    // input is still the full object: { id: number, name: string }
    return { user: `${input.name} (${input.id})` };
  });

getUserWithValidation({ id: 1, name: "Alice" });

// ============================================================================
// Example 4: With context (no middleware initially)
// ============================================================================

const adminPub = zagora()
  .$context<{ userId: string; role: string }>()
  .input(z.number());

const deleteResource = adminPub
  .output(z.object({ deleted: z.boolean() }))
  .handler(({ input, context }) => {
    // input is number, context is { userId: string; role: string }
    if (context.role !== "admin") {
      throw new Error("Unauthorized");
    }
    return { deleted: true };
  });

// When calling context-based procedures, pass { input, context }
deleteResource({
  input: 123,
  context: { userId: "user1", role: "admin" },
});

// ============================================================================
// Example 5: With context AND middleware
// ============================================================================

const appPubBase = zagora()
  .$context<{ userId: string; requestId: string }>()
  .input(z.object({ title: z.string() }));

// Middleware that enriches context
const addRequestId = appPubBase.middleware(({ context, next, input }) => {
  const enrichedContext = {
    ...context,
    requestId: `req-${Date.now()}`,
  };
  return next({ context: enrichedContext });
});

const requireAuth = appPubBase.middleware(({ context, next }) => {
  if (!context.userId) {
    throw new Error("Not authenticated");
  }
  return next({ context });
});

const createItem = appPubBase
  .use(addRequestId)
  .use(requireAuth)
  .output(z.object({ id: z.string(), requestId: z.string() }))
  .handler(({ input, context }) => {
    return {
      id: `item-${Date.now()}`,
      requestId: context.requestId,
    };
  });

createItem({
  input: { title: "New Item" },
  context: { userId: "user123", requestId: "" },
});

// ============================================================================
// Example 6: With context, input, middleware, and error schemas
// ============================================================================

const richPub = zagora()
  .$context<{ userId: string; role: string }>()
  .input(z.number())
  .errors({
    Unauthorized: z.object({
      type: z.literal("Unauthorized"),
      reason: z.string(),
    }),
    NotFound: z.object({
      type: z.literal("NotFound"),
      resourceId: z.number(),
    }),
  });

const checkAdmin = richPub.middleware(({ context, errors, next }) => {
  if (context.role !== "admin") {
    throw errors.Unauthorized({ reason: "Admin access required" });
  }
  return next({ context });
});

const validateResourceId = richPub.middleware(({ input, errors, next }) => {
  // input is typed as number because richPub has .input(z.number())
  if (input <= 0) {
    throw errors.NotFound({ resourceId: input });
  }
  return next({ input });
});

const updateResource = richPub
  .use(checkAdmin)
  .use(validateResourceId)
  .output(z.object({ updated: z.boolean() }))
  .handler(({ input, context }) => {
    return { updated: true };
  });

updateResource({
  input: 5,
  context: { userId: "user1", role: "admin" },
});

// ============================================================================
// Example 7: Async middleware
// ============================================================================

const asyncPub = zagora().input(z.number());

const fetchUserMiddleware = asyncPub.middleware(async ({ input, next }) => {
  // Simulate async work
  const user = await new Promise<{ id: number; name: string }>((resolve) => {
    setTimeout(() => resolve({ id: input, name: "User " + input }), 10);
  });

  console.log("Fetched user:", user);
  return next({ input });
});

const withAsyncMiddleware = asyncPub
  .use(fetchUserMiddleware)
  .output(z.object({ ready: z.boolean() }))
  .handler((id) => {
    return { ready: true };
  });

// This returns a promise because the middleware is async
withAsyncMiddleware(10);

// ============================================================================
// Example 8: Tuple input (simple, without middleware)
// ============================================================================

const tuplePub = zagora().input(z.tuple([z.string(), z.number().default(123)]));

const tupleHandler = tuplePub.output(z.string()).handler((name, id) => {
  // Tuple inputs expand to multiple parameters in the handler
  return `${name}-${id}`;
});

tupleHandler("test", "foo bar");

// ============================================================================
// Summary: Key API principles (no as any, no assertions, no try-catch at call-sites)
// ============================================================================
//
// 1. `.middleware()` - Creates a middleware definition
//    - Captures the builder's current state (input schema, context type, error schemas)
//    - Returns a function that can be passed to `.use()`
//    - Middleware receives: { input, context, errors, next }
//    - input type is inferred from builder's input schema (or undefined)
//    - context type is inferred from builder's context (or never)
//    - errors has typed helpers if .errors() was called
//
// 2. `.use(middleware, inputMapper?)` - Attaches middleware to procedure
//    - inputMapper (optional) transforms full input before passing to middleware
//    - If no mapper, middleware receives the full input as-is
//    - If mapper provided, middleware input type is inferred from mapper return type
//    - Multiple .use() calls chain middlewares in order
//    - Can throw or call next() to continue chain
//
// 3. `.handler(impl)` - Terminal operation that creates the procedure
//    - Handler signature depends on whether context is present:
//      - Without context: (input) => ... or (input, errors) => ...
//      - With context: ({ input, context }) => ... or ({ input, context }, errors) => ...
//    - Can throw errors (library converts to typed ZagoraResult)
//    - If any middleware is async, procedure returns a Promise
//    - For tuple inputs, handler expands to multiple parameters: (arg1, arg2, ...) => ...
//
// 4. Calling procedures:
//    - Without context: procedure(input) or procedure(arg1, arg2, ...) for tuples
//    - With context: procedure({ input, context })
//    - No try-catch needed at call-sites (procedures return ZagoraResult)
//    - Result has: [data, error, isDefined] + .data, .error, .isDefined properties
//
// 5. Error schemas:
//    - Must define type: z.literal("ErrorKey") matching the object key
//    - Error helpers automatically include the type field
//    - Handlers can throw error helpers or return error objects
//
// 6. Types flow naturally:
//    - No explicit type annotations needed
//    - No "as any" casts required
//    - No runtime assertions needed
