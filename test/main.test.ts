// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from "bun:test";
import * as v from "valibot";
import z from "zod";
import {
  createResult,
  isAsyncFunction,
  ZagoraError,
  zagora,
} from "../src/index.ts";

// Schemas
const errorSchemas = {
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
};

test("typed error returns exact object with isDefined=true", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .errors(errorSchemas)
    .handler((input, err) => {
      if (input === "fail") {
        throw err.NETWORK_ERROR({
          message: "Connection failed",
          statusCode: 503,
        });
      }
      return input;
    });

  const success = fn("hello");
  expect(success.data).toBe("hello");
  expect(success.error).toBe(null);
  expect(success.isDefined).toBe(false);

  const res = fn("fail");
  expect(res.data).toBe(null);
  expect(res.isDefined).toBe(true);
  if (res.isDefined && res.error.type === "NETWORK_ERROR") {
    expect(res.error.type).toBe("NETWORK_ERROR");
    expect(res.error.statusCode).toBe(503);
    expect(res.error instanceof ZagoraError).toBe(false);
  } else {
    throw new Error(
      "Expected error to be NETWORK_ERROR, but got: " +
        JSON.stringify(res.error),
    );
  }
});

test("untyped error wrapped in ZagoraError with isDefined=false", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler((input) => {
      if (input === "crash") {
        throw new Error("Something broke");
      }
      return input;
    });

  const error = fn("crash");
  expect(error.data).toBe(null);
  expect(error.isDefined).toBe(false);
  expect(error.error).toBeInstanceOf(ZagoraError);
  if (error.error) {
    expect(error.error.cause).toBeInstanceOf(Error);
    expect((error.error.cause as Error).message).toBe("Something broke");
  } else {
    throw new Error("Expected error to be defined");
  }
});

test("multiple typed errors discriminated union", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .errors(errorSchemas)
    .handler((input, err) => {
      if (input === "net") {
        throw err.NETWORK_ERROR({ message: "Failed", statusCode: 500 });
      }
      if (input === "val") {
        throw err.VALIDATION_ERROR({ message: "Bad", field: "email" });
      }
      return input;
    });

  const netError = fn("net");
  expect(netError.isDefined).toBe(true);
  if (netError.isDefined && netError.error.type === "NETWORK_ERROR") {
    expect(netError.error.type).toBe("NETWORK_ERROR");
  } else {
    throw new Error(
      "Expected NETWORK_ERROR, but got: " + JSON.stringify(netError.error),
    );
  }

  const valError = fn("val");
  expect(valError.isDefined).toBe(true);
  if (valError.isDefined && valError.error.type === "VALIDATION_ERROR") {
    expect(valError.error.type).toBe("VALIDATION_ERROR");
  } else {
    throw new Error(
      "Expected VALIDATION_ERROR, but got: " + JSON.stringify(valError.error),
    );
  }
});

test("async handler typed error", async () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .errors(errorSchemas)
    .handler(async (input, err) => {
      if (input === "fail") {
        throw err.NETWORK_ERROR({ message: "Timeout", statusCode: 408 });
      }
      return input;
    });

  const netErr = await fn("fail");
  expect(netErr.isDefined).toBe(true);
  if (netErr.isDefined && netErr.error.type === "NETWORK_ERROR") {
    expect(netErr.error.type).toBe("NETWORK_ERROR");
  } else {
    throw new Error(
      "Expected NETWORK_ERROR in async handler, but got: " +
        JSON.stringify(netErr.error),
    );
  }
});

test("async handler regular untyped error thrown", async () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler(async (input) => {
      if (input === "fail") {
        throw new Error("Some custom err thrown from async handler");
      }
      return input;
    });

  const error = await fn("fail");
  expect(error.isDefined).toBe(false);
  expect(error.error).toBeInstanceOf(ZagoraError);

  expect(error.error?.cause).toBeInstanceOf(Error);
  expect((error.error?.cause as any)?.message).toBe(
    "Some custom err thrown from async handler",
  );
});

test("Error.cause is set on wrapped errors", () => {
  const originalError = new Error("Original message");

  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler((input) => {
      if (input === "fail") {
        throw originalError;
      }
      return input;
    });

  const result = fn("fail");
  expect(result.error?.cause).toBe(originalError);
  expect(result.error?.message).toBe("Synchronous handler threw unknown error");
  expect((result.error?.cause as any)?.message).toBe("Original message");
});

test("both tuple and object access formats work", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler((input) => input);

  const result = fn("test");

  // Tuple format
  expect(result[0]).toBe("test");
  expect(result[1]).toBe(null);
  expect(result[2]).toBe(false);

  // Object format
  expect(result.data).toBe("test");
  expect(result.error).toBe(null);
  expect(result.isDefined).toBe(false);
});

test("input validation failure", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler((input) => input);

  const res = fn(123 as any);
  expect(res.isDefined).toBe(false);
  if (!res.isDefined && res.error instanceof ZagoraError) {
    expect(res.error).toBeInstanceOf(ZagoraError);
    expect(res.error.reason).toContain("Input validation");
    expect(res.error.issues).toBeDefined();
    if (res.error.issues) {
      expect(res.error.issues.length).toBeGreaterThan(0);
    }
  } else {
    throw new Error(
      "Expected input validation error, but got: " + JSON.stringify(res.error),
    );
  }
});

test("output validation failure", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.number())
    .handler((input) => input);

  const res = fn("test");
  expect(res.isDefined).toBe(false);
  if (!res.isDefined && res.error instanceof ZagoraError) {
    expect(res.error).toBeInstanceOf(ZagoraError);
    expect(res.error.reason).toContain("Output");
    expect(res.error.issues).toBeDefined();
    if (res.error.issues) {
      expect(res.error.issues.length).toBeGreaterThan(0);
    }
  } else {
    throw new Error(
      "Expected output validation error, but got: " + JSON.stringify(res.error),
    );
  }
});

test("no error schema works", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler((input) => {
      if (input === "fail") {
        throw new Error("Untyped");
      }
      return input;
    });

  const error = fn("fail");
  expect(error.error).toBeInstanceOf(ZagoraError);
  expect(error.isDefined).toBe(false);
});

test("tuple input arguments", () => {
  const fn = zagora()
    .input(z.tuple([z.string(), z.number()]))
    .output(z.string())
    .handler((str, num) => `${str}-${num}`);

  const result = fn("hello", 42);
  expect(result.data).toBe("hello-42");
  expect(result.error).toBe(null);
});

test("thrown ZagoraError passed through", () => {
  const customErr = new ZagoraError("Custom msg", { reason: "some fail" });

  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler((input) => {
      if (input === "throw now") {
        throw customErr;
      }
      return input;
    });

  const res = fn("throw now");
  expect(res.isDefined).toBe(false);
  expect(res.error).toBe(customErr);
  if (res.error) {
    expect(res.error.message).toBe(customErr.message);
    expect(res.error.reason).toBe(customErr.reason);
  }
});

test("invalid typed error data validation failure", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .errors(errorSchemas)
    .handler((input, err) => {
      if (input === "bad-status") {
        throw err.NETWORK_ERROR({
          message: "Failed",
          statusCode: 999,
        });
      }
      return input;
    });

  const res = fn("bad-status");
  expect(res.isDefined).toBe(false);
  if (!res.isDefined && res.error instanceof ZagoraError) {
    expect(res.error.reason).toContain("Invalid error data for NETWORK_ERROR");
    expect(res.error.issues).toBeDefined();
    expect(res.error.issues?.map((x) => x.message).join(",")).toBe(
      "Too big: expected number to be <=599",
    );
  } else {
    throw new Error("Expected invalid error data failure");
  }
});

test("async input validation with async schema (checking against database)", async () => {
  // Simulating checking if email exists in database asynchronously
  const emailTakenSchema = z
    .email()
    .refine(
      async (email) => email !== "taken@example.com",
      "Email already exists",
    );

  const fn = zagora()
    .input(emailTakenSchema)
    .output(z.string())
    .handler(async (email) => `Registered: ${email}`);

  // Test with email that fails async validation
  const res = await fn("taken@example.com");
  expect(res.isDefined).toBe(false);
  if (!res.isDefined && res.error instanceof ZagoraError) {
    expect(res.error.reason).toContain("Input validation");
    expect(res.error.message).toContain("Email already exists");
  } else {
    throw new Error("Expected input validation error for taken email");
  }
});

test("handler with array schema input", () => {
  const fn = zagora()
    .input(z.array(z.number()))
    .output(z.number())
    .handler((arr) => arr.reduce((a, b) => a + b, 0));

  const res = fn([1, 2, 3, 4]);
  expect(res.data).toBe(10);
  expect(res.isDefined).toBe(false);
});

test("handler with array schema input validation error", () => {
  const fn = zagora()
    .input(z.array(z.number()))
    .output(z.number())
    .handler((arr) => arr.reduce((a, b) => a + b, 0));

  const res = fn([1, "two", 3] as any);
  expect(res.isDefined).toBe(false);
  if (!res.isDefined && res.error instanceof ZagoraError) {
    expect(res.error.reason).toContain("Input validation");
  } else {
    throw new Error("Expected input validation error");
  }
});

test("handler with object schema input", () => {
  const fn = zagora()
    .input(z.object({ name: z.string(), age: z.number() }))
    .output(z.string())
    .handler((obj) => `${obj.name} is ${obj.age}`);

  const res = fn({ name: "Alice", age: 30 });
  expect(res.data).toBe("Alice is 30");
  expect(res.isDefined).toBe(false);
});

test("handler with object schema input validation error", () => {
  const fn = zagora()
    .input(z.object({ name: z.string(), age: z.number().default(123) }))
    .output(z.string())
    .handler((obj) => `${obj.name} is ${obj.age}`);

  const res = fn({ name: 123, age: "thirty" } as any);
  expect(res.isDefined).toBe(false);
  if (!res.isDefined && res.error instanceof ZagoraError) {
    expect(res.error.reason).toContain("Input validation");
  } else {
    throw new Error("Expected input validation error");
  }

  const res2 = fn({ name: "barry" });
  expect(res2.data).toBe("barry is 123");
});

test("async handler with async output validation", async () => {
  const asyncOutputSchema = z
    .string()
    .refine(async (val) => val.length > 0, "String must not be empty");

  const fn = zagora()
    .input(z.string())
    .output(asyncOutputSchema)
    .handler(async (input) => input);

  const res = await fn("");
  expect(res.isDefined).toBe(false);
  if (!res.isDefined && res.error instanceof ZagoraError) {
    expect(res.error.reason).toContain("Output");
  } else {
    throw new Error("Expected output validation error");
  }
});

test("synchronous handler throws untyped error object - ends in ZagoraError.cause", () => {
  const customObj = { code: 500, msg: "Internal error" };
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler((input) => {
      if (input === "error") {
        throw customObj;
      }
      return input;
    });

  const res = fn("error");
  expect(res.isDefined).toBe(false);
  if (!res.isDefined && res.error instanceof ZagoraError) {
    expect(res.error.cause).toBe(customObj);
  } else {
    throw new Error("Expected ZagoraError with custom object as cause");
  }
});

test("async handler throws untyped error object - ends in ZagoraError.cause", async () => {
  const customObj = { error: "async error" };
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .handler(async (input) => {
      if (input === "error") {
        throw customObj;
      }
      return input;
    });

  const res = await fn("error");
  expect(res.isDefined).toBe(false);
  if (!res.isDefined && res.error instanceof ZagoraError) {
    expect(res.error.cause).toBe(customObj);
  } else {
    throw new Error("Expected ZagoraError with custom async cause");
  }
});

describe("zagora basic", () => {
  test("ZagoraError with all properties set", () => {
    const issues = [{ path: ["field"], message: "Invalid" } as any];
    const cause = new Error("root cause");
    const err = new ZagoraError("Test error", {
      issues,
      cause,
      data: { test: true },
      reason: "Custom failure",
    });

    expect(err.issues).toBe(issues);
    expect(err.cause).toBe(cause);
    expect(err.data).toEqual({ test: true });
    expect(err.reason).toBe("Custom failure");
    expect(err.name).toBe("ZagoraError");
  });

  test("ZagoraError with no optional properties", () => {
    const err = new ZagoraError("Simple error");

    expect(err.issues).toBeUndefined();
    expect(err.cause).toBeUndefined();
    expect(err.data).toBeUndefined();
    expect(err.reason).toBe("Unknown or internal error");
    expect(err.message).toBe("Simple error");
    expect(err.name).toBe("ZagoraError");
  });

  test("handler without input schema", () => {
    const fn = zagora()
      .output(z.string())
      .handler(() => "default");

    const res = fn("ignored");
    expect(res.data).toBe("default");
    expect(res.isDefined).toBe(false);
  });

  test("handler without output schema", () => {
    const fn = zagora()
      .input(z.string())
      .handler((input) => ({ processed: input }));

    const res = fn("test");
    expect(res.data).toEqual({ processed: "test" });
    expect(res.isDefined).toBe(false);
  });

  test("handler without error schema", () => {
    const fn = zagora()
      .input(z.string())
      .output(z.string())
      .handler((input) => input.toUpperCase());

    const res = fn("hello");
    expect(res.data).toBe("HELLO");
    expect(res.isDefined).toBe(false);
  });

  test("Zagora builder immutability", () => {
    const z1 = zagora();
    const z2 = z1.input(z.string());
    const z3 = z2.output(z.number());
    const z4 = z3.errors(errorSchemas);

    expect(z1["~zagora"].inputSchema).toBeUndefined();
    expect(z2["~zagora"].inputSchema).toBeDefined();
    expect(z3["~zagora"].outputSchema).toBeDefined();
    expect(z4["~zagora"].errorsSchema).toBeDefined();
  });
});

test("multiple error types with different fields", () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .errors(errorSchemas)
    .handler((input, err) => {
      if (input === "net-404") {
        throw err.NETWORK_ERROR({ message: "Not found", statusCode: 404 });
      }
      if (input === "net-500") {
        throw err.NETWORK_ERROR({ message: "Server error", statusCode: 500 });
      }
      if (input === "val-email") {
        throw err.VALIDATION_ERROR({ message: "Invalid", field: "email" });
      }
      return input;
    });

  const net404 = fn("net-404");
  if (net404.isDefined && net404.error.type === "NETWORK_ERROR") {
    expect(net404.error.statusCode).toBe(404);
  } else {
    throw new Error("Expected NETWORK_ERROR 404");
  }

  const net500 = fn("net-500");
  if (net500.isDefined && net500.error.type === "NETWORK_ERROR") {
    expect(net500.error.statusCode).toBe(500);
  } else {
    throw new Error("Expected NETWORK_ERROR 500");
  }

  const valEmail = fn("val-email");
  if (valEmail.isDefined && valEmail.error.type === "VALIDATION_ERROR") {
    expect(valEmail.error.field).toBe("email");
  } else {
    throw new Error("Expected VALIDATION_ERROR for email");
  }
});

test("async handler invalid typed error via promise rejection", async () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .errors(errorSchemas)
    .handler(async (input, err) => {
      if (input === "bad") {
        throw err.NETWORK_ERROR({
          message: "Error",
          statusCode: "foo" as any, // expects number 400-599
        });
      }
      return input;
    });

  const res = await fn("bad");
  expect(res.isDefined).toBe(false);
  if (!res.isDefined && res.error instanceof ZagoraError) {
    expect(res.error.reason).toContain("Invalid error data for NETWORK_ERROR");
    expect(res.error.message).toContain("Invalid input: expected number");
  } else {
    throw new Error("Expected invalid error data");
  }
});

test("tuple with multiple error types", () => {
  const fn = zagora()
    .input(z.tuple([z.string(), z.enum(["a", "b", "c"])]))
    .output(z.string())
    .errors(errorSchemas)
    .handler((str, letter, err) => {
      if (str === "error") {
        throw err.VALIDATION_ERROR({ message: "Bad", field: "letter" });
      }
      return `${str}-${letter}`;
    });

  const res = fn("test", "a");
  expect(res.data).toBe("test-a");

  const errRes = fn("error", "a");
  if (errRes.isDefined && errRes.error.type === "VALIDATION_ERROR") {
    expect(errRes.error.field).toBe("letter");
  } else {
    throw new Error("Expected VALIDATION_ERROR");
  }
});

describe("utils", () => {
  test("isAsyncFunction utility function", () => {
    const asyncFn = async () => "result";
    expect(isAsyncFunction(asyncFn)).toBe(true);

    const syncFn = () => "result";
    expect(isAsyncFunction(syncFn)).toBe(false);

    const notFn = "not a function";
    expect(isAsyncFunction(notFn)).toBe(false);

    const fnReturningPromise = () => Promise.resolve("result");
    expect(isAsyncFunction(fnReturningPromise)).toBe(true);

    const fnThrowingError = () => {
      throw new Error("error");
    };
    expect(isAsyncFunction(fnThrowingError)).toBe(false);
  });

  test("createResult utility function", () => {
    const result = createResult("data", null, false);
    expect(result[0]).toBe("data");
    expect(result[1]).toBe(null);
    expect(result[2]).toBe(false);
    expect(result.data).toBe("data");
    expect(result.error).toBe(null);
    expect(result.isDefined).toBe(false);

    const errResult = createResult(null, new Error("error"), true);
    expect(errResult[0]).toBe(null);
    expect(errResult[1]).toBeInstanceOf(Error);
    expect(errResult[2]).toBe(true);
    expect(errResult.data).toBe(null);
    expect(errResult.isDefined).toBe(true);
  });

  test("async input schema", async () => {
    const asyncSchema = z
      .string()
      .refine(async (val) => val.length > 2, "Min 3 chars");

    const fn = zagora()
      .input(asyncSchema)
      .output(z.string())
      .handler((input) => input.toUpperCase());

    const res = await fn("ab");
    expect(res.isDefined).toBe(false);
    expect(res.error).toBeInstanceOf(ZagoraError);
  });

  test("async output schema", async () => {
    const asyncSchema = z
      .string()
      .refine(async (val) => val !== "bad", "Bad value");

    const fn = zagora()
      .input(z.string())
      .output(asyncSchema)
      .handler(async (input) => input);

    const res = await fn("bad");
    expect(res.isDefined).toBe(false);
    expect(res.error).toBeInstanceOf(ZagoraError);
  });

  test("handleError with async schema validation", async () => {
    const asyncErrorSchema = z.object({
      type: z.literal("ASYNC_ERROR"),
      faab: z.number().refine(async (val) => val < 500, "Code too high"),
    });

    const fn = zagora()
      .input(z.string())
      .output(z.string())
      .errors({ ASYNC_ERROR: asyncErrorSchema })
      .handler((input, err) => {
        if (input === "fail") {
          throw err.ASYNC_ERROR({ faab: 405 });
        }
        return input;
      });

    const res = await fn("fail");
    expect(res.isDefined).toBe(true);
    expect(res.error).not.toBeInstanceOf(ZagoraError);
    if (!(res.error instanceof ZagoraError)) {
      expect(res.error).toEqual({
        type: "ASYNC_ERROR",
        faab: 405,
      });
    } else {
      throw new Error("should not be a ZagoraError");
    }
  });

  test("validateInput with object schema", () => {
    const fn = zagora()
      .input(
        z.object({
          name: z.string().min(1),
          age: z.number().positive(),
        }),
      )
      .output(z.string())
      .handler((obj) => `${obj.name}:${obj.age}`);

    const res = fn({ name: "Alice", age: 30 });
    expect(res.data).toBe("Alice:30");
  });

  test("generalValidator with error on output", () => {
    const fn = zagora()
      .input(z.string())
      .output(z.number().positive())
      .handler((input) => -5);

    const res = fn("test");
    expect(res.isDefined).toBe(false);
    expect(res.error).toBeInstanceOf(ZagoraError);
    expect(res.error?.reason).toBe("Output validation failed");
    expect(res.error?.issues).toBeDefined();
  });

  test("isAsyncFunction detects Promise return", () => {
    const fn = zagora().handler(() => {
      return new Promise((resolve) => resolve("async"));
    });

    const res = fn("test");
    expect(res).toBeInstanceOf(Promise);
  });

  test("handleTupleDefaults with optional elements", () => {
    const fn = zagora()
      .input(z.tuple([z.string(), z.number().default(999)]))
      .output(z.string())
      .handler((str, num) => `${str}-${num}`);

    const res = fn("hello");
    expect(res.data).toBe("hello-999");
  });

  test("multiple validation issues collected", () => {
    const fn = zagora()
      .input(
        z.object({
          email: z.string().email(),
          age: z.number().min(18),
        }),
      )
      .output(z.string())
      .handler((obj) => obj.email);

    const res = fn({ email: "invalid", age: 10 });
    expect(res.isDefined).toBe(false);
    expect(res.error).toBeDefined();
    expect((res.error as ZagoraError).issues).toBeDefined();
    if (res.error instanceof ZagoraError && res.error.issues) {
      expect(res.error.issues.length).toEqual(2);
    }
  });

  test("promise rejection in async handler caught", async () => {
    const fn = zagora()
      .input(z.string())
      .output(z.string())
      .handler(async (input) => {
        throw new Error("Async rejection");
      });

    const res = await fn("test");
    expect(res.isDefined).toBe(false);
    expect(res.error).toBeInstanceOf(ZagoraError);
    expect((res.error as ZagoraError).cause).toBeInstanceOf(Error);
    expect(((res.error as ZagoraError).cause as Error).message).toBe(
      "Async rejection",
    );
  });

  test("non-Error objects thrown as cause", () => {
    const fn = zagora()
      .input(z.string())
      .output(z.string())
      .handler((input) => {
        throw "string error";
      });

    const res = fn("test");
    expect(res.isDefined).toBe(false);
    expect(res.error).toBeInstanceOf(ZagoraError);
    expect((res.error as Error).message).toBe(
      "Synchronous handler threw unknown error",
    );
    expect((res.error as ZagoraError).cause).toBe("string error");
  });

  test("typed error without errors schema ignored", () => {
    const fn = zagora()
      .input(z.string())
      .output(z.string())
      .handler((input) => {
        throw { type: "CUSTOM_ERROR", message: "test" };
      });

    const res = fn("test");
    expect(res.isDefined).toBe(false);
    expect(res.error).toBeInstanceOf(ZagoraError);
    expect(res.error?.message).toContain(
      "Synchronous handler threw unknown error",
    );
  });

  test("array schema handled as primitive", () => {
    const fn = zagora()
      .input(z.array(z.string()))
      .output(z.number())
      .handler((arr) => arr.length);

    const res = fn(["a", "b", "c"]);
    expect(res.data).toBe(3);
  });

  test("valibot optional tuple with default", async () => {
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

    // Should accept just one argument - second has default
    const res1 = await hello("fast");
    expect(res1.isDefined).toBe(false);
    expect(res1.data && res1.data.foo).toBe("fast-123");

    // Should also accept two arguments
    const res2 = await hello("slow", 5);
    expect(res2.isDefined).toBe(false);
    expect(res2.data && res2.data.foo).toBe("slow-5");
  });
});
