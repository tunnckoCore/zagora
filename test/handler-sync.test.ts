// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from "bun:test";
import { ZagoraError, zagora } from "../src/index.ts";
import {
  errorSchemas,
  testData,
  valibotSchemas,
  zodSchemas,
} from "./helpers.ts";

describe("Synchronous Handlers", () => {
  test("should create and execute basic sync handler", () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .handlerSync((input) => {
        return input.toUpperCase();
      });

    const result = handler("hello");

    expect(result.data).toBe("HELLO");
    expect(result.error).toBe(null);
    expect(result.isDefined).toBe(false);

    // Test tuple destructuring
    const [data, error, isDefined] = result;
    expect(data).toBe("HELLO");
    expect(error).toBe(null);
    expect(isDefined).toBe(false);
  });

  test("should handle input validation errors", () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .handlerSync((input) => input.toUpperCase());

    const result = handler(123 as any);

    expect(result.data).toBe(null);
    expect(result.error).toBeInstanceOf(ZagoraError);
    expect(result.isDefined).toBe(false);
    expect(result.error?.issues).toBeDefined();
    expect(result.error?.reason).toBe("Failure caused by validation");
    expect(result.error?.message).toContain("expected string");
  });

  test("should handle output validation errors", () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.number)
      .handlerSync((input) => {
        return input; // Returns string but output expects number
      });

    const result = handler("barry");

    expect(result.data).toBe(null);
    expect(result.error).toBeInstanceOf(ZagoraError);
    expect(result.isDefined).toBe(false);
    expect((result.error as ZagoraError).reason).toBe(
      "Failure caused by validation"
    );
    expect(result.error?.message).toContain("expected number");
  });

  test("should handle handler throwing exceptions", () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .handlerSync((_input) => {
        throw new Error("Some basic error");
      });

    const result = handler("barry");

    expect(result.data).toBe(null);
    expect(result.error).toBeInstanceOf(ZagoraError);
    expect(result.isDefined).toBe(false);
    expect(result.error?.message).toContain("Handler threw unknown error");
    expect(result.error?.cause).toBeInstanceOf(Error);
    expect((result.error?.cause as Error).message).toContain(
      "Some basic error"
    );
  });

  test("should handle tuple return values with success", () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .handlerSync((input) => {
        return [input.toUpperCase(), null];
      });

    const result = handler("hello");

    expect(result.data).toBe("HELLO");
    expect(result.error).toBe(null);
    expect(result.isDefined).toBe(false);
  });

  test("should handle tuple return values with error", () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .handlerSync((_input) => {
        return [null, new ZagoraError("Custom error")];
      });

    const result = handler("hello");

    expect(result.data).toBe(null);
    expect(result.error).toBeInstanceOf(ZagoraError);
    expect(result.isDefined).toBe(false);
    expect(result.error?.message).toBe("Custom error");
  });

  test("should work with object input schemas", () => {
    const handler = zagora()
      .input(zodSchemas.user)
      .output(zodSchemas.user)
      .handlerSync((user) => {
        return { ...user, name: user.name.toUpperCase() };
      });

    const result = handler(testData.validUser);

    expect(result.data).toEqual({
      ...testData.validUser,
      name: "JOHN DOE",
    });
    expect(result.error).toBe(null);
  });

  test("should work with tuple input schemas - single argument", () => {
    const handler = zagora()
      .input(zodSchemas.coordinates)
      .output(zodSchemas.number)
      .handlerSync((x, y) => {
        return Math.sqrt(x ** 2 + y ** 2);
      });

    const result = handler(3, 4);

    expect(result.data).toBe(5);
    expect(result.error).toBe(null);
  });

  test("should return error when async function is passed to .handlerSync", async () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .handlerSync(async (input) => {
        return `foo bar ${input}`;
      });

    const result = handler("barry");

    expect(result.data).toBe(null);
    expect(result.error).toBeInstanceOf(ZagoraError);
    expect(result.isDefined).toBe(false);
    expect(result.error?.message).toContain(
      "only accepts synchronous functions"
    );
  });

  test("should work with error schemas", () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .errors(errorSchemas.single)
      .handlerSync((input, err) => {
        if (input === "error") {
          return err.network({
            message: "Network failure",
            statusCode: 500,
          });
        }
        return [input.toUpperCase(), null];
      });

    // Test success case
    const successResult = handler("hello");
    expect(successResult.data).toBe("HELLO");
    expect(successResult.error).toBe(null);
    expect(successResult.isDefined).toBe(false);

    // Test error case
    const errorResult = handler("error");
    expect(errorResult.data).toBe(null);
    expect(errorResult.error?.type).toBe("NETWORK_ERROR");
    expect(errorResult.isDefined).toBe(true);
  });

  test("should work with multiple error schemas", () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .errors(errorSchemas.multiple)
      .handlerSync((input, err) => {
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
    const networkResult = handler("network");
    expect(networkResult.error?.type).toBe("NETWORK_ERROR");
    expect(networkResult.isDefined).toBe(true);

    const validationResult = handler("validation");
    expect(validationResult.error?.type).toBe("VALIDATION_ERROR");
    expect(validationResult.isDefined).toBe(true);
  });

  test("should work with errorsFirst config", () => {
    const handler = zagora({ errorsFirst: true })
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .errors(errorSchemas.single)
      .handlerSync((err, input) => {
        if (input === "error") {
          return err.network({
            message: "Network failure",
            statusCode: 500,
          });
        }
        return [input.toUpperCase(), null];
      });

    const result = handler("hello");
    expect(result.data).toBe("HELLO");

    const errorResult = handler("error");
    expect(errorResult.error?.type).toBe("NETWORK_ERROR");
  });

  test("should handle untyped errors returned from handler", () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .handlerSync((_input) => {
        return [null, "Some error"];
      });

    const result = handler("barry");

    expect(result.data).toBe(null);
    expect(result.error).toBeInstanceOf(ZagoraError);
    expect(result.isDefined).toBe(false);
    expect(result.error?.message).toBe("Untyped error returned");
  });

  test("should handle existing ZagoraError in tuple", () => {
    const customError = new ZagoraError("Custom zagora error");

    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .handlerSync((_input) => {
        return [null, customError];
      });

    const result = handler("barry");

    expect(result.data).toBe(null);
    expect(result.error).toBe(customError);
    expect(result.isDefined).toBe(false);
  });

  test("should reject async functions in sync handler", () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .handlerSync(async (input) => {
        return input.toUpperCase();
      });

    const result = handler("barry");

    expect(result.data).toBe(null);
    expect(result.error).toBeInstanceOf(ZagoraError);
    expect(result.error?.message).toContain(
      "Using `.handlerSync` only accepts synchronous functions"
    );
  });

  test("should work with Valibot schemas", () => {
    const handler = zagora()
      .input(valibotSchemas.string)
      .output(valibotSchemas.string)
      .handlerSync((input) => {
        return input.toUpperCase();
      });

    const result = handler("hello");

    expect(result.data).toBe("HELLO");
    expect(result.error).toBe(null);
  });

  test("should handle invalid object input", () => {
    const handler = zagora()
      .input(zodSchemas.user)
      .output(zodSchemas.user)
      .handlerSync((user) => user);

    const result = handler(testData.invalidUser as any);

    expect(result.data).toBe(null);
    expect(result.error).toBeInstanceOf(ZagoraError);
  });

  test("should handle error helper auto-injection", () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .errors(errorSchemas.single)
      .handlerSync((input, err) => {
        if (input === "error") {
          // Test without providing type - should auto-inject
          return err.network({
            message: "Network failure",
            statusCode: 500,
          });
        }
        return [input, null];
      });

    const result = handler("error");
    expect(result.error?.type).toBe("NETWORK_ERROR");
    expect(result.isDefined).toBe(true);
  });

  test("should maintain result format consistency", () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .handlerSync((input) => input.toUpperCase());

    const result = handler("barry");

    // Should work as both array and object
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3);
    expect(result[0]).toBe("BARRY");
    expect(result[1]).toBe(null);
    expect(result[2]).toBe(false);

    expect(result.data).toBe("BARRY");
    expect(result.error).toBe(null);
    expect(result.isDefined).toBe(false);
  });

  test("should handle non-tuple return values", () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .handlerSync((input) => {
        // Return object instead of string - should fail validation
        return { result: input.toUpperCase() };
      });

    const result = handler("barry");

    // Should validate the object as output and fail
    expect(result.data).toBe(null);
    expect(result.error).toBeInstanceOf(ZagoraError);
    expect(result.error?.message).toContain("expected string");
  });

  test("should handle sync validation with complex types", () => {
    const handler = zagora()
      .input(zodSchemas.user)
      .output(zodSchemas.string)
      .handlerSync((user) => {
        return `Hello ${user.name}, you are ${user.age} years old!`;
      });

    const result = handler(testData.validUser);

    expect(result.data).toBe("Hello John Doe, you are 30 years old!");
    expect(result.error).toBe(null);
  });

  // TODO: return tupling types
  test("should handle returning tuple errors with error validation", () => {
    const handler = zagora()
      .input(zodSchemas.string)
      .output(zodSchemas.string)
      .errors(errorSchemas.single)
      .handlerSync((input, _err) => {
        if (input === "typedError") {
          return [
            null,
            {
              type: "NETWORK_ERROR",
              message: "Sync network error",
              statusCode: 503,
            },
          ];
        }
        return [input.toUpperCase(), null];
      });

    const result = handler("typedError");
    expect(result.data).toBe(null);
    expect(result.isDefined).toBe(true);
    if (result.error && result.isDefined) {
      expect(result.error.type).toBe("NETWORK_ERROR");
      expect(result.error.statusCode).toBe(503);
    }
  });
});
