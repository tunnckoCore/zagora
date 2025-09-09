// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "bun:test";
import { ZagoraError, zagora } from "../src/index.ts";
import {
  errorSchemas,
  testData,
  testUtils,
  valibotSchemas,
  zodSchemas,
} from "./helpers.ts";

test("should create and execute basic async handler", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(5);
      return input.toUpperCase();
    });

  const result = await handler("hello");

  expect(result.data).toBe("HELLO");
  expect(result.error).toBe(null);
  expect(result.isDefined).toBe(false);

  // Test tuple destructuring
  const [data, error, isDefined] = result;
  expect(data).toBe("HELLO");
  expect(error).toBe(null);
  expect(isDefined).toBe(false);
});

test("should handle input validation errors", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(5);
      return input.toUpperCase();
    });

  const result = await handler(123 as any);

  expect(result.data).toBe(null);
  expect(result.error).toBeInstanceOf(ZagoraError);
  expect(result.isDefined).toBe(false);
  expect(result.error?.message).toContain("expected string");
});

test("should handle output validation errors", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.number)
    .handler(async (input) => {
      await testUtils.delay(5);
      return input; // Returns string but output expects number
    });

  const result = await handler("test");

  expect(result.data).toBe(null);
  expect(result.error).toBeInstanceOf(ZagoraError);
  expect(result.isDefined).toBe(false);
  expect(result.error?.message).toContain("expected number");
});

test("should handle handler throwing exceptions", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(5);
      throw new Error("Some thrown error");
    });

  const result = await handler("test");

  expect(result.data).toBe(null);
  expect(result.error).toBeInstanceOf(ZagoraError);
  expect(result.isDefined).toBe(false);

  expect(result.error?.message).toContain("Handler threw unknown error");
  expect(result.error?.cause).toBeInstanceOf(Error);
  expect((result.error?.cause as Error).message).toContain("Some thrown error");
});

test("should handle Promise rejection", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await Promise.reject(new Error("Promise rejected"));
    });

  const result = await handler("test");

  expect(result.data).toBe(null);
  expect(result.error).toBeInstanceOf(ZagoraError);
  expect(result.isDefined).toBe(false);
  if (result.error) {
    expect(result.error.cause).toBeInstanceOf(Error);
    expect((result.error.cause as Error).message).toContain("Promise rejected");
  }
});

test("should return error when synchronous function is passed to .handler", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler((input) => {
      return `foo bar ${input}`;
    });

  const result = await handler("barry");

  expect(result.data).toBe(null);
  expect(result.error).toBeInstanceOf(ZagoraError);
  expect(result.isDefined).toBe(false);
  expect(result.error?.message).toContain("only accepts async functions");
  expect(result.error?.cause).toBeEmpty();
});

test("should handle tuple return values with success", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(5);
      return [input.toUpperCase(), null];
    });

  const result = await handler("hello");

  expect(result.data).toBe("HELLO");
  expect(result.error).toBe(null);
  expect(result.isDefined).toBe(false);
  expect(result.error).toBeEmpty();
  expect(result.error?.cause).toBeEmpty();
});

test("should handle tuple return values with error", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(5);
      return [null, new ZagoraError("Custom async error")];
    });

  const result = await handler("hello");

  expect(result.data).toBe(null);
  expect(result.error).toBeInstanceOf(ZagoraError);
  expect(result.isDefined).toBe(false);
  expect(result.error?.message).toBe("Custom async error");
});

test("should work with object input schemas", async () => {
  const handler = zagora()
    .input(zodSchemas.user)
    .output(zodSchemas.user)
    .handler(async (user) => {
      await testUtils.delay(5);
      return { ...user, name: user.name.toUpperCase() };
    });

  const result = await handler(testData.validUser);

  expect(result.data).toEqual({
    ...testData.validUser,
    name: "JOHN DOE",
  });
  expect(result.error).toBe(null);
});

test("should work with tuple input schemas - single argument", async () => {
  const handler = zagora()
    .input(zodSchemas.coordinates)
    .output(zodSchemas.number)
    .handler(async (x, y) => {
      await testUtils.delay(5);
      return Math.sqrt(x ** 2 + y ** 2);
    });

  const result = await handler(3, 4);

  expect(result.data).toBe(5);
  expect(result.error).toBe(null);
});

test("should work with error schemas", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors(errorSchemas.single)
    .handler(async (input, err) => {
      await testUtils.delay(5);
      if (input === "error") {
        return err.network({
          message: "Network failure",
          statusCode: 500,
        });
      }
      return [input.toUpperCase(), null];
    });

  // Test success case
  const successResult = await handler("hello");
  expect(successResult.data).toBe("HELLO");
  expect(successResult.error).toBe(null);
  expect(successResult.isDefined).toBe(false);

  // Test error case
  const errorResult = await handler("error");
  expect(errorResult.data).toBe(null);
  expect(errorResult.error?.type).toBe("NETWORK_ERROR");
  expect(errorResult.isDefined).toBe(true);
});

test("should work with multiple error schemas", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors(errorSchemas.multiple)
    .handler(async (input, err) => {
      await testUtils.delay(5);
      if (input === "network") {
        return err.network({
          message: "Network failed",
          statusCode: 500,
        });
      }
      if (input === "validation") {
        return err.validation({
          message: "Validation failed",
          field: "input",
          value: input,
        });
      }
      return [input.toUpperCase(), null];
    });

  // Test different error types
  const networkResult = await handler("network");
  expect(networkResult.error?.type).toBe("NETWORK_ERROR");
  expect(networkResult.isDefined).toBe(true);

  const validationResult = await handler("validation");
  expect(validationResult.error?.type).toBe("VALIDATION_ERROR");
  expect(validationResult.isDefined).toBe(true);
});

test("should work with errorsFirst config", async () => {
  const handler = zagora({ errorsFirst: true })
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors(errorSchemas.single)
    .handler(async (err, input) => {
      await testUtils.delay(5);
      if (input === "error") {
        return err.network({
          message: "Network failure",
          statusCode: 500,
        });
      }
      return [input.toUpperCase(), null];
    });

  const result = await handler("hello");
  expect(result.data).toBe("HELLO");

  const errorResult = await handler("error");
  expect(errorResult.error?.type).toBe("NETWORK_ERROR");
});

test("should handle untyped errors returned from handler", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(5);
      return [null, "Some error"];
    });

  const result = await handler("test");

  expect(result.data).toBe(null);
  expect(result.error).toBeInstanceOf(ZagoraError);
  expect(result.isDefined).toBe(false);
  expect(result.error?.message).toBe("Untyped error returned");
});

test("should handle existing ZagoraError in tuple", async () => {
  const customError = new ZagoraError("Custom zagora error");

  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(5);
      return [null, customError];
    });

  const result = await handler("test");

  expect(result.data).toBe(null);
  expect(result.error).toBe(customError);
  expect(result.isDefined).toBe(false);
});

test("should reject sync functions in async handler", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler((input) => {
      return input.toUpperCase();
    });

  const result = await handler("test");

  expect(result.data).toBe(null);
  expect(result.error).toBeInstanceOf(ZagoraError);
  expect(result.error?.message).toContain(
    "Using `.handler` only accepts async functions"
  );
});

test("should work with Valibot schemas", async () => {
  const handler = zagora()
    .input(valibotSchemas.string)
    .output(valibotSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(5);
      return input.toUpperCase();
    });

  const result = await handler("hello");

  expect(result.data).toBe("HELLO");
  expect(result.error).toBe(null);
});

test("should handle invalid object input", async () => {
  const handler = zagora()
    .input(zodSchemas.user)
    .output(zodSchemas.user)
    .handler(async (user) => {
      await testUtils.delay(5);
      return user;
    });

  const result = await handler(testData.invalidUser as any);

  expect(result.data).toBe(null);
  expect(result.error).toBeInstanceOf(ZagoraError);
});

test("should handle error helper auto-injection", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors(errorSchemas.single)
    .handler(async (input, err) => {
      await testUtils.delay(5);
      if (input === "error") {
        // Test without providing type - should auto-inject
        return err.network({
          message: "Network failure",
          statusCode: 500,
        });
      }
      return [input, null];
    });

  const result = await handler("error");
  expect(result.error?.type).toBe("NETWORK_ERROR");
  expect(result.isDefined).toBe(true);
});

test("should maintain result format consistency", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(5);
      return input.toUpperCase();
    });

  const result = await handler("test");

  // Should work as both array and object
  expect(Array.isArray(result)).toBe(true);
  expect(result.length).toBe(3);
  expect(result[0]).toBe("TEST");
  expect(result[1]).toBe(null);
  expect(result[2]).toBe(false);

  expect(result.data).toBe("TEST");
  expect(result.error).toBe(null);
  expect(result.isDefined).toBe(false);
});

test("should handle non-tuple return values", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(5);
      // Return object instead of string - should fail validation
      return { result: input.toUpperCase() };
    });

  const result = await handler("test");

  // Should validate the object as output and fail
  expect(result.data).toBe(null);
  expect(result.error).toBeInstanceOf(ZagoraError);
  expect(result.error?.message).toContain("expected string");
});

test("should handle async validation with complex types", async () => {
  const handler = zagora()
    .input(zodSchemas.user)
    .output(zodSchemas.string)
    .handler(async (user) => {
      await testUtils.delay(5);
      return `Hello ${user.name}, you are ${user.age} years old!`;
    });

  const result = await handler(testData.validUser);

  expect(result.data).toBe("Hello John Doe, you are 30 years old!");
  expect(result.error).toBe(null);
});

test("should handle tuple errors with error validation", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors(errorSchemas.single)
    .handler(async (input, _err) => {
      await testUtils.delay(5);
      if (input === "typedError") {
        return [
          null,
          {
            type: "NETWORK_ERROR",
            message: "Async network error",
            statusCode: 503,
          },
        ];
      }
      return [input.toUpperCase(), null];
    });

  const result = await handler("typedError");
  expect(result.data).toBe(null);
  expect(result.error?.type).toBe("NETWORK_ERROR");
  expect(result.isDefined).toBe(true);
});

test("should handle concurrent handler calls", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(20);
      return input.toUpperCase();
    });

  const promises = [handler("hello"), handler("world"), handler("barry")];

  const results = await Promise.all(promises);

  const hello = Boolean(results.find((x) => (x.data as any).includes("HELLO")));
  const world = Boolean(results.find((x) => (x.data as any).includes("WORLD")));
  const barry = Boolean(results.find((x) => (x.data as any).includes("BARRY")));

  expect(hello).toBe(true);
  expect(world).toBe(true);
  expect(barry).toBe(true);

  for (const result of results) {
    expect(result.error).toBe(null);
    expect(result.isDefined).toBe(false);
  }
});

test("should handle delayed async operations", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(50);
      return input.toUpperCase();
    });

  const startTime = Date.now();
  const result = await handler("hello");
  const endTime = Date.now();

  expect(result.data).toBe("HELLO");
  expect(endTime - startTime).toBeGreaterThanOrEqual(45); // Allow for timing variance
});

test("should handle mixed promise results", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      if (input === "fast") {
        return Promise.resolve(input.toUpperCase());
      }
      await testUtils.delay(10);
      return input.toUpperCase();
    });

  const fastResult = await handler("fast");
  const slowResult = await handler("slow");

  expect(fastResult.data).toBe("FAST");
  expect(slowResult.data).toBe("SLOW");
});

test("should handle async error validation", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors(errorSchemas.multiple)
    .handler(async (input, err) => {
      return err.validation({
        message: "Invalid input provided",
        field: "foo",
        value: input,
      });
    });

  const result = await handler("barry");
  expect(result.isDefined).toBe(true);

  if (result.error && result.isDefined) {
    expect(result.error.type).toBe("VALIDATION_ERROR");

    if (result.error.type === "VALIDATION_ERROR") {
      expect(result.error.field).toBe("foo");
    }
  } else {
    expect("foo").toBe("should be defined error");
  }
});

test("should handle timeout-like scenarios", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(100);
      return input.toUpperCase();
    });

  // This should still work, just take longer
  const result = await handler("timeout");
  expect(result.data).toBe("TIMEOUT");
  expect(result.error).toBe(null);
});

test("should handle async ZagoraError throwing", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(5);
      throw new ZagoraError(`Custom async ZagoraError: ${input}`);
    });

  const result = await handler("barry");

  expect(result.data).toBe(null);
  expect(result.error).toBeInstanceOf(ZagoraError);
  if (result.error) {
    expect(result.error.message).toContain("Handler threw unknown error");
    expect(result.error.cause).toBeInstanceOf(ZagoraError);
    expect((result.error.cause as Error).message).toContain(
      "Custom async ZagoraError: barry"
    );
  } else {
    expect(result.isDefined).toBe(false);
    expect(result.data).toBeEmpty();
    expect("foo").toBe("result should be with error not with data");
  }
});
