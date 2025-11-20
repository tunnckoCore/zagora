import { z } from "zod";
import { zagora } from "./index";

function testSimple() {
  // Test 1: Simple tuple with required elements - should work
  const simple = zagora()
    .input(z.tuple([z.string(), z.number()]))
    .handler((name, id) => {
      return `${name}-${id}`;
    });

  try {
    // @ts-expect-error -- should report error because missing required second argument
    simple("test");
  } catch {}

  try {
    // @ts-expect-error - the line below must be reporting expected error and ignored, not this line here
    simple("test", "foo bar"); // properly report type error at arg level
  } catch {}

  const res1 = simple("barry", 111); // should not report error - passed a second arg number
  console.assert(res1 === "barry-111");
}

function testOptional() {
  // Test 2: Tuple with .optional() - this fails
  const withOptional = zagora()
    .input(z.tuple([z.string(), z.number().optional()]))
    .handler((name, id) => {
      return `${name}-${id}`;
    });

  const res1 = withOptional("foo"); // should not report error - second arg is optional
  const res2 = withOptional("foo", 111); // should not report error - passed a second arg number

  console.assert(res1 === "foo-undefined");
  console.assert(res2 === "foo-111");

  try {
    // @ts-expect-error - the line below must be reporting expected error and ignored, not this line here
    withOptional("test", "foo bar"); // should report type error at the arg level
  } catch {}
}

function testDefault() {
  // Test 3: Tuple with .default() - this fails
  const withDefault = zagora()
    .input(z.tuple([z.string(), z.number().default(123)]))
    .handler((name, id) => {
      // `id` must be type as `number` only,
      // but is incorrectly typed as `number | undefined`
      return `${name}-${id}`;
    });

  const res1 = withDefault("test"); // should not report error - second arg is with default number value
  // incorrectly results in `test-undefined` while the `id` param is typed as `number`
  // so the default value is not applied properly when it's on a primitive.
  console.log(res1);
  console.assert(res1 === "test-123");

  const res2 = withDefault("test", 456); // should not report error - passed a second arg number
  console.assert(res2 === "test-456");
  try {
    // @ts-expect-error - the line below must be reporting expected error and ignored, not this line here
    withDefault("test", "foo bar"); // should report type error at the arg level
  } catch {}
}

function testPing() {
  const SpeedSchema = z.enum(["slow", "medium", "fast"]);
  const InputSchema = z.tuple([
    z.string(),
    SpeedSchema,
    z.number().default(123),
  ]);

  const ping = zagora()
    .input(InputSchema)
    .handler((_str, speed, port) => {
      console.log(`Pinging with ${speed} speed on port ${port}`);
      return `${speed}-${port}`;
    });

  try {
    // @ts-expect-error -- below line should report error `number is not a string`
    ping(10);
  } catch {}

  try {
    // @ts-expect-error -- below line should report error `123 is not of type "slow" | "medium" | "fast"`
    ping("hi", 20);
  } catch {}

  try {
    // @ts-expect-error -- below line should report error `string is not of type "slow" | "medium" | "fast"`
    ping("hi", "sasa");
  } catch {}

  try {
    // @ts-expect-error -- below line should report error `string is not number`
    ping("hi", "medium", "barry");
  } catch {}

  const res = ping("hi", "slow", 30);
  console.assert(res === "slow-30");
}

function testGetPrice() {
  const getPrices = zagora()
    .input(
      z.tuple([
        z.string(),
        z.object({
          id: z.string().uuid(),
          price: z.number().min(0).max(1000).default(10),
          user: z.string().optional(),
        }),
      ]),
    )
    .handler((name, product) => {
      // product.price is properly ALWAYS a number!
      // product.user is properly `string | undefined`
      console.log(
        `Getting prices for ${name} with product ${product.id}:`,
        product.price,
        "and user >>",
        product.user,
        "<<",
      );
      return `${name}-${product.id}-${product.user}-${product.price}`;
    });

  const uuid = crypto.randomUUID();
  const price1 = getPrices("sasa", { id: uuid });
  console.assert(price1 === `sasa-${uuid}-undefined-10`);
  const price2 = getPrices("sasa", { id: uuid, user: "barry" });
  console.assert(price2 === `sasa-${uuid}-barry-10`);
}

function testPrimitiveSchemas() {
  const basicSchema = z.string().min(2).max(10);
  const objectSchema = z.object({
    id: z.string().uuid(),
    price: z.number().min(0).max(1000).default(10),
    user: z.string().optional(),
  });
  const arraySchema = z.array(basicSchema);

  const func1 = zagora()
    .input(basicSchema)
    .handler((name) => {
      console.log(`Hello ${name}`);
      return `Hello ${name}`;
    });

  const res1 = func1("sasa");
  console.assert(res1 === "Hello sasa");

  const func2 = zagora()
    .input(objectSchema)
    .handler((product) => {
      const msg = `Hello with product ${product.id}-${product.user}-${product.price}`;
      console.log(msg);
      return msg;
    });

  const uuid = crypto.randomUUID();
  const res2 = func2({ id: uuid });
  console.assert(res2 === `Hello with product ${uuid}-undefined-10`);
  const res21 = func2({ id: uuid, user: "foo", price: 30 });
  console.assert(res21 === `Hello with product ${uuid}-foo-30`);

  const func3 = zagora()
    .input(arraySchema)
    .handler((names) => {
      console.log(`Hello ${names.join(", ")}`);
      return `Hello ${names.join(", ")}`;
    });

  const res3 = func3(["foo", "bar", "baz"]);
  console.assert(res3 === "Hello foo, bar, baz");
}

testSimple();
testOptional();
testDefault();
testPing();
testGetPrice();
testPrimitiveSchemas();
