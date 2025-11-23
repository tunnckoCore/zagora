import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import * as v from "valibot";
import z from "zod";
import { isInternalError } from "../new-src/errors";
import { zagora } from "../new-src/index";

test("typed errors should be in options - when input schema is defined", () => {
  const errorSchemas = {
    BAR_ERR: z.object({
      msg: z.string(),
      foo: z.number().min(100).max(999).default(500),
    }),
  };

  const func = zagora()
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

  const res = func();
  expect(res.ok).toBe(false);

  if (res.error) {
    expect(Object.keys(errorSchemas)[0]).toBe(res.error.kind);
    expect(res.error.kind).toBe("BAR_ERR");
    if (res.error.kind === "BAR_ERR") {
      expect(res.error.msg).toBe("Custom error");
      expect(res.error.foo).toBe(500);
    }
  } else {
    throw new Error(`Expected BAR_ERR, but got: ${JSON.stringify(res.error)}`);
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

  // @ts-expect-error - should error because missing second required arg
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

  // @ts-expect-error - should error because missing second required arg
  const res = await hello("fast");

  expect(res.ok).toBe(false);
  expect(res.error?.message).toContain("Input validation failed");
});

test("Handler without input schema should work", () => {
  const errorSchemas = {
    BARRY_ERR: z.object({
      msg: z.string(),
      foo: z.number().min(100).max(999).default(500),
    }),
  };

  const func = zagora()
    // no .input() call
    .errors(errorSchemas)
    .handler(({ errors }) => {
      throw errors.BARRY_ERR({ msg: "Some custom error" });
      // biome-ignore lint/correctness/noUnreachable: bruh
      return "foo";
    })
    .callable();

  const res = func();
  expect(res.ok).toBe(false);

  if (res.error) {
    expect(Object.keys(errorSchemas)[0]).toBe(res.error.kind);
    expect(res.error.kind).toBe("BARRY_ERR");
    if (res.error.kind === "BARRY_ERR") {
      expect(res.error.msg).toBe("Some custom error");
      expect(res.error.foo).toBe(500);
    }
  } else {
    throw new Error(
      `Expected BARRY_ERR, but got: ${JSON.stringify(res.error)}`,
    );
  }
});

test("Handler without input schema and no errors should work", () => {
  const func = zagora({ autoCallable: true }).handler(({ context }) => {
    return { result: "success", ctx: context };
  });

  const res = func();

  expect(res.ok).toBe(true);
  if (res.ok) {
    expect(res.data).toEqual({ result: "success", ctx: undefined });
  }
});

test("wrapping external async functions in pseudo-sync `.handler` fn", async () => {
  // Basic async function that can succeed or fail
  const basicAsyncFn = async (input: string): Promise<string> => {
    if (input !== "foobie") {
      throw new Error("Basic async failed");
    }
    return `processed: ${input}`;
  };

  const basicWrapper = zagora()
    .handler((_) => basicAsyncFn("foobie"))
    .callable();

  const res1 = await basicWrapper();
  expect(res1.ok).toBe(true);
  expect((res1 as any).data).toBe("processed: foobie");

  // Test basic wrapper without schemas - failure
  const failingBasicWrapper = zagora()
    .handler((_) => basicAsyncFn("fail one"))
    .callable();

  const res2 = await failingBasicWrapper();
  expect(res2.ok).toBe(false);

  if (!res2.ok && isInternalError(res2.error)) {
    expect(res2.error.message).toContain("Async handler threw");
    expect(res2.error.cause).toBeInstanceOf(Error);
    expect((res2.error.cause as Error).message).toBe("Basic async failed");
  }

  // Test with non-existent file
  const fsWrapper = zagora()
    .input(z.string())
    .output(z.string())
    .handler((_, filepath) => readFile(filepath, "utf-8"))
    .callable();

  const res3 = await fsWrapper("non-existent-file.txt");

  expect(res3.ok).toBe(false);
  if (!res3.ok && isInternalError(res3.error)) {
    expect(res3.error.message).toContain("Async handler threw");
    expect(res3.error.cause).toBeInstanceOf(Error);
    expect((res3.error.cause as Error).message).toContain("ENOENT");
  } else {
    expect(
      false,
      "Should throw internal error cought from 'pseudo-sync' handler returning promise",
    ).toBeInstanceOf(true);
  }

  // Test with package.json (should exist)
  const res4 = await fsWrapper("package.json");
  expect(res4.ok).toBe(true);

  if (res4.ok) {
    expect(typeof res4.data).toBe("string");
    expect(res4.data).toContain('name":');
    expect(res4.data).toContain('"zagora');
  } else {
    expect(
      false,
      "Should not throw error caught when 'pseudo-sync' handler returns promise",
    ).toBeInstanceOf(true);
  }
});

test("wrapping sync throwing functions (JSON.parse -> safeJsonParse) in .handler", async () => {
  const someJson = `{"name": "zagora"}`;
  const safeJsonParse = zagora()
    .input(z.string())
    .output(z.object({ name: z.string() }))
    .handler((_, input) => JSON.parse(input))
    .callable();

  const res = safeJsonParse(someJson);
  expect(res.ok).toBe(true);

  if (res.ok) {
    expect(res.data.name).toBe("zagora");
  } else {
    expect(false, "Should not have error").toBeInstanceOf(true);
  }

  const res2 = safeJsonParse(`foo": 123`);
  expect(res2.ok).toBe(false);

  if (res2.error && isInternalError(res2.error)) {
    expect(res2.error.kind).toBe("UNKNOWN_ERROR");
    expect(res2.error.message).toContain("Sync handler threw unknown err");
    expect((res2.error.cause as Error).message).toContain(
      "JSON Parse error: Unexpected identifier",
    );
  } else {
    expect(false, "Should throw error").toBeInstanceOf(true);
  }
});

test("proper return type for sync and async handlers", async () => {
  const someJson = `{"name": "zagora"}`;
  const safeAsyncParse = zagora()
    .handler(async () => JSON.parse(someJson))
    .callable();
  const res1 = await safeAsyncParse();
  expect(res1.ok).toBe(true);
  expect((res1 as any).data.name).toBe("zagora");
  const res2 = safeAsyncParse();
  expect(res2).toBeInstanceOf(Promise);
  expect(((await res2) as any).data.name).toBe("zagora");

  const safeParseSync = zagora()
    .handler(() => JSON.parse(someJson))
    .callable();
  const res3 = safeParseSync();
  expect(res3.ok).toBe(true);
  expect((res3 as any).data.name).toBe("zagora");

  const safeParsePromiseSync = zagora()
    .handler(() => Promise.resolve(JSON.parse(someJson)))
    .callable();
  const res4 = await safeParsePromiseSync();
  expect(res4.ok).toBe(true);
  expect((res4 as any).data.name).toBe("zagora");
  const res5 = safeAsyncParse();
  expect(res5).toBeInstanceOf(Promise);
  expect(((await res5) as any).data.name).toBe("zagora");
});
