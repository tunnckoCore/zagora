stop fucking doing bullshit, i have deleted the example-v2.ts.

fix the fuking implementation at `src-v2` first, you fuck.

here's the fucking description, AGAIN:

1. we would have `.use(middleware, inputMapper)` - whatever is returned from the mapper is actually passed as `input` in the middleware function definition. eg. `.middleware({ input })` <-- this "input".

2. middlewares should work in both modes - with or without "context".

3. if a middleware is "used" - eg. `.use(middleware)` (without input mapper) AND AFTER the definition of `.input(schema)` then the "input" prop destructured in the middleware handler definition should infer from that schema. If there is a mapper, the "input" param type should be inferred from the return type of the mapper.

4. if middleware is "used" without having input schema definition before that then the "input" prop would be undefined cuz the middleware won't accept the input.

---

clarification for the two modes - "with and without context":

currently the library have 2 modes:

- without context, called "basic" - eg. `zagora().input(z.number()).handler((input /* typed as number */) => {})

- with context (and no middleware), when `zagora().$context<InitialContext>(initialContext).input(z.number()).handler(({ input, context }) => {})`

- with context AND with middleware - where users can set context from middlewares `zagora().$context<Context>(initialContext).use(({ context, next }) => next({ context: { ...context, foo: 123 } }))`


The "without context, but with middleware" case is like the following:

```ts
const pub = zagora()
const logger = pub.middleware(({ input, context, next }) => {
  // context is empty, but it's good practice to pass it down.

  console.log('logging...', input);
  return next({ input, context })
});

const ping = pub
  .input(z.number())
  .use(logger) // logger would recieve the input when `ping` is called
  .output(z.number())
  .handler((num) => num + 1);

ping(100); // notice, no await needed either cuz handler is synchronous!

const validateId = pub.middleware(({ input: id, context, next, errors }) => {
  // context is empty, but it's good practice to pass it down.

  // the `input/id` must be with proper type,
  // eg. inferred from the return of the mapper
  // which in turn is inferred/coming from the input schema!

  // the `errors` are the error helpers generated from the error schemas,
  // just like they are passed to `.handler`, they are here too,
  // if and only if there is `.errors()` schemas defined.

  if (id > 5) {
    throw new Error('wrong user id')
  }

  return next({ input, context })
});

const getUser = pub
  .input(z.object({ id: z.number() }))

  // passes the full input object to `logger` middleware
  .use(logger)

  // passes only the `input.id` to the `validateId` middleware
  .use(validateId, (fullInput) => fullInput.id)

  .handler((input) => {
    return { user: `user_${input.id}`, ok: true }
  })
```

that above is great, that's the API design we are striving for! No explicit type definitions, no assertions.

All of the above should work for the context mode too, it's just that middleware handlers/functions would just get the `context` prop.

---

asynchronous or synchornous middlewares should still be supported.


```ts
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
//
// 4. Calling procedures:
//    - Without context: procedure(input)
//    - With context: procedure({ input, context })
//    - No try-catch needed at call-sites (procedures return ZagoraResult)
//    - Result has: [data, error, isDefined] + .data, .error, .isDefined properties
//
// 5. Types flow naturally:
//    - No explicit type annotations needed
//    - No "as any" casts required
//    - No runtime assertions needed
```
