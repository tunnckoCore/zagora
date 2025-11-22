// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from "bun:test";
import * as v from "valibot";
import z from "zod";
import { isDefinedError, isInternalError } from "../new-src/errors";
import { zagora } from "../new-src/index.ts";

// Schemas
const errorSchemas = {
  NETWORK_ERROR: z.object({
    message: z.string(),
    statusCode: z.number().int().min(400).max(599),
    retryAfter: z.number().optional(),
  }),
  VALIDATION_ERROR: z.object({
    message: z.string(),
    field: z.string(),
  }),
};

test("typed error returns exact object with isDefined=true", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .errors(errorSchemas)
    .handler(({ errors }, input) => {
      if (input === "fail") {
        throw errors.NETWORK_ERROR({
          message: "Connection failed",
          statusCode: 503,
        });
      }
      return input;
    })
    .callable();

  const success = fn("hello");
  if (success.ok) {
    expect(success.data).toBe("hello");
  } else {
    expect(false, "Expected success for hello").toBe(true);
  }

  const res = fn("fail");
  if (
    !res.ok &&
    isDefinedError(res.error) &&
    res.error.kind === "NETWORK_ERROR"
  ) {
    expect(res.error.statusCode).toBe(503);
  } else {
    expect(false, "Expected internal error").toBe(true);
  }
});

test("context method works", () => {
  const fn = zagora()
    .context({ db: "mock" })
    .input(z.string())
    .output(z.string())
    .handler(({ context }, input) => {
      return `${input}-${context.db}`;
    })
    .callable();

  const res = fn("bar");
  if (res.ok) {
    expect(res.data).toBe("bar-mock");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("context override in callable", () => {
  const fn = zagora()
    .context({ db: "default" })
    .input(z.string())
    .output(z.string())
    .handler(({ context }, input) => {
      return `${input}-${context.db}`;
    })
    .callable({ db: "override" });

  const res = fn("baz");
  if (res.ok) {
    expect(res.data).toBe("baz-override");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("untyped error wrapped in ZagoraError with isDefined=false", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler((_, input) => {
      if (input === "crash") {
        throw new Error("Something broke");
      }
      return input;
    })
    .callable();

  const res = fn("crash");
  if (!res.ok && isInternalError(res.error)) {
    expect(res.error.cause).toBeInstanceOf(Error);
    expect((res.error.cause as Error).message).toBe("Something broke");
  } else {
    expect(false, "Expected internal error").toBe(true);
  }
});

test("multiple typed errors discriminated union", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .errors(errorSchemas)
    .handler(({ errors }, input) => {
      if (input === "net") {
        throw errors.NETWORK_ERROR({ message: "Failed", statusCode: 500 });
      }
      if (input === "val") {
        throw errors.VALIDATION_ERROR({ message: "Bad", field: "email" });
      }
      return input;
    })
    .callable();

  const netRes = fn("net");
  if (!netRes.ok && isDefinedError(netRes.error)) {
    expect(netRes.error.kind).toBe("NETWORK_ERROR");
  } else {
    expect(false, "Expected NETWORK_ERROR").toBe(true);
  }

  const valRes = fn("val");
  if (!valRes.ok && isDefinedError(valRes.error)) {
    expect(valRes.error.kind).toBe("VALIDATION_ERROR");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("async input schema", async () => {
  const asyncSchema = z
    .string()
    .refine(async (val) => val.length > 2, "Min 3 chars");

  const fn = zagora()
    .input(asyncSchema)
    .output(z.string())
    .handler((_, input) => input.toUpperCase())
    .callable();

  const res = await fn("ab");
  if (!res.ok) {
    expect(true).toBe(true); // Validation should fail
  } else {
    expect(false, "Expected validation error").toBe(true);
  }
});

test("async output schema", async () => {
  const asyncSchema = z
    .string()
    .refine(async (val) => val !== "bad", "Bad value");

  const fn = zagora()
    .input(z.string())
    .output(asyncSchema)
    .handler((_, input) => input)
    .callable();

  const res = await fn("bad");
  if (!res.ok) {
    expect(true).toBe(true); // Validation should fail
  } else {
    expect(false, "Expected validation error").toBe(true);
  }
});

test("handleError with async schema validation", async () => {
  const asyncErrorSchema = z.object({
    message: z
      .string()
      .refine(async (val) => val.length < 500, "Message too long"),
  });

  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .errors({ ASYNC_ERROR: asyncErrorSchema })
    .handler(({ errors }, input) => {
      if (input === "fail") {
        throw errors.ASYNC_ERROR({ message: "a".repeat(600) });
      }
      return input;
    })
    .callable();

  const res = await fn("fail");
  if (!res.ok) {
    expect(true).toBe(true); // Some error occurred
  } else {
    expect(false, "Expected error").toBe(true);
  }
});

test("async handler typed error", async () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .errors(errorSchemas)
    .handler(async ({ errors }, input) => {
      if (input === "fail") {
        throw errors.NETWORK_ERROR({ message: "Timeout", statusCode: 408 });
      }
      return input;
    })
    .callable();

  const res = await fn("fail");
  if (
    !res.ok &&
    isDefinedError(res.error) &&
    res.error.kind === "NETWORK_ERROR"
  ) {
    expect(res.error.statusCode).toBe(408);
  } else {
    expect(false, "Expected NETWORK_ERROR in async").toBe(true);
  }
});

test("async handler regular untyped error thrown", async () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler(async (_, input) => {
      if (input === "fail") {
        throw new Error("Some custom err thrown from async handler");
      }
      return input;
    })
    .callable();

  const res = await fn("fail");
  if (!res.ok && isInternalError(res.error)) {
    expect(res.error.cause).toBeInstanceOf(Error);
    expect((res.error.cause as Error).message).toBe(
      "Some custom err thrown from async handler",
    );
  } else {
    expect(false, "Expected internal error from async").toBe(true);
  }
});

test("Error.cause is set on wrapped errors", () => {
  const originalError = new Error("Original message");

  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler((_, input) => {
      if (input === "fail") {
        throw originalError;
      }
      return input;
    })
    .callable();

  const res = fn("fail");
  if (!res.ok && isInternalError(res.error)) {
    expect(res.error.cause).toBe(originalError);
    expect(res.error.message).toBe("Sync handler threw unknown error");
    expect((res.error.cause as Error).message).toBe("Original message");
  } else {
    expect(false, "Expected internal error with cause").toBe(true);
  }
});

test("both tuple and object access formats work", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler((_, input) => input)
    .callable();

  const res = fn("foo");

  if (res.ok) {
    expect(res.data).toBe("foo");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("input validation failure", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler((_, input) => input)
    .callable();

  const res = fn(123 as any);
  if (!res.ok) {
    expect(true).toBe(true); // Just check it's not ok
  } else {
    expect(false, "Expected input validation error").toBe(true);
  }
});

test("output validation failure", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.number())
    .handler((_, input) => input)
    .callable();

  const res = fn("foo");
  if (!res.ok) {
    expect(true).toBe(true); // Just check it's not ok
    expect(res.error.kind).toBe("VALIDATION_ERROR");
    expect(res.error.message).toContain("Output validation failed");
  } else {
    expect(false, "Expected output validation error").toBe(true);
  }
});

test("no error schema works", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler((_, input) => {
      if (input === "fail") {
        throw new Error("Untyped");
      }
      return input;
    })
    .callable();

  const res = fn("fail");
  if (!res.ok && isInternalError(res.error)) {
    expect(true).toBe(true);
  } else {
    expect(false, "Expected internal error").toBe(true);
  }
});

test("tuple input arguments", () => {
  const fn = zagora()
    .input(z.tuple([z.string(), z.number()]))
    .output(z.string())
    .handler((_, str, num) => `${str}-${num}`)
    .callable();

  const res = fn("hello", 42);
  if (res.ok) {
    expect(res.data).toBe("hello-42");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("thrown ZagoraError passed through", () => {
  const customErr = { kind: "CUSTOM_ERROR", message: "qux" };

  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler((_, input) => {
      if (input === "throw now") {
        throw customErr;
      }
      return input;
    })
    .callable();

  const res = fn("throw now");
  if (!res.ok && isInternalError(res.error)) {
    expect(res.error.cause).toEqual(customErr);
  } else {
    expect(false, "Expected internal error").toBe(true);
  }
});
