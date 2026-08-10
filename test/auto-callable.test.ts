// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from "vitest";
import z from "zod";
import { zagora } from "../src/index";

test("autoCallable: false (default) - requires .callable() call", async () => {
  const builder = zagora()
    .input(z.string())
    .output(z.string())
    .handler((_, input) => input.toUpperCase());

  // builder is still a Zagora instance, not callable
  expect(typeof builder.callable).toBe("function");

  const fn = builder.callable();
  const res = await fn("hello");

  if (res.ok) {
    expect(res.data).toBe("HELLO");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

describe("callable procedure metadata", () => {
  test("should expose ~zagora metadata on callable procedures", async () => {
    const inputSchema = z.object({ id: z.string() });
    const outputSchema = z.object({ name: z.string() });
    const errorsMap = { NOT_FOUND: z.object({ id: z.string() }) };
    const procedure = zagora()
      .input(inputSchema)
      .output(outputSchema)
      .errors(errorsMap)
      .handler(async (_, input) => ({ name: `test-${input.id}` }))
      .callable();
    expect(procedure).toHaveProperty("~zagora");
    expect(procedure["~zagora"]).toHaveProperty("inputSchema", inputSchema);
    expect(procedure["~zagora"]).toHaveProperty("outputSchema", outputSchema);
    expect(procedure["~zagora"]).toHaveProperty("errorsMap", errorsMap);
    const result = await procedure({ id: "foo" });
    if (result.ok) {
      expect(result.data).toEqual({ name: "test-foo" });
    } else {
      expect.fail("should not fail");
    }
  });
  test("should preserve metadata after calling the procedure", () => {
    const procedure = zagora()
      .input(z.string())
      .handler((_, id) => id)
      .callable();

    // Metadata should be available
    expect(procedure["~zagora"]).toBeDefined();
    expect(procedure["~zagora"].inputSchema).toBeDefined();

    // Call procedure multiple times
    procedure("test1");
    procedure("test2");
    // Metadata should still be available
    expect(procedure["~zagora"]).toBeDefined();
    expect(procedure["~zagora"].inputSchema).toBeDefined();
  });
  test("should not affect procedure functionality", () => {
    const procedure = zagora()
      .input(z.string())
      .handler((_, str) => str.toUpperCase())
      .callable();
    expect(procedure("hello")).toEqual({ ok: true, data: "HELLO" });
    expect(procedure["~zagora"]).toBeDefined();
  });
});

test("autoCallable: true - handler returns procedure directly", async () => {
  const fn = zagora({ autoCallable: true })
    .input(z.string())
    .output(z.string())
    .handler((_, input) => input.toLowerCase());

  // fn should be callable directly
  expect(typeof fn).toBe("function");

  const res = await fn("WORLD");
  if (res.ok) {
    expect(res.data).toBe("world");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("autoCallable: true - with tuple input", async () => {
  const fn = zagora({ autoCallable: true })
    .input(z.tuple([z.number(), z.string()]))
    .output(z.string())
    .handler((_, num, str) => `${str}-${num}`);

  const res = await fn(42, "answer");
  if (res.ok) {
    expect(res.data).toBe("answer-42");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("autoCallable: true - with context", async () => {
  const fn = zagora({ autoCallable: true })
    .context({ db: "postgres" })
    .input(z.string())
    .output(z.string())
    .handler(async ({ context }, input) => `${input}-${context.db}`);

  const res = await fn("test");
  if (res.ok) {
    expect(res.data).toBe("test-postgres");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("autoCallable: true - with errors", async () => {
  const fn = zagora({ autoCallable: true })
    .input(z.string())
    .output(z.string())
    .errors({
      CUSTOM_ERROR: z.object({
        message: z.string(),
      }),
    })
    .handler(({ errors }, input) => {
      if (input === "fail") {
        throw errors.CUSTOM_ERROR({ message: "Failed" });
      }
      return input;
    });

  const success = await fn("pass");
  if (success.ok) {
    expect(success.data).toBe("pass");
  } else {
    expect(false, "Expected success").toBe(true);
  }

  const failure = await fn("fail");
  if (!failure.ok) {
    expect(failure.error.kind).toBe("CUSTOM_ERROR");
  } else {
    expect(false, "Expected error").toBe(true);
  }
});

test("autoCallable: true - async handler", async () => {
  const fn = zagora({ autoCallable: true })
    .input(z.string())
    .output(z.string())
    .handler(async (_, input) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return input.toUpperCase();
    });

  const res = await fn("async");
  if (res.ok) {
    expect(res.data).toBe("ASYNC");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("autoCallable: true + disableOptions: true - handler receives only input", async () => {
  const fn = zagora({ autoCallable: true, disableOptions: true })
    .input(z.string())
    .output(z.string())
    .handler((input) => input.toUpperCase());

  const res = await fn("combined");
  if (res.ok) {
    expect(res.data).toBe("COMBINED");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("autoCallable: true + disableOptions: true - with tuple", async () => {
  const fn = zagora({ autoCallable: true, disableOptions: true })
    .input(z.tuple([z.number(), z.string()]))
    .output(z.string())
    .handler((num, str) => `${str}:${num}`);

  const res = await fn(100, "value");
  if (res.ok) {
    expect(res.data).toBe("value:100");
  } else {
    expect(false, "Expected success").toBe(true);
  }

  // @ts-expect-error - expected to fail, because second argument is missing
  const res2 = await fn(100);
  expect(res2.ok).toBe(false);
});

test("autoCallable: true - no input schema", () => {
  const fn = zagora({ autoCallable: true }).handler((_) => "no input");

  const res = fn();
  if (res.ok) {
    expect(res.data).toBe("no input");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("autoCallable: true + disableOptions: true - no input schema", async () => {
  const fn = zagora({ autoCallable: true, disableOptions: true })
    .output(z.string())
    .handler(() => "no input no options");

  const res = await fn();
  if (res.ok) {
    expect(res.data).toBe("no input no options");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});
