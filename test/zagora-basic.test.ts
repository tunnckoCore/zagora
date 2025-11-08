// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "bun:test";
import * as v from "valibot";
import z from "zod";
import { Zagora, zagora } from "../src/index.ts";
import { errorSchemas, zodSchemas } from "./helpers.ts";

test("should create Zagora instance with default config", () => {
  const instance = zagora();
  expect(instance).toBeInstanceOf(Zagora);
});

test("should chain input method", () => {
  const instance = zagora().input(zodSchemas.string);
  expect(instance).toBeInstanceOf(Zagora);
});

test("should chain output method", () => {
  const instance = zagora().input(zodSchemas.string).output(zodSchemas.string);
  expect(instance).toBeInstanceOf(Zagora);
});

test("should chain errors method", () => {
  const instance = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors(errorSchemas.single);

  expect(instance).toBeInstanceOf(Zagora);
});

test("should access error helpers from handler last arg", () => {
  const fooFn = zagora()
    .input(zodSchemas.string)
    .output(
      z.object({
        str: z.string(),
        helper: z.any(),
      }),
    )
    .errors(errorSchemas.single)
    .handler((str, errors) => {
      return { str, helper: errors.network };
    });

  const res = fooFn("barry");

  if (res.error) {
    expect("should not get").toBe("to any error state");
  } else {
    expect(res.data.str).toBe("barry");
    expect(typeof res.data.helper).toBe("function");
    expect(res.data.helper.toString()).toContain("ZagoraError.fromTypedError");
  }
});

test("should work with multiple error schemas", () => {
  const instance = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
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
  const instance = zagora().input(zodSchemas.user).output(zodSchemas.user);

  expect(instance).toBeInstanceOf(Zagora);
});

test("should maintain immutability when chaining", () => {
  const base = zagora();
  const withInput = base.input(zodSchemas.string);
  const withOutput = withInput.output(zodSchemas.string);
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
    .input(zodSchemas.string)
    .handler(async (str) => str);

  const res = await fn("foo");
  expect(res.data).toBe("foo");
});

test("should allow method chaining in different orders", () => {
  const instance1 = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors(errorSchemas.single);

  const instance2 = zagora()
    .output(zodSchemas.string)
    .input(zodSchemas.string)
    .errors(errorSchemas.single);

  const instance3 = zagora()
    .errors(errorSchemas.single)
    .input(zodSchemas.string)
    .output(zodSchemas.string);

  expect(instance1).toBeInstanceOf(Zagora);
  expect(instance2).toBeInstanceOf(Zagora);
  expect(instance3).toBeInstanceOf(Zagora);
});

// TODO: fix the input TYPE error (runtime works) when input schema is array
// Easy fix from user-side is to just wrap it in a z.tuple, like z.tuple([z.array(z.string())])
// NOTE: all that is because array and tuples are basically the same thing in TypeScript Types,
// and because we exclusively use tuples to be able to defined multipe input arguments.
test("should work with array input schemas", () => {
  const fn = zagora()
    .input(zodSchemas.stringArray)
    .output(z.object({ arr: z.array(z.string()) }))
    .handler((arr) => ({ arr }));

  const input = ["foo", "bar", "qux"];

  // @ts-expect-error expected to type error, read notes above
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
    .input(zodSchemas.coordinates)
    .output(zodSchemas.number)
    .handler((x, y) => x + y);

  const res = func(10, 20);
  expect(res.data).toBe(30);
});

test("should support overriding schemas", () => {
  const funcOne = zagora()
    .input(zodSchemas.string)
    .input(zodSchemas.number) // Override input
    .handler((x) => x);

  const res1 = funcOne(120);
  expect(res1.error).toBeNull();
  expect(res1.data).toBe(120);

  const funcTwo = zagora()
    .input(zodSchemas.number)
    .output(zodSchemas.string)
    .output(zodSchemas.number) // Override output
    .handler((x) => x);

  const res2 = funcTwo(120);
  expect(res2.error).toBeNull();
  expect(typeof res2.data).toBe("number");
  expect(res2.data).toBe(120);

  const funcThree = zagora()
    .input(zodSchemas.string) // TODO: support using only `.errors` without .input required
    .errors(errorSchemas.multiple)
    .errors(errorSchemas.single) // Override output
    .handler(
      (str, errs) =>
        `${str}-${Object.keys(errs).length}-${typeof errs.network}`,
    );

  const res3 = funcThree("barry");
  expect(res3.data).toBe("barry-1-function");
});
