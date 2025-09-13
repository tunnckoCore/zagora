import { expect, test } from "bun:test";
import * as v from "valibot";
import z from "zod";
import { zagora } from "../src/finalizing.ts";

test("Zod tuple with default values - basic case", async () => {
  const SpeedSchema = z.enum(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(z.tuple([SpeedSchema, z.number().default(123)]))
    .output(
      z.object({
        foo: z.string().min(1),
      })
    )
    .handler((speed, retry) => {
      return { foo: `${speed}-${retry}` };
    });

  const [resHello, errHello] = hello("fast");

  expect(errHello).toBe(null);
  expect(resHello).toEqual({ foo: "fast-123" });
});

test("Zod tuple with default values - both args provided", async () => {
  const SpeedSchema = z.enum(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(z.tuple([SpeedSchema, z.number().default(123)]))
    .output(
      z.object({
        foo: z.string().min(1),
      })
    )
    .handler(async (speed, retry) => {
      return { foo: `${speed}-${retry}` };
    });

  const [resHello, errHello] = await hello("slow", 456);

  expect(errHello).toBe(null);
  expect(resHello).toEqual({ foo: "slow-456" });

  const hello2 = zagora()
    .input(z.tuple([SpeedSchema, z.number().default(123)]))
    .output(
      z
        .object({
          foo: z.string().min(1),
        })
        .strict()
    )
    .handler(async (speed, retry) => {
      return { foo: `${speed}-${retry}`, bar: "barry" };
    });

  const [resHello2, errHello2] = await hello2("slow", 456);

  expect(errHello2?.reason).toContain("utput validation failed");
  expect(resHello2).toBeEmpty();
});

test("Zod tuple with multiple defaults", async () => {
  const SpeedSchema = z.enum(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(
      z.tuple([
        SpeedSchema,
        z.number().default(123),
        z.string().default("bruh"),
      ])
    )
    .output(
      z.object({
        foo: z.string().min(1),
      })
    )
    .handler(async (speed, retry, extra) => {
      return { foo: `${speed}-${retry}-${extra}` };
    });

  const [resHello, errHello] = await hello("normal");

  expect(errHello).toBe(null);
  expect(resHello).toEqual({ foo: "normal-123-bruh" });
});

test("Valibot tuple with default values - basic case", async () => {
  const SpeedSchema = v.picklist(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(v.tuple([SpeedSchema, v.optional(v.number(), 123)]))
    .output(
      v.object({
        foo: v.pipe(v.string(), v.minLength(1)),
      })
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
});

test("Valibot tuple with default values - both args provided", async () => {
  const SpeedSchema = v.picklist(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(v.tuple([SpeedSchema, v.optional(v.number(), 123)]))
    .output(
      v.object({
        foo: v.pipe(v.string(), v.minLength(1)),
      })
    )
    .handler(async (speed, retry) => {
      return { foo: `${speed}-${retry}` };
    });

  const [resHello, errHello] = await hello("slow", 456);

  expect(errHello).toBe(null);
  expect(resHello).toEqual({ foo: "slow-456" });
});

test("Tuple without defaults - should not break existing functionality", async () => {
  const SpeedSchema = z.enum(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(z.tuple([SpeedSchema, z.number()]))
    .output(
      z.object({
        foo: z.string().min(1),
      })
    )
    .handler(async (speed, retry) => {
      return { foo: `${speed}-${retry}` };
    });

  const [resHello, errHello] = await hello("fast", 456);

  expect(errHello).toBe(null);
  expect(resHello).toEqual({ foo: "fast-456" });
});

test("Tuple without defaults - missing required arg should fail", async () => {
  const SpeedSchema = z.enum(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(z.tuple([SpeedSchema, z.number()]))
    .output(
      z.object({
        foo: z.string().min(1),
      })
    )
    .handler(async (speed, retry) => {
      return { foo: `${speed}-${retry}` };
    });

  // @ts-expect-error should fail, we test mising required argument
  const [resHello, errHello] = await hello("fast");

  expect(resHello).toBe(null);
  expect(errHello).toBeDefined();
  expect(errHello?.message).toContain("Invalid input");
});
