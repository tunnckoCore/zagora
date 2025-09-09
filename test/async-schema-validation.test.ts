// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "bun:test";
import * as v from "valibot";
import z from "zod";
import { ZagoraError, zagora } from "../src/index.ts";
import { testUtils, zodSchemas } from "./helpers.ts";

// Custom async schemas for testing edge cases
const asyncSchemas = {
  // Async Zod schema that validates after a delay
  asyncString: z.string().refine(async (val) => {
    await testUtils.delay(5);
    return val.length > 0;
  }, "String cannot be empty"),

  // Async Valibot schema
  asyncValibot: v.pipeAsync(
    v.string(),
    v.checkAsync(async (val) => {
      await testUtils.delay(5);
      return val.includes("async");
    }, "Must contain 'async'")
  ),

  // Async number validation
  asyncNumber: z.number().refine(async (num) => {
    await testUtils.delay(5);
    return num > 0;
  }, "Must be positive"),

  // Complex async object
  asyncUser: z.object({
    id: z.string(),
    name: z.string().refine(async (name) => {
      await testUtils.delay(10);
      return name !== "forbidden";
    }, "Name is forbidden"),
    email: z.email(),
  }),
};

// Async error schemas
const asyncErrorSchemas = {
  asyncNetwork: z
    .object({
      type: z.literal("ASYNC_NETWORK_ERROR"),
      message: z.string(),
      statusCode: z.number(),
    })
    .refine(async (err) => {
      await testUtils.delay(5);
      return err.statusCode >= 400;
    }, "Status code must be >= 400"),
};

test("should handle async output schema validation in async handler", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(asyncSchemas.asyncString)
    .handler(async (input) => {
      await testUtils.delay(5);
      return input;
    });

  // Test valid case
  const validResult = await handler("hello");
  expect(validResult.data).toBe("hello");
  expect(validResult.error).toBe(null);
  expect(validResult.isDefined).toBe(false);

  // Test invalid case
  const invalidResult = await handler("");
  expect(invalidResult.data).toBe(null);
  expect(invalidResult.error).toBeInstanceOf(ZagoraError);
  expect(invalidResult.isDefined).toBe(false);
  if (invalidResult.error && !invalidResult.isDefined) {
    expect(invalidResult.error.message).toContain("String cannot be empty");
  } else {
    expect(invalidResult.data).toBeEmpty();
    expect("should have async validation error").toBe("but got success");
  }
});

test("should never throw when async output schema used with handlerSync", () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(asyncSchemas.asyncString)
    .handlerSync((input) => input);

  const result = handler("test");

  if (result.error) {
    expect(result.data).toBeEmpty();
    expect(result.error).toBeInstanceOf(ZagoraError);
    expect(result.error.message).toContain("Handler threw unknown error");
    expect(result.isDefined).toBe(false);
  } else {
    expect(result.data).toBeEmpty();
    expect("should have sync validation error").toBe("but got success");
  }
});

test("should handle async input schema validation in async handler", async () => {
  const handler = zagora()
    .input(asyncSchemas.asyncString)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(5);
      return input.toUpperCase();
    });

  // Test valid input
  const validResult = await handler("hello");
  expect(validResult.data).toBe("HELLO");
  expect(validResult.error).toBe(null);
  expect(validResult.isDefined).toBe(false);

  // Test invalid input (empty string should fail async validation)
  const invalidResult = await handler("");
  expect(invalidResult.data).toBe(null);
  expect(invalidResult.error).toBeInstanceOf(ZagoraError);
  expect(invalidResult.isDefined).toBe(false);
  if (invalidResult.error && !invalidResult.isDefined) {
    expect(invalidResult.error.message).toContain("String cannot be empty");
  } else {
    expect(invalidResult.data).toBeEmpty();
    expect("should have input validation error").toBe("but got success");
  }
});

test("should throw error when async input schema used with handlerSync", () => {
  expect(() => {
    const handler = zagora()
      .input(asyncSchemas.asyncString)
      .output(zodSchemas.string)
      .handlerSync((input) => input.toUpperCase());

    handler("test");
  }).toThrow("Cannot use async input schema validation in handlerSync");
});

test("should handle async error schema validation in async handler", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors({ asyncNetwork: asyncErrorSchemas.asyncNetwork })
    .handler(async (input, err) => {
      await testUtils.delay(5);
      if (input === "error") {
        return err.asyncNetwork({
          message: "Async network failure",
          statusCode: 500,
        });
      }
      return input.toUpperCase();
    });

  // Test success case
  const successResult = await handler("hello");
  expect(successResult.data).toBe("HELLO");
  expect(successResult.error).toBe(null);
  expect(successResult.isDefined).toBe(false);

  // Test error case
  const errorResult = await handler("error");
  expect(errorResult.data).toBeEmpty();
  expect(errorResult.isDefined).toBe(false);
  if (errorResult.error && !errorResult.isDefined) {
    expect(errorResult.error).toBeInstanceOf(ZagoraError);
    expect(errorResult.error.message).toContain("Handler threw unknown error");
  } else {
    expect(errorResult.data).toBeEmpty();
    expect("should have async error").toBe("but got success or typed error");
  }
});

test("should never throw when async error schema used with handlerSync", () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors({ asyncNetwork: asyncErrorSchemas.asyncNetwork })
    .handlerSync((input, err) => {
      if (input === "error") {
        return err.asyncNetwork({
          message: "Sync attempt",
          statusCode: 500,
        });
      }
      return input.toUpperCase();
    });

  const result = handler("error");

  if (result.error) {
    expect(result.data).toBeEmpty();
    expect(result.error).toBeInstanceOf(ZagoraError);
    expect(result.error.message).toContain("Handler threw unknown error");
    expect(result.isDefined).toBe(false);
  } else {
    expect(result.data).toBeEmpty();
    expect("should have sync validation error").toBe("but got success");
  }
});

test("should handle async Valibot schemas", async () => {
  const handler = zagora()
    .input(asyncSchemas.asyncValibot)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(5);
      return input.toUpperCase();
    });

  // Test valid input
  const validResult = await handler("test async");
  expect(validResult.data).toBe("TEST ASYNC");
  expect(validResult.error).toBe(null);
  expect(validResult.isDefined).toBe(false);

  // Test invalid input (doesn't contain 'async')
  const invalidResult = await handler("test");
  expect(invalidResult.data).toBe(null);
  expect(invalidResult.error).toBeInstanceOf(ZagoraError);
  expect(invalidResult.isDefined).toBe(false);
});

test("should handle complex async object validation", async () => {
  const handler = zagora()
    .input(asyncSchemas.asyncUser)
    .output(zodSchemas.string)
    .handler(async (user) => {
      await testUtils.delay(5);
      return `Hello ${user.name}`;
    });

  // Test valid user
  const validUser = {
    id: "123",
    name: "John",
    email: "john@example.com",
  };

  const validResult = await handler(validUser);
  expect(validResult.data).toBe("Hello John");
  expect(validResult.error).toBe(null);
  expect(validResult.isDefined).toBe(false);

  // Test forbidden name
  const forbiddenUser = {
    id: "456",
    name: "forbidden",
    email: "forbidden@example.com",
  };

  const invalidResult = await handler(forbiddenUser);
  expect(invalidResult.data).toBe(null);
  expect(invalidResult.error).toBeInstanceOf(ZagoraError);
  expect(invalidResult.isDefined).toBe(false);
  if (invalidResult.error && !invalidResult.isDefined) {
    expect(invalidResult.error.message).toContain("Name is forbidden");
  } else {
    expect(invalidResult.data).toBeEmpty();
    expect("should have forbidden name error").toBe("but got success");
  }
});

test("should handle mixed sync and async validation", async () => {
  const handler = zagora()
    .input(zodSchemas.string) // sync input
    .output(asyncSchemas.asyncNumber) // async output
    .handler(async (input) => {
      await testUtils.delay(5);
      return input.length;
    });

  // Test valid case (string length > 0)
  const validResult = await handler("hello");
  expect(validResult.data).toBe(5);
  expect(validResult.error).toBe(null);
  expect(validResult.isDefined).toBe(false);

  // Test edge case where string length is 0 (should fail async output validation)
  const invalidResult = await handler("");
  expect(invalidResult.data).toBe(null);
  expect(invalidResult.error).toBeInstanceOf(ZagoraError);
  expect(invalidResult.isDefined).toBe(false);
  if (invalidResult.error && !invalidResult.isDefined) {
    expect(invalidResult.error.message).toContain("Must be positive");
  } else {
    expect(invalidResult.data).toBeEmpty();
    expect("should have async output validation error").toBe("but got success");
  }
});

test("should handle async tuple return with async error validation", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors({ asyncNetwork: asyncErrorSchemas.asyncNetwork })
    .handler(async (input, _err) => {
      await testUtils.delay(5);
      if (input === "asyncError") {
        return [
          null,
          {
            type: "ASYNC_NETWORK_ERROR",
            message: "Tuple async error",
            statusCode: 503,
          },
        ];
      }
      return [input.toUpperCase(), null];
    });

  // Test success case
  const successResult = await handler("hello");
  expect(successResult.data).toBe("HELLO");
  expect(successResult.error).toBe(null);
  expect(successResult.isDefined).toBe(false);

  // Test async error validation in tuple
  const errorResult = await handler("asyncError");
  expect(errorResult.data).toBe(null);
  expect(errorResult.isDefined).toBe(true);
  if (errorResult.error && errorResult.isDefined) {
    expect(errorResult.error.type).toBe("ASYNC_NETWORK_ERROR");
    expect(errorResult.error.statusCode).toBe(503);
  } else {
    expect(errorResult.data).toBeEmpty();
    expect("should have async tuple error").toBe(
      "but got success or untyped error"
    );
  }
});

test("should handle string error as untyped", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors({ asyncNetwork: asyncErrorSchemas.asyncNetwork })
    .handler(async (input, _err) => {
      await testUtils.delay(5);
      if (input === "stringError") {
        // Return a string as error - definitely untyped
        return [null, "This is just a string error"];
      }
      return [input.toUpperCase(), null];
    });

  const errorResult = await handler("stringError");
  expect(errorResult.data).toBeEmpty();
  expect(errorResult.isDefined).toBe(false); // Should be untyped error
  if (errorResult.error && !errorResult.isDefined) {
    expect(errorResult.error as any).toBe("This is just a string error");
  } else {
    expect(errorResult.data).toBeEmpty();
    expect("should have untyped error").toBe("but got success or typed error");
  }
});

test("should handle number error as untyped", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors({ asyncNetwork: asyncErrorSchemas.asyncNetwork })
    .handler(async (input, _err) => {
      await testUtils.delay(5);
      if (input === "numberError") {
        // Return a number as error - definitely untyped
        return [null, 404];
      }
      return [input.toUpperCase(), null];
    });

  const errorResult = await handler("numberError");
  expect(errorResult.data).toBeEmpty();
  expect(errorResult.isDefined).toBe(false); // Should be untyped error
  if (errorResult.error && !errorResult.isDefined) {
    expect(errorResult.error as any).toBe(404);
  } else {
    expect(errorResult.data).toBeEmpty();
    expect("should have untyped error").toBe("but got success or typed error");
  }
});

test("should handle wrong object shape as untyped", async () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors({ asyncNetwork: asyncErrorSchemas.asyncNetwork })
    .handler(async (input, _err) => {
      await testUtils.delay(5);
      if (input === "wrongShape") {
        // Return object with completely wrong shape
        return [null, { foo: "bar", baz: 123 }];
      }
      return [input.toUpperCase(), null];
    });

  const errorResult = await handler("wrongShape");
  expect(errorResult.data).toBeEmpty();
  expect(errorResult.isDefined).toBe(false); // Should be untyped error
  if (errorResult.error && !errorResult.isDefined) {
    expect(errorResult.error as any).toEqual({ foo: "bar", baz: 123 });
  } else {
    expect(errorResult.data).toBeEmpty();
    expect("should have untyped error").toBe("but got success or typed error");
  }
});

test("should handle concurrent async validations", async () => {
  const handler = zagora()
    .input(asyncSchemas.asyncString)
    .output(asyncSchemas.asyncString)
    .handler(async (input) => {
      await testUtils.delay(20);
      return input;
    });

  const promises = [handler("async1"), handler("async2"), handler("async3")];

  const results = await Promise.all(promises);

  results.forEach((result, index) => {
    expect(result.data).toBe(`async${index + 1}`);
    expect(result.error).toBe(null);
    expect(result.isDefined).toBe(false);
  });
});

test("should handle async schema with error helpers", async () => {
  const asyncErrorHelper = {
    async: z
      .object({
        type: z.literal("ASYNC_ERROR"),
        message: z.string(),
        delay: z.number(),
      })
      .refine(async (err) => {
        await testUtils.delay(err.delay);
        return err.delay > 0;
      }, "Delay must be positive"),
  };

  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors(asyncErrorHelper)
    .handler(async (input, err) => {
      await testUtils.delay(5);
      if (input === "async") {
        return err.async({
          message: "Async error occurred",
          delay: 10,
        });
      }
      return input.toUpperCase();
    });

  const errorResult = await handler("async");
  expect(errorResult.data).toBeEmpty();
  expect(errorResult.isDefined).toBe(false);
  if (errorResult.error && !errorResult.isDefined) {
    expect(errorResult.error).toBeInstanceOf(ZagoraError);
    expect(errorResult.error.message).toContain("Handler threw unknown error");
  } else {
    expect(errorResult.data).toBeEmpty();
    expect("should have async error helper result").toBe("but got success");
  }
});

test("should never throw when async schema used in sync error helpers", () => {
  const asyncErrorHelper = {
    async: asyncErrorSchemas.asyncNetwork,
  };

  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors(asyncErrorHelper)
    .handlerSync((input, err) => {
      return err.async({
        message: "Sync error helper test",
        statusCode: 500,
      });
    });

  const result = handler("test");

  if (result.error) {
    expect(result.data).toBeEmpty();
    expect(result.error).toBeInstanceOf(ZagoraError);
    expect(result.error.message).toContain("Handler threw unknown error");
    expect(result.isDefined).toBe(false);
  } else {
    expect(result.data).toBeEmpty();
    expect("should have sync validation error").toBe("but got success");
  }
});

test("should handle deeply nested async validation", async () => {
  const deepAsyncSchema = z.object({
    level1: z.object({
      level2: z.object({
        value: z.string().refine(async (val) => {
          await testUtils.delay(10);
          return val.includes("deep");
        }, "Must contain 'deep'"),
      }),
    }),
  });

  const handler = zagora()
    .input(deepAsyncSchema)
    .output(zodSchemas.string)
    .handler(async (input) => {
      await testUtils.delay(5);
      return input.level1.level2.value.toUpperCase();
    });

  // Test valid deep structure
  const validInput = {
    level1: {
      level2: {
        value: "deep validation",
      },
    },
  };

  const validResult = await handler(validInput);
  expect(validResult.data).toBe("DEEP VALIDATION");
  expect(validResult.error).toBe(null);
  expect(validResult.isDefined).toBe(false);

  // Test invalid deep structure
  const invalidInput = {
    level1: {
      level2: {
        value: "shallow",
      },
    },
  };

  const invalidResult = await handler(invalidInput);
  expect(invalidResult.data).toBe(null);
  expect(invalidResult.error).toBeInstanceOf(ZagoraError);
  expect(invalidResult.isDefined).toBe(false);
  if (invalidResult.error && !invalidResult.isDefined) {
    expect(invalidResult.error.message).toContain("Must contain 'deep'");
  } else {
    expect(invalidResult.data).toBeEmpty();
    expect("should have deep async validation error").toBe("but got success");
  }
});

test("should handle invalid error data passed to error helpers", () => {
  const handler = zagora()
    .input(zodSchemas.string)
    .output(zodSchemas.string)
    .errors({ asyncNetwork: asyncErrorSchemas.asyncNetwork })
    .handlerSync((input, err) => {
      if (input === "invalidError") {
        // Provide completely invalid error data that won't validate
        return err.asyncNetwork({
          invalidField: "this doesn't match the schema at all",
          anotherBadField: 123,
          wrongType: true,
        } as any);
      }
      return input.toUpperCase();
    });

  const result = handler("invalidError");

  if (result.error) {
    expect(result.data).toBeEmpty();
    expect(result.error).toBeInstanceOf(ZagoraError);
    expect(result.error.message).toContain("Handler threw unknown error");
    expect(result.isDefined).toBe(false);
    // The cause should be the "Invalid error data" ZagoraError
    expect((result.error as ZagoraError).cause).toBeInstanceOf(ZagoraError);
    if (result.error && (result.error as any).cause instanceof ZagoraError) {
      expect((result.error as any).cause.message).toContain(
        'Invalid error data for "errors.asyncNetwork"'
      );
    }
  } else {
    expect(result.data).toBeEmpty();
    expect("should have error helper validation error").toBe("but got success");
  }
});
