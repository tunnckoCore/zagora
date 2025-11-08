// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "bun:test";
import * as v from "valibot";
import z from "zod";
import { Zagora, zagora } from "../src/index.ts";

const errorSchemas = {
  single: {
    NETWORK_ERROR: z.object({
      type: z.literal("NETWORK_ERROR"),
      message: z.string(),
      statusCode: z.number().int().min(400).max(599),
      retryAfter: z.number().optional(),
    }),
  },
  multiple: {
    NETWORK_ERROR: z.object({
      type: z.literal("NETWORK_ERROR"),
      message: z.string(),
      statusCode: z.number().int().min(400).max(599),
      retryAfter: z.number().optional(),
    }),
    VALIDATION_ERROR: z.object({
      type: z.literal("VALIDATION_ERROR"),
      message: z.string(),
      field: z.string(),
    }),
  },
};

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  age: z.number().int().positive(),
});

test("should create Zagora instance with default config", () => {
  const instance = zagora();
  expect(instance).toBeInstanceOf(Zagora);
});

test("should chain input method", () => {
  const instance = zagora().input(z.string());
  expect(instance).toBeInstanceOf(Zagora);
});

test("should chain output method", () => {
  const instance = zagora().input(z.string()).output(z.string());
  expect(instance).toBeInstanceOf(Zagora);
});

test("should chain errors method", () => {
  const instance = zagora()
    .input(z.string())
    .output(z.string())
    .errors(errorSchemas.single);

  expect(instance).toBeInstanceOf(Zagora);
});

test("should access error helpers from handler last arg", () => {
  const fooFn = zagora()
    .input(z.string())
    .output(
      z.object({
        str: z.string(),
        helper: z.any(),
      }),
    )
    .errors(errorSchemas.single)
    .handler((str, errors) => {
      return { str, helper: errors.NETWORK_ERROR };
    });

  const res = fooFn("barry");

  if (res.error) {
    expect("should not get").toBe("to any error state");
  } else {
    expect(res.data.str).toBe("barry");
    expect(typeof res.data.helper).toBe("function");
    expect(res.data.helper.toString()).toContain("(errorData) =>");
  }
});

test("should work with multiple error schemas", () => {
  const instance = zagora()
    .input(z.string())
    .output(z.string())
    .errors(errorSchemas.multiple);

  expect(instance).toBeInstanceOf(Zagora);
});

test("should work with Valibot schemas", () => {
  const func = zagora()
    .input(v.string())
    .output(
      v.object({
        x: v.string(),
      }),
    )
    .handler((x) => ({ x }));

  const res = func("foo");

  expect(res.data).toBeObject();
  expect(res.data).not.toBeNil();
  expect(typeof res.data).toBe("object");
  if (res.data) {
    expect(res.data.x).toBe("foo");
  } else {
    expect("should not").toBe("none data");
  }
});

test("should work with complex object schemas", () => {
  const instance = zagora().input(userSchema).output(userSchema);

  expect(instance).toBeInstanceOf(Zagora);
});

test("should maintain immutability when chaining", () => {
  const base = zagora();
  const withInput = base.input(z.string());
  const withOutput = withInput.output(z.string());
  const withErrors = withOutput.errors(errorSchemas.single);

  // Each step should return a new instance
  expect(base).not.toBe(withInput);
  expect(withInput).not.toBe(withOutput);
  expect(withOutput).not.toBe(withErrors);
});

test("should NOT throw error when handler called without input schema", async () => {
  const fn = zagora().handler(() => "foobar");
  const res = fn();
  expect(res.data).toBe("foobar");
});

test("should NOT throw error when async handler called without output schema", async () => {
  const fn = zagora()
    .input(z.string())
    .handler(async (str) => str);

  const res = await fn("foo");
  expect(res.data).toBe("foo");
});

test("should allow method chaining in different orders", () => {
  const instance1 = zagora()
    .input(z.string())
    .output(z.string())
    .errors(errorSchemas.single);

  const instance2 = zagora()
    .output(z.string())
    .input(z.string())
    .errors(errorSchemas.single);

  const instance3 = zagora()
    .errors(errorSchemas.single)
    .input(z.string())
    .output(z.string());

  expect(instance1).toBeInstanceOf(Zagora);
  expect(instance2).toBeInstanceOf(Zagora);
  expect(instance3).toBeInstanceOf(Zagora);
});

test("should work with array input schemas", () => {
  const fn = zagora()
    .input(z.array(z.string()))
    .output(z.object({ arr: z.array(z.string()) }))
    .handler((arr) => ({ arr }));

  const input = ["foo", "bar", "qux"];

  const res = fn(input);

  expect(res.error).toBeNull();
  expect(res.data).not.toBeNil();
  expect(res.data?.arr).toBeArray();
  expect(res.data?.arr[0]).toBe("foo");
  expect(res.data?.arr[1]).toBe("bar");
  expect(res.data?.arr[2]).toBe("qux");
});

test("should spread with tuple input schemas to handler args", () => {
  const func = zagora()
    .input(z.tuple([z.number(), z.number()]))
    .output(z.number())
    .handler((x, y) => x + y);

  const res = func(10, 20);
  expect(res.data).toBe(30);
});

test("should support overriding schemas", () => {
  const funcOne = zagora()
    .input(z.string())
    .input(z.number()) // Override input
    .handler((x) => x);

  const res1 = funcOne(120);
  expect(res1.error).toBeNull();
  expect(res1.data).toBe(120);

  const funcTwo = zagora()
    .input(z.number())
    .output(z.string())
    .output(z.number()) // Override output
    .handler((x) => x);

  const res2 = funcTwo(120);
  expect(res2.error).toBeNull();
  expect(typeof res2.data).toBe("number");
  expect(res2.data).toBe(120);

  const funcThree = zagora()
    .input(z.string()) // TODO: support using only `.errors` without .input required
    .errors(errorSchemas.multiple)
    .errors(errorSchemas.single) // Override output
    .handler(
      (str, errs) =>
        `${str}-${Object.keys(errs).length}-${typeof errs.NETWORK_ERROR}`,
    );

  const res3 = funcThree("barry");
  expect(res3.data).toBe("barry-1-function");
});
