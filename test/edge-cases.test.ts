import { expect, test } from "bun:test";
import * as v from "valibot";
import z from "zod";
import { zagora } from "../src/index.js";

test("Zod tuple with default values - basic case", async () => {
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

  const [resHello, errHello] = await hello("fast");

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

  expect(errHello2?.reason).toContain("Failure caused by validation");
  expect(resHello2).toBeEmpty();
});

test("Zod tuple with multiple defaults", async () => {
  const SpeedSchema = z.enum(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(
      z.tuple([
        SpeedSchema,
        z.number().default(123),
        z.string().default("test"),
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
  expect(resHello).toEqual({ foo: "normal-123-test" });
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

  const [resHello, errHello] = await hello("fast");

  expect(resHello).toBe(null);
  expect(errHello).toBeDefined();
  expect(errHello?.message).toContain("Invalid input");
});
