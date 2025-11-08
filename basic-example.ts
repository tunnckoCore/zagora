// import z from "zod";
// import { zagora } from "./src/index.ts";

import * as v from "valibot";
import { zagora } from "./src";

// const SpeedSchema = z.enum(["slow", "normal", "fast"]);

// const hello = zagora()
//   .input(z.tuple([SpeedSchema, z.number().default(123)]))
//   .output(
//     z.object({
//       foo: z.string().min(1),
//     }),
//   )
//   .handler(async (speed, retry) => {
//     const result = await fetch(
//       "https://jsonplaceholder.typicode.com/todos/1",
//     ).then((x) => x.json());

//     return { foo: [(result as any)?.title, speed, retry].join(" + ") };
//   });

// const [resHello, errHello] = await hello("fast");

// console.log({ resHello, errHello });

// const fn = zagora()
//   .input(v.object({ name: v.string(), age: v.optional(v.number(), 123) }))
//   .output(v.string())
//   .handler((obj) => `${obj.name} is ${obj.age}`);

// const res = fn({ name: 123, age: "thirty" } as any);

// console.log("expected err->>", res.error);

// const res2 = fn({ name: "barry" });
// console.log("expected success->>", res2.data);

const SpeedSchema = v.picklist(["slow", "normal", "fast"]);

const hello = zagora()
  .input(v.tuple([SpeedSchema, v.optional(v.number(), 123)]))
  .output(
    v.object({
      foo: v.pipe(v.string(), v.minLength(1)),
    }),
  )
  .handler(async (speed, retry) => {
    return { foo: `${speed}-${retry}` };
  });

// TODO: expected error for valibot; for zod it works; it does work for per-arg type validation
// const [resHello, errHello] = await hello("fast"); // would signal incorrectly at `hello` for missing second arg
// const [resHello, errHello] = await hello("fast", "sasa"); // would signal `"sasa"` that it expects number
// const [resHello, errHello] = await hello("fast", 123); // would not type error, all args are fine and provided

// @ts-expect-error expected for valibot
const [resHello, errHello] = await hello("fast");

expect(errHello).toBe(null);
expect(resHello).toEqual({ foo: "fast-123" });
