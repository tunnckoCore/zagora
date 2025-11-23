// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "bun:test";
import z from "zod";
import { zagora } from "../new-src/index.ts";
import { deepMerge, handleTupleDefaults } from "../new-src/utils.ts";

test("validateInputOutput - sync validation with issues on input (line 82)", () => {
  const fn = zagora()
    .input(z.number().min(10))
    .output(z.number())
    .handler((_, input) => input)
    .callable();

  const res = fn(5);
  expect(res.ok).toBe(false);
  if (!res.ok) {
    expect(res.error.kind).toBe("VALIDATION_ERROR");
    expect(res.error.message).toContain("Input validation failed");
  }
});

test("validateInputOutput - async validation success path (line 82)", async () => {
  const asyncSchema = z
    .string()
    .refine(async (val) => val.length > 2, "Min 3 chars");

  const fn = zagora({ disableOptions: true, autoCallable: true })
    .input(asyncSchema)
    .output(z.string())
    .handler((input) => input.toUpperCase());

  // TODO / DOCUMENT: Having an ASYNC validation at any place,
  //                  always require the procedure to be awaited
  const res = await fn("valid");

  expect(res.ok).toBe(true);
  if (res.ok) {
    expect(res.data).toBe("VALID");
  }
});

test("validateInputOutput - sync validation with issues on output (line 87)", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.number())
    .handler((_, input) => "not a number")
    .callable();

  const res = fn("valid input");
  expect(res.ok).toBe(false);
  if (!res.ok) {
    expect(res.error.kind).toBe("VALIDATION_ERROR");
    expect(res.error.message).toContain("Output validation failed");
  }
});

test("validateError - error with kind not in errorsMap (line 130)", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .errors({
      KNOWN_ERROR: z.object({
        message: z.string(),
      }),
    })
    .handler((_, input) => {
      if (input === "unknown") {
        throw { kind: "UNKNOWN_ERROR", message: "Not in map" };
      }
      return input;
    })
    .callable();

  const res = fn("unknown");
  expect(res.ok).toBe(false);
  if (!res.ok) {
    expect(res.error.message).toContain("is not defined in errors map");
  }
});

test("validateError - async error validation with issues (lines 132-135)", async () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .errors({
      ASYNC_ERROR: z.object({
        message: z.string().refine(async (val) => val.length < 10, "Too long"),
      }),
    })
    .handler(({ errors }, input) => {
      if (input === "fail") {
        throw errors.ASYNC_ERROR({ message: "a".repeat(20) });
      }
      return input;
    })
    .callable();

  // TODO / DOCUMENT: Having an ASYNC validation at any place,
  //                  always require the procedure to be awaited
  const res = await fn("fail");
  expect(res.ok).toBe(false);
  if (!res.ok) {
    expect(res.error.kind).toBe("VALIDATION_ERROR");
  }
});

test("handleTupleDefaults - Valibot tuple with optional having default (lines 202-203)", () => {
  // Create a mock valibot tuple schema structure
  const mockValibotSchema = {
    type: "tuple",
    items: [{ type: "string" }, { type: "optional", default: 99 }],
  };

  const result = handleTupleDefaults(mockValibotSchema as any, ["test"]);
  expect(result).toEqual(["test", 99]);
});

test("handleTupleDefaults - non-tuple schema returns rawArgs (lines 208-209)", () => {
  const result = handleTupleDefaults(z.string() as any, ["foo", "bar"]);
  expect(result).toEqual(["foo", "bar"]);
});

test("deepMerge - merge nested objects", () => {
  const target = { a: 1, b: { c: 2, d: 3 } };
  const source = { b: { d: 4, e: 5 }, f: 6 };
  const result = deepMerge(target, source);

  expect(result.a).toBe(1);
  expect(result.b.c).toBe(2);
  expect(result.b.d).toBe(4);
  expect(result.b.e).toBe(5);
  expect(result.f).toBe(6);
});

test("deepMerge - merge arrays", () => {
  const target = [1, 2, 3];
  const source = [4, 5];
  const result = deepMerge(target, source);

  expect(result).toEqual([4, 5, 3]);
});

test("deepMerge - source is null", () => {
  const target = { a: 1 };
  const result = deepMerge(target, null);
  expect(result).toBe(null);
});

test("deepMerge - target is null", () => {
  const source = { a: 1 };
  const result = deepMerge(null, source);
  expect(result).toEqual({ a: 1 });
});

test("deepMerge - source is primitive", () => {
  const target = { a: 1 };
  const result = deepMerge(target, "string");
  expect(result).toBe("string");
});
