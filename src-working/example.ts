import z from "zod";
import { zagora } from "./index";

const SpeedSchema = z.enum(["slow", "medium", "fast"]);
const InputSchema = z.tuple([z.string(), SpeedSchema, z.number().default(123)]);

const ping = zagora()
  .input(InputSchema)
  .handler((speed, port) => {
    console.log(`Pinging with ${speed} speed on port ${port}`);
    return `${speed}-${port}`;
  });

// @ts-expect-error -- below line should report error `number is not a string`
ping(123);

// @ts-expect-error -- below line should report error `number is not of type "slow" | "medium" | "fast"`
ping("hi", 123);

// @ts-expect-error -- below line should report error `string is not of type "slow" | "medium" | "fast"`
ping("hi", "sasa");

ping("hi", "slow", 123);
ping("hi", "medium", "barry");

const getPrices = zagora()
  .input(
    z.tuple([
      z.string(),
      z.object({
        id: z.string().uuid(),
        price: z.number().min(0).max(1000).default(10),
      }),
    ]),
  )
  .handler((name, product) => {
    console.log(`Getting prices for ${name} with product ${product.id}`);
    return `${name}-${product.id}-${product.price}`;
  });

getPrices("sasa", { id: "123" });
