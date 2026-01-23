# Implementation of Zagora v3 simplified

How about we simplify.

Here's the design goal:

```ts
import { zagora } from 'zagora';

const za = zagora();

const hello = za
  .$context<{ sessionId: string }>() // <-- no initial context passed, that's use only for type definition
  .errors({
    UNAUTHORIZED: z.object({
      type: z.literal('UNAUTHORIZED'),
      user: z.string().min(1).max(100),
      id: z.number().min(1).max(1000).default(100)
    })
  })
  .input(
    z.tuple([
      z.string().min(1).max(100), 
      z.number().min(1).max(1000).default(100)
    ])
  )
  .output(z.object({
    role: z.enum(['admin', 'user', 'guest']),
    username: z.string()
  }))
  // `options` is always passed even if no errors and no context (eg. could be undefined but passed)
  .handler((options, user, id) => {
    const { errors, context } = options;
    
    if (id > 100) {
      throw errors.UNAUTHORIZED({ user, id });
    }
    return { role: 'user', username: `${user}-${id}-${context.sessionId}` };
  })
  .callable({ sessionId: 'foo123'});

const result = hello('John', 101);
// => { data, error, isDefined }

// optionally users may omit the `.callable()` call above
// and the `hello` would be an instance and they should call the .callable later.
// like `hello.callable({ sessionId: 'foo123' })`
```

No "context mode", we use `.$context()` as just context type definition, if not passed then `context` in the "options" object (the first argument of the handler) should be typed as `undefined`.

The procedures/actions/handlers will always receive first argument "options" contianing the generated error helpers, and the context (if any). The returned "procedure" is basically an instance also having `.callable` method which can be used to call the procedure with the provided context (the argument must match the defined context type from the `.$context()` call), and return the actual procedure function which accepts the input parameters and returns the output. Like currying.

The `.$context()` method should not accept any arguments, as it is used only for type definition and does not require any runtime context.

All this is done to provide a flexible and type-safe way to define and call procedures, actions, and handlers in a consistent manner. And allow us to have easy wrapper features and helpers, router concept and etc.

If there is no errors map provided through the `.errors()` then the `options.errors` will be undefined too.

If there's no `.$context()` call and no `.errors()` call, then the options argument would still be provided, but an empty object. The assumption is that they should always just ignore the first argument of handler signature if they don't need it - like `.handler((_, foo, bar) => {})`.

---

You can read the `src-basic/index.ts` file for very simple implementation, you can use it as a base.
Make a new folder like `src-v4` and start from scratch there, having in mind the `src-basic` way of implementation - not exactly the implementation, but the type system is working great for sync and async handlers, for tuple schemas being threated as spread arguments (eg. `z.tuple([z.string(), z.number()]))` for `hello("foo", 123)`) and etc. It's just good, and not so complex as in the original `src` implementation.

Use separate interfaces and a class, not everything in the class because it's messy.
Similar to how this is done:

```ts
export interface BuilderDef<
  TInitialContext extends Context,
  TCurrentContext extends Context,
  TInputSchema extends AnySchema,
  TOutputSchema extends AnySchema,
> extends Omit<
    ProcedureDef<TInitialContext, TCurrentContext, TInputSchema, TOutputSchema>,
    'handler'
  > {}

export class Builder<
  TInitialContext extends Context,
  TCurrentContext extends Context,
  TInputSchema extends AnySchema,
  TOutputSchema extends AnySchema,
> {
```

don't replicate it exactly, i'm just showing what i mean with "separate interfaces and a class".

LFG!
