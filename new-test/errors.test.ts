// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "bun:test";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
  createInternalError,
  createValidationError,
  isValidationError,
  isInternalError,
  isDefinedError,
  isZagoraError,
  createErrorHelpers,
} from "../new-src/errors";

test("should create basic error with message", () => {
  const error = createInternalError("Test error");

  expect(error).toBeInstanceOf(Object);
  expect(error.kind).toBe("UNKNOWN_ERROR");
  expect(error.message).toBe("Test error");
});

test("should create error with all options", () => {
  const issues: StandardSchemaV1.Issue[] = [
    {
      message: "Expected string",
      path: ["name"],
    },
  ];

  const error = createValidationError("input", issues);

  expect(error.kind).toBe("VALIDATION_ERROR");
  expect(error.message).toBe(
    "Input validation failed: name => Expected string",
  );
  expect(error.issues).toEqual(issues);
});

test("should create error from issues using createValidationError", () => {
  const issues: StandardSchemaV1.Issue[] = [
    {
      message: "Expected string, received number",
      path: ["email"],
    },
    {
      message: "Invalid email format",
      path: ["email"],
    },
  ];

  const error = createValidationError("input", issues);

  expect(error).toBeInstanceOf(Object);
  expect(error.kind).toBe("VALIDATION_ERROR");
  expect(error.message).toContain("Input validation failed:");
  expect(error.message).toContain("email => Expected string, received number");
  expect(error.message).toContain("email => Invalid email format");
  expect(error.issues).toBe(issues);
});

test("should create error from single issue using createValidationError", () => {
  const issues: StandardSchemaV1.Issue[] = [
    {
      message: "Required field missing",
      path: ["name"],
    },
  ];

  const error = createValidationError("input", issues);

  expect(error.message).toContain("Input validation failed:");
  expect(error.message).toContain("name => Required field missing");
  expect(error.issues).toEqual(issues);
});

test("should handle empty issues array", () => {
  const error = createValidationError("input", []);
  expect(error.message).toBe("Input validation failed: ");
  expect(error.issues).toEqual([]);
});

test("should maintain readonly properties", () => {
  const error = createInternalError("Some custom msg");

  expect(error.kind).toBe("UNKNOWN_ERROR");
  expect(error.message).toBe("Some custom msg");
});

test("should work with instanceof checks", () => {
  const error = createInternalError("foo bar baz");
  const fromIssues = createValidationError("input", []);

  expect(typeof error).toBe("object");
  expect(typeof fromIssues).toBe("object");
});

test("should preserve error stack trace", () => {
  const cause = new Error("Original cause");
  const error = createInternalError("Quxie err", cause);
  expect(error.message).toBe("Quxie err");
  expect(error.cause).toBe(cause);
  expect(error.stack).toBe(cause.stack);
});

test("isValidationError should identify validation errors", () => {
  const validationError = createValidationError("input", []);
  const internalError = createInternalError("foo");
  const definedError = { kind: "CUSTOM_ERROR", message: "bar" };

  expect(isValidationError(validationError)).toBe(true);
  expect(isValidationError(internalError)).toBe(false);
  expect(isValidationError(definedError)).toBe(false);
  expect(isValidationError(null)).toBe(false);
  expect(isValidationError({})).toBe(false);
});

test("isInternalError should identify internal errors", () => {
  const validationError = createValidationError("input", []);
  const internalError = createInternalError("qux");
  const definedError = { kind: "CUSTOM_ERROR", message: "quexie" };

  expect(isInternalError(internalError)).toBe(true);
  expect(isInternalError(validationError)).toBe(false);
  expect(isInternalError(definedError)).toBe(false);
  expect(isInternalError(null)).toBe(false);
  expect(isInternalError({})).toBe(false);
});

test("isDefinedError should identify defined errors", () => {
  const validationError = createValidationError("input", []);
  const internalError = createInternalError("foobie");
  const definedError = { kind: "CUSTOM_ERROR", message: "barry" };
  const lowercaseError = { kind: "custom_error", message: "foo bar" };

  expect(isDefinedError(definedError)).toBe(true);
  expect(isDefinedError(validationError)).toBe(false);
  expect(isDefinedError(internalError)).toBe(false);
  expect(isDefinedError(lowercaseError)).toBe(false);
  expect(isDefinedError(null)).toBe(false);
  expect(isDefinedError({})).toBe(false);
});

test("isZagoraError should identify any zagora error", () => {
  const validationError = createValidationError("input", []);
  const internalError = createInternalError("baz qux");
  const definedError = { kind: "CUSTOM_ERROR", message: "quexie foobie" };
  const notError = { message: "barry baz" };

  expect(isZagoraError(validationError)).toBe(true);
  expect(isZagoraError(internalError)).toBe(true);
  expect(isZagoraError(definedError)).toBe(true);
  expect(isZagoraError(notError)).toBe(false);
  expect(isZagoraError(null)).toBe(false);
});

test("createErrorHelpers should create helper functions", () => {
  const errorMap = {
    NETWORK_ERROR: { type: "NETWORK_ERROR" as const },
    VALIDATION_ERROR: { type: "VALIDATION_ERROR" as const },
  };

  const helpers = createErrorHelpers(errorMap) as any;

  expect(typeof helpers.NETWORK_ERROR).toBe("function");
  expect(typeof helpers.VALIDATION_ERROR).toBe("function");

  const networkError = helpers.NETWORK_ERROR({
    message: "Failed",
    statusCode: 500,
  });
  expect(networkError).toEqual({
    kind: "NETWORK_ERROR",
    message: "Failed",
    statusCode: 500,
  });

  const validationErr = helpers.VALIDATION_ERROR({ field: "email" });
  expect(validationErr).toEqual({
    kind: "VALIDATION_ERROR",
    field: "email",
  });

  const validationError = helpers.VALIDATION_ERROR({ field: "email" });
  expect(validationError).toEqual({
    kind: "VALIDATION_ERROR",
    field: "email",
  });
});

test("createErrorHelpers with empty map", () => {
  const helpers = createErrorHelpers({});
  expect(helpers).toEqual({});
});

test("createErrorHelpers with undefined schema", () => {
  const errorMap = {
    VALID: { type: "VALID" as const },
    INVALID: undefined,
  };

  const helpers = createErrorHelpers(errorMap);
  expect(helpers.VALID).toBeDefined();
  expect(helpers.INVALID).toBeUndefined();
});
