import z from "zod";

// ============================================================================
// SPREADABLE TUPLE - Convert tuple type to function overloads with valid param order
// ============================================================================

type IsOptional<T> = undefined extends T ? true : false;

type SpreadTuple<T extends readonly any[], R> = T extends readonly [infer A]
  ? (arg: A) => R
  : T extends readonly [infer A, infer B]
    ? IsOptional<B> extends true
      ? ((arg1: A, arg2?: B) => R) | ((arg1: A) => R)
      : ((arg1: A, arg2: B) => R) | ((arg1: A) => R)
    : T extends readonly [infer A, infer B, infer C]
      ? IsOptional<B> extends true
        ? IsOptional<C> extends true
          ?
              | ((arg1: A, arg2?: B, arg3?: C) => R)
              | ((arg1: A, arg2?: B) => R)
              | ((arg1: A) => R)
          :
              | ((arg1: A, arg2?: B, arg3?: C) => R)
              | ((arg1: A, arg2?: B) => R)
              | ((arg1: A) => R)
        : IsOptional<C> extends true
          ?
              | ((arg1: A, arg2: B, arg3?: C) => R)
              | ((arg1: A, arg2: B) => R)
              | ((arg1: A) => R)
          :
              | ((arg1: A, arg2: B, arg3: C) => R)
              | ((arg1: A, arg2: B) => R)
              | ((arg1: A) => R)
      : T extends readonly [infer A, infer B, infer C, infer D]
        ? IsOptional<B> extends true
          ? IsOptional<C> extends true
            ? IsOptional<D> extends true
              ?
                  | ((arg1: A, arg2?: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2?: B, arg3?: C) => R)
                  | ((arg1: A, arg2?: B) => R)
                  | ((arg1: A) => R)
              :
                  | ((arg1: A, arg2?: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2?: B, arg3?: C) => R)
                  | ((arg1: A, arg2?: B) => R)
                  | ((arg1: A) => R)
            : IsOptional<D> extends true
              ?
                  | ((arg1: A, arg2?: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2?: B, arg3?: C) => R)
                  | ((arg1: A, arg2?: B) => R)
                  | ((arg1: A) => R)
              :
                  | ((arg1: A, arg2?: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2?: B, arg3?: C) => R)
                  | ((arg1: A, arg2?: B) => R)
                  | ((arg1: A) => R)
          : IsOptional<C> extends true
            ? IsOptional<D> extends true
              ?
                  | ((arg1: A, arg2: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2: B, arg3?: C) => R)
                  | ((arg1: A, arg2: B) => R)
                  | ((arg1: A) => R)
              :
                  | ((arg1: A, arg2: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2: B, arg3?: C) => R)
                  | ((arg1: A, arg2: B) => R)
                  | ((arg1: A) => R)
            : IsOptional<D> extends true
              ?
                  | ((arg1: A, arg2: B, arg3: C, arg4?: D) => R)
                  | ((arg1: A, arg2: B, arg3: C) => R)
                  | ((arg1: A, arg2: B) => R)
                  | ((arg1: A) => R)
              :
                  | ((arg1: A, arg2: B, arg3: C, arg4?: D) => R)
                  | ((arg1: A, arg2: B, arg3: C) => R)
                  | ((arg1: A, arg2: B) => R)
                  | ((arg1: A) => R)
        : (...args: T) => R;

// ============================================================================
// BUILDER
// ============================================================================

class Builder<TSchema extends z.ZodType<any, any, any> = never> {
  private schema?: TSchema;

  input<T extends z.ZodType<any, any, any>>(schema: T): Builder<T> {
    const builder = new Builder<T>();
    (builder as any).schema = schema;
    return builder;
  }

  handler<
    TFn extends z.input<TSchema> extends readonly any[]
      ? (...args: z.output<TSchema>) => any
      : (arg: z.output<TSchema>) => any,
  >(
    fn: TFn,
  ): z.input<TSchema> extends readonly any[]
    ? SpreadTuple<z.input<TSchema>, ReturnType<TFn>>
    : z.input<TSchema> extends any
      ? (arg: z.input<TSchema>) => ReturnType<TFn>
      : never {
    const schema = this.schema!;
    const wrapped = (...args: any[]) => {
      const parsed =
        schema._def.type === "tuple"
          ? schema.parse(args)
          : schema.parse(args[0]);
      return schema._def.type === "tuple"
        ? (fn as (...args: any[]) => any)(...(parsed as any[]))
        : (fn as (arg: any) => any)(parsed);
    };
    return wrapped as any;
  }
}

function builder() {
  return new Builder();
}

// ============================================================================
// TESTS
// ============================================================================

// Test 1: Tuple with defaults
const proc1 = builder()
  .input(z.tuple([z.string(), z.number().default(42)]))
  .handler((name, age) => ({
    // passing!
    // name: string
    // age: number - must be, because it's defaulted to 42
    message: `${name} is ${age}`,
  }));

console.log("Test 1a:", proc1("Alice"));
console.log("Test 1b:", proc1("Bob", 30));

// Test 1b: Tuple with default + optional
const proc1b = builder()
  .input(z.tuple([z.string(), z.number().default(42), z.boolean().optional()]))
  .handler((name, age, verified) => ({
    // passing!
    // name: string
    // age: number - must be, because it's defaulted to 42
    // verified: boolean | undefined - because it's optional
    message: `${name} is ${age}, verified: ${verified ?? false}`,
  }));

// should pass because verified is optional
// and because age is defaulted to 42
console.log("Test 1b1:", proc1b("Alice"));

// should pass because verified is optional and age is passed
console.log("Test 1b2:", proc1b("Bob", 30));
console.log("Test 1b3:", proc1b("Carol", 25, true));

// Test 2: Primitive input
const proc2 = builder()
  .input(z.string())
  .handler((name) => {
    // passing!
    // name: string
    return `Hello ${name}!`;
  });

console.log("Test 2:", proc2("World"));

// Test 3: Object input
const proc3 = builder()
  .input(z.object({ x: z.number(), y: z.number().default(2) }))
  .handler((input) => {
    // input: { x: number, y: number } - because y is defaulted to 2
    return input.x + input.y;
  });

console.log("Test 3:", proc3({ x: 5, y: 3 }));

// Test 4: Object with defaults and optionals
const proc4 = builder()
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
  .handler((name, config) => ({
    // passing!
    // config: { user: string, role: string, paid: boolean | undefined }
    result: `${name}: role=${config.role}, paid=${config.paid ?? false}`,
  }));

// SHOULD NOT REQUIRE `role` to be passed because it has a default value!
console.log("Test 4a:", proc4("Alice", { user: "alice" }));
console.log("Test 4b:", proc4("Bob", { user: "bob", role: "moderator" }));
console.log(
  "Test 4c:",
  proc4("Carol", { user: "carol", role: "admin", paid: true }),
);

console.log("\nAll tests passed!");
