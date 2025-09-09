// SPDX-License-Identifier: Apache-2.0

import * as v from "valibot";
import z from "zod";

// Zod v4 schemas for testing
export const zodSchemas = {
  // Basic types
  string: z.string(),
  number: z.number(),
  boolean: z.boolean(),

  // Objects
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    age: z.number().int().positive(),
  }),

  // Arrays and tuples
  stringArray: z.array(z.string()),
  coordinates: z.tuple([z.number(), z.number()]),

  // New Zod v4 string formats
  email: z.email(),
  url: z.url(),
  uuid: z.uuidv4(),

  // Error schemas
  networkError: z.object({
    type: z.literal("NETWORK_ERROR"),
    message: z.string(),
    statusCode: z.number().int().min(400).max(599),
    retryAfter: z.number().optional(),
  }),

  validationError: z.object({
    type: z.literal("VALIDATION_ERROR"),
    message: z.string(),
    field: z.string(),
    value: z.unknown(),
  }),
};

// Valibot schemas for testing
export const valibotSchemas = {
  // Basic types
  string: v.string(),
  number: v.number(),
  boolean: v.boolean(),

  // Objects
  user: v.object({
    id: v.string(),
    name: v.string(),
    email: v.pipe(v.string(), v.email()),
    age: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
};

// Test data generators
export const testData = {
  validUser: {
    id: "user_123",
    name: "John Doe",
    email: "john@example.com",
    age: 30,
  },

  invalidUser: {
    id: 123, // should be string
    name: "",
    email: "not-an-email",
    age: -5,
  },

  networkError: {
    type: "NETWORK_ERROR" as const,
    message: "Connection timeout",
    statusCode: 408,
    retryAfter: 5000,
  },

  validationError: {
    type: "VALIDATION_ERROR" as const,
    message: "Invalid email format",
    field: "email",
    value: "not-an-email",
  },
};

// Error schema combinations for testing
export const errorSchemas = {
  single: {
    network: zodSchemas.networkError,
  },

  multiple: {
    network: zodSchemas.networkError,
    validation: zodSchemas.validationError,
  },
};

// Test utility functions
export const testUtils = {
  // Create async delay
  delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
};
