import { expect, test } from "bun:test";
import * as v from "valibot";
import z from "zod";
import {
  isDefinedError,
  isInternalError,
  isValidationError,
  isZagoraError,
} from "../new-src/errors";
import { zagora } from "../new-src/index";

test("typed errors should be in options", () => {
  const errorSchemas = {
    BAR_ERR: z.object({
      msg: z.string(),
      foo: z.number().min(100).max(999).default(500),
    }),
  };

  const func = zagora()
    // .input(z.string())
    // .output(z.string())
    .errors(errorSchemas)
    // .errors({ FOO: z.object({ msg: z.string() }) })
    .handler(({ errors }) => {
      throw errors.BAR_ERR({ msg: "Custom error" });

      // NOTE: simulate return, because the return types break
      // when no return and no `input` schema

      // biome-ignore lint/correctness/noUnreachable: bruh
      return "foo";
    })
    .callable();

  const res = func("sasa");
  expect(res.ok).toBe(false);

  if (res.error) {
    expect(Object.keys(errorSchemas)[0]).toBe(res.error.kind);
    expect(res.error.kind).toBe("BAR_ERR");
    if (res.error.kind === "BAR_ERR") {
      expect(res.error.msg).toBe("Custom error");
      expect(res.error.foo).toBe(500);
    }
  } else {
    throw new Error("Expected BAR_ERR, but got: " + JSON.stringify(res.error));
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
    .handler((_, speed, retry) => {
      return { foo: `${speed}-${retry}` };
    })
    .callable();

  const res = hello("fast");

  expect(res.ok).toBe(true);
  if (res.ok) {
    expect(res.data).toEqual({ foo: "fast-123" });
  }
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
    .handler(async (_, speed, retry, str) => {
      return { foo: `${speed}-${retry}-${str}` };
    })
    .callable();

  const res = await hello("fast");

  expect(res.ok).toBe(true);
  if (res.ok) {
    expect(res.data).toEqual({ foo: "fast-123-undefined" });
  }
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
    .handler(async (_, speed, retry) => {
      return { foo: `${speed}-${retry}` };
    })
    .callable();

  const res = await hello("slow", 456);

  expect(res.ok).toBe(true);
  if (res.ok) {
    expect(res.data).toEqual({ foo: "slow-456" });
  }

  const hello2 = zagora()
    .input(z.tuple([SpeedSchema, z.number().default(123)]))
    .output(
      z
        .object({
          foo: z.string().min(1),
        })
        .strict(),
    )
    .handler(async (_, speed, retry) => {
      return { foo: `${speed}-${retry}`, bar: "barry" };
    })
    .callable();

  const failingHello = await hello2("slow", 456);

  expect(failingHello.ok).toBe(false);
  if (!failingHello.ok) {
    expect(failingHello.error.message).toContain("Output validation failed");
  }
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
    .handler(async (_, speed, retry, extra) => {
      return { foo: `${speed}-${retry}-${extra}` };
    })
    .callable();

  const res = await hello("normal");

  expect(res.ok).toBe(true);
  expect((res as any).data).toEqual({ foo: "normal-123-bruh" });
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
    .handler(async (_, speed, retry) => {
      return { foo: `${speed}-${retry}` };
    })
    .callable();

  const res = await hello("fast");

  expect(res.ok).toBe(true);
  expect((res as any).data).toEqual({ foo: "fast-123" });
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
    .handler(async (_, speed, retry) => {
      return { foo: `${speed}-${retry}` };
    })
    .callable();

  const res = await hello("slow");

  expect(res.ok).toBe(true);
  expect((res as any).data).toEqual({ foo: "slow-undefined" });

  const bruh = await hello("slow", 222);

  expect(bruh.ok).toBe(true);
  expect((bruh as any).data).toEqual({ foo: "slow-222" });
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
    .handler(async (_, speed, retry, str) => {
      return { foo: `${speed}-${retry}-${str}` };
    })
    .callable();

  const res = await hello("slow", 456);

  expect(res.ok).toBe(true);
  expect((res as any).data).toEqual({ foo: "slow-456-str" });
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
    .handler(async (_, speed, retry) => {
      return { foo: `${speed}-${retry}` };
    })
    .callable();

  const res = await hello("fast", 456);

  expect(res.ok).toBe(true);
  expect((res as any).data).toEqual({ foo: "fast-456" });
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
    .handler(async (_, speed, retry) => {
      return { foo: `${speed}-${retry}` };
    })
    .callable();

  const res = await hello("fast", "sasa");

  expect(res.ok).toBe(true);
  expect((res as any).data).toEqual({ foo: "fast-sasa" });

  // @ts-expect-error - fine
  const result = await hello("fast");

  expect(result.ok).toBe(false);
  expect(result.error?.message).toContain("Input validation failed");
});

test("Zod Tuple without defaults - missing required arg should fail", async () => {
  const SpeedSchema = z.enum(["slow", "normal", "fast"]);

  const hello = zagora()
    .input(z.tuple([SpeedSchema, z.number()]))
    .output(
      z.object({
        foo: z.string().min(1),
      }),
    )
    .handler(async (_, speed, retry) => {
      return { foo: `${speed}-${retry}` };
    })
    .callable();

  // @ts-expect-error - fine
  const res = await hello("fast");

  expect(res.ok).toBe(false);
  expect(res.error?.message).toContain("Input validation failed");
});
