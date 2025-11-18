import { z } from "zod";
import { zagora } from "./index";

// Test 1: Simple tuple with required elements - should work
const simple = zagora()
  .input(z.tuple([z.string(), z.number()]))
  .output(z.string())
  .handler((name, id) => {
    return `${name}-${id}`;
  });

simple("test", 123);
// @ts-expect-error - that's fine
simple("test", "foo bar"); // properly report type error at arg level
simple("test"); // it does not report error... incorrectly

// Test 2: Tuple with .optional() - this fails
const withOptional = zagora()
  .input(z.tuple([z.string(), z.number().optional()]))
  .output(z.string())
  .handler((name, id) => {
    return `${name}-${id}`;
  });

withOptional("test"); // incorrectly report error
withOptional("test", 123); // incorrect type error
withOptional("test", "foo bar"); // should report type error at the arg level

// Test 3: Tuple with .default() - this fails
const withDefault = zagora()
  .input(z.tuple([z.string(), z.number().default(123)]))
  .output(z.string())
  .handler((name, id) => {
    // `id` must be type as `number` only,
    // but is incorrectly typed as `number | undefined`
    return `${name}-${id}`;
  });

withDefault("test"); // incorrectly report error
withDefault("test", 456); // incorrect type error
withDefault("test", "foo bar"); // should report type error at the arg level
