import { expect, test } from "bun:test";
import * as v from "valibot";
import z from "zod";
import { zagora } from "../src/index.ts";

test("typed errors handler arg should be second arg when no input schema ", () => {
  const errorSchemas = {
    SOME_ERR: z.object({
      type: z.literal("SOME_ERR"),
      msg: z.string().default("Unknown error"),
      foo: z.number().min(100).max(999).default(500),
    }),
  };

  const func = zagora()
    .errors(errorSchemas)
    .handler((_, err) => {
      throw err.SOME_ERR({ msg: "Custom error" });
    });

  const res = func();
  expect(res.isDefined).toBe(true);

  if (res.isDefined && res.error.type === "SOME_ERR") {
    expect(Object.keys(errorSchemas)[0]).toBe(res.error.type);
    expect(res.error.type).toBe("SOME_ERR");
    expect(res.error.msg).toBe("Custom error");
    expect(res.error.foo).toBe(500);
  } else {
    throw new Error("Expected SOME_ERR, but got: " + JSON.stringify(res.error));
  }
});

test("Zod tuple with default values - basic case", async () => {
  const SpeedSchema = z.enum(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(z.tuple([SpeedSchema, z.number().default(123)]))
    .output(
      z.object({
        foo: z.string().min(1),
      }),
    )
    .handler((speed, retry) => {
      return { foo: `${speed}-${retry}` };
    });

  const [resHello, errHello] = hello("fast");

  expect(errHello).toBe(null);
  expect(resHello).toEqual({ foo: "fast-123" });
});

test("Zod tuple with required arg, default value arg, and optional arg", async () => {
  const SpeedSchema = z.enum(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(
      z.tuple([SpeedSchema, z.number().default(123), z.string().optional()]),
    )
    .output(
      z.object({
        foo: z.string().min(1),
      }),
    )
    .handler((speed, retry, str) => {
      return { foo: `${speed}-${retry}-${str}` };
    });

  const [resHello, errHello] = hello("fast");

  expect(errHello).toBe(null);
  expect(resHello).toEqual({ foo: "fast-123-undefined" });
});

test("Zod tuple with default values - both args provided", async () => {
  const SpeedSchema = z.enum(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(z.tuple([SpeedSchema, z.number().default(123)]))
    .output(
      z.object({
        foo: z.string().min(1),
      }),
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
        .strict(),
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
      ]),
    )
    .output(
      z.object({
        foo: z.string().min(1),
      }),
    )
    .handler(async (speed, retry, extra) => {
      return { foo: `${speed}-${retry}-${extra}` };
    });

  const [resHello, errHello] = await hello("normal");

  expect(errHello).toBe(null);
  expect(resHello).toEqual({ foo: "normal-123-bruh" });
});

test("Valibot tuple with optional and default value", async () => {
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

  const [resHello, errHello] = await hello("fast");

  expect(errHello).toBe(null);
  expect(resHello).toEqual({ foo: "fast-123" });
});

test("Valibot tuple with optional without default", async () => {
  const SpeedSchema = v.picklist(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(v.tuple([SpeedSchema, v.optional(v.number())]))
    .output(
      v.object({
        foo: v.pipe(v.string(), v.minLength(1)),
      }),
    )
    .handler(async (speed, retry) => {
      return { foo: `${speed}-${retry}` };
    });

  const [resHello, errHello] = await hello("slow");

  expect(errHello).toBe(null);
  expect(resHello).toEqual({ foo: "slow-undefined" });

  const [resHello2, errHello2] = await hello("slow", 222);

  expect(errHello2).toBe(null);
  expect(resHello2).toEqual({ foo: "slow-222" });
});

test("Valibot tuple with default values - both args provided", async () => {
  const SpeedSchema = v.picklist(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(
      v.tuple([
        SpeedSchema,
        v.optional(v.number(), 123),
        v.optional(v.string(), "str"),
      ]),
    )
    .output(
      v.object({
        foo: v.pipe(v.string(), v.minLength(1)),
      }),
    )
    .handler(async (speed, retry, str) => {
      return { foo: `${speed}-${retry}-${str}` };
    });

  const [resHello, errHello] = await hello("slow", 456);

  expect(errHello).toBe(null);
  expect(resHello).toEqual({ foo: "slow-456-str" });
});

test("Tuple without defaults - all args required - zod", async () => {
  const SpeedSchema = z.enum(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(z.tuple([SpeedSchema, z.number()]))
    .output(
      z.object({
        foo: z.string().min(1),
      }),
    )
    .handler(async (speed, retry) => {
      return { foo: `${speed}-${retry}` };
    });

  const [resHello, errHello] = await hello("fast", 456);

  expect(errHello).toBe(null);
  expect(resHello).toEqual({ foo: "fast-456" });
});

test("Tuple without defaults - all args required - valibot", async () => {
  const SpeedSchema = v.picklist(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(v.tuple([SpeedSchema, v.string()]))
    .output(
      v.object({
        foo: v.pipe(v.string(), v.minLength(1)),
      }),
    )
    .handler(async (speed, retry) => {
      return { foo: `${speed}-${retry}` };
    });

  const [resHello, errHello] = await hello("fast", "sasa");

  expect(errHello).toBe(null);
  expect(resHello).toEqual({ foo: "fast-sasa" });

  const [_, errHello2] = await hello("fast");

  expect(errHello2).not.toBeNull();
  expect(errHello2?.reason).toContain("Input validation failed");
});

test("Tuple without defaults - missing required arg should fail", async () => {
  const SpeedSchema = z.enum(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(z.tuple([SpeedSchema, z.number()]))
    .output(
      z.object({
        foo: z.string().min(1),
      }),
    )
    .handler(async (speed, retry) => {
      return { foo: `${speed}-${retry}` };
    });

  const [resHello, errHello] = await hello("fast");

  expect(resHello).toBe(null);
  expect(errHello).toBeDefined();
  expect(errHello?.message).toContain("Invalid input");
});
