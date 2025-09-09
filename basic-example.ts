import z from "zod";
import { zagora } from "./src/index.ts";

const SpeedSchema = z.enum(["slow", "normal", "fast"]);

const hello = zagora()
  .input(z.tuple([SpeedSchema, z.number().default(123)]))
  .output(
    z.object({
      foo: z.string().min(1),
    })
  )
  .handler(async (speed, retry) => {
    const result = await fetch(
      "https://jsonplaceholder.typicode.com/todos/1"
    ).then((x) => x.json());

    return { foo: [(result as any)?.title, speed, retry].join(" + ") };
  });

const [resHello, errHello] = await hello("fast");

console.log({ resHello, errHello });
