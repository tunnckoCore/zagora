// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "bun:test";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { ZagoraError } from "../src/index.ts";

test("should create basic error with message", () => {
  const error = new ZagoraError("Test error");

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(ZagoraError);
  expect(error.message).toBe("Test error");
  expect(error.name).toBe("ZagoraError");
  expect(error.reason).toBe("Unknown or internal error");
  expect(error.issues).toBeUndefined();
  expect(error.cause).toBeUndefined();
});

test("should create error with all options", () => {
  const issues: StandardSchemaV1.Issue[] = [
    {
      message: "Expected string",
      path: [{ key: "name" }],
    },
  ];

  const cause = new Error("Original error");
  const error = new ZagoraError("Validation failed", {
    issues,
    cause,
    reason: "Input validation error",
  });

  expect(error.message).toBe("Validation failed");
  expect(error.issues).toBe(issues);
  expect(error.cause).toBe(cause);
  expect(error.reason).toBe("Input validation error");
});

test("should create error from issues using fromIssues", () => {
  const issues: StandardSchemaV1.Issue[] = [
    {
      message: "Expected string, received number",
      path: [{ key: "email" }],
    },
    {
      message: "Invalid email format",
      path: [{ key: "email" }],
    },
  ];

  const error = ZagoraError.fromIssues(issues);

  expect(error).toBeInstanceOf(ZagoraError);
  expect(error.message).toBe(
    "Expected string, received number, Invalid email format",
  );
  expect(error.issues).toBe(issues);
  expect(error.reason).toBe("Failure caused by validation");
  expect(error.cause).toBeUndefined();
});

test("should create error from single issue using fromIssues", () => {
  const issues: StandardSchemaV1.Issue[] = [
    {
      message: "Required field missing",
      path: [{ key: "name" }],
    },
  ];

  const error = ZagoraError.fromIssues(issues);

  expect(error.message).toBe("Required field missing");
  expect(error.issues).toEqual(issues);
  expect(error.reason).toBe("Failure caused by validation");
});

test("should handle empty issues array", () => {
  const error = ZagoraError.fromIssues([]);
  expect(error.message).toBe("");
  expect(error.issues).toEqual([]);
  expect(error.reason).toBe("Failure caused by validation");
});

test("should maintain readonly properties", () => {
  const error = new ZagoraError("Test");

  // The readonly modifier is TypeScript-only, runtime assignment still works
  // but we can test that the property is initially set correctly
  expect(error.reason).toContain("known or internal");
  expect(error.name).toBe("ZagoraError");
});

test("should work with instanceof checks", () => {
  const error = new ZagoraError("Test");
  const fromIssues = ZagoraError.fromIssues([]);

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(ZagoraError);
  expect(fromIssues).toBeInstanceOf(ZagoraError);
});

test("should preserve error stack trace", () => {
  const error = new ZagoraError("Test error");
  expect(error.stack).toContain("ZagoraError");
  expect(error.stack).toContain("Test error");
});
