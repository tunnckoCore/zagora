1. schema.validate can return promise - handle that with no `async/await` just `instanceof Promise` and `.then`s
2. add createResult util - `{ data, error }` and `[data, error]` patterns - never throwing functions/handlers
3. support for both sync and async handlers - handle that with no `async/await` just `instanceof Promise` and `.then`s
4. support for output schema - with `.output`
5. support for `.handler` always receive first param be `options` - like `{errors, context}` - the `errors` have to be helper functions that throw objects not errors! like `errors.NOT_FOUND({ user: 'foo' })` if `.errors({ NOT_FOUND: z.object({ type: z.literal('NOT_FOUND), user: z.string() }) })`
6. support for `.$context<Context>()` for defining a type for `options.context`
7. support for `.errors(errorMap)` - be `Record<string, Schema>`
8. update createResult to be `{ data, error, isDefined }` and `[data, error, isDefined]`
