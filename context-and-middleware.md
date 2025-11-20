ignore the existing markdown files, and src-* & tuple-debugging folders.

consider we have just src/, test/, and README.md - read them to get a sense of what is the project. It is similar to orpc/trpc but for libraries, a lower-level library with a few
key differences.

We are using Bun! DO NOT EVER TOUCH NPM OR NODE! Use `bun run test`, or `bun run file.ts`. Tests are written with `bun:test` testing framework (similar to the node:test, and jest).

Currently the tests are working, everything is perfect. Do not ever touch the original files!

Start in a new directory like src-v3 - copy the existing files and structure from the src/ dir. We are already in a v3-context-and-middleware git branch. Do not make commits.

So, the purpose: read the PROMPT.md - we need to add "context" and "middlewares". The idea is to have 3 new methods - `.use(authMiddleware)`, `.middleware` that helps _DEFINE_
middlewares, and a `.$context<Context>(optionalInitialContext)`

In "context mode" procedure handlers should receive a single object `{ input, context }` and a second arg to be the `errors` - representing the generated error helpers built from
error schemas defined through `.errors()`.

Again, read the `PROMPT.md` FILE for more details!
DO NOT WRITE ACTUAL TESTS! DO NOT WRITE DOC & SUMMARY FILES!
BE CONCISE AND FOCUSED.
