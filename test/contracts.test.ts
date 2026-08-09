// SPDX-License-Identifier: Apache-2.0

import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as v from "valibot";
import { expect, test } from "vitest";
import z from "zod";
import { createErrorHelpers } from "../src/errors";
import { zagora } from "../src/index";
import { createResult } from "../src/utils";

type Schema<I, O = I> = StandardSchemaV1<I, O>;

function schema<I, O>(
  validate: StandardSchemaV1.Props<I, O>["validate"],
): Schema<I, O> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate,
    },
  };
}

function asyncSchema<I, O>(
  validate: StandardSchemaV1.Props<I, O>["validate"],
): Schema<I, O> & { readonly async: true } {
  return { ...schema(validate), async: true };
}

function expectInternalError(result: any, cause: unknown) {
  expect(result).toMatchObject({
    ok: false,
    isTypedError: false,
    error: {
      kind: "UNKNOWN_ERROR",
      cause,
    },
  });
}

test("schema implementation failures become internal results", async () => {
  const inputCause = new Error("input exploded");
  let handlerCalls = 0;
  const inputProcedure = zagora()
    .input(
      schema<string, string>(() => {
        throw inputCause;
      }),
    )
    .handler((_, input) => {
      handlerCalls += 1;
      return input;
    })
    .callable();

  const inputResult = inputProcedure("input");
  expectInternalError(inputResult, inputCause);
  expect(handlerCalls).toBe(0);

  const outputCause = new Error("output exploded");
  const outputProcedure = zagora()
    .input(z.string())
    .output(asyncSchema<string, string>(() => Promise.reject(outputCause)))
    .handler((_, input) => input)
    .callable();

  expectInternalError(await outputProcedure("output"), outputCause);

  const envCause = new Error("env exploded");
  const envProcedure = zagora()
    .env(
      schema<Record<string, string>, Record<string, string>>(() => {
        throw envCause;
      }),
      {},
    )
    .handler(({ env }) => env)
    .callable();

  expectInternalError(envProcedure(), envCause);

  const syncErrorCause = new Error("error schema exploded");
  const syncErrorProcedure = zagora()
    .errors({
      FAILURE: schema<{ message: string }, { message: string }>(() => {
        throw syncErrorCause;
      }),
    })
    .handler(({ errors }) => {
      throw errors.FAILURE({ message: "failure" });
    })
    .callable();

  expectInternalError(syncErrorProcedure(), syncErrorCause);

  const asyncErrorCause = new Error("async error schema exploded");
  const asyncErrorProcedure = zagora()
    .errors({
      FAILURE: asyncSchema<{ message: string }, { message: string }>(() =>
        Promise.reject(asyncErrorCause),
      ),
    })
    .handler(({ errors }) => {
      throw errors.FAILURE({ message: "failure" });
    })
    .callable();

  expectInternalError(await asyncErrorProcedure(), asyncErrorCause);
});

test.each([
  undefined,
  null,
  false,
  0,
  "",
])("a handler throwing %j still returns a failure", (thrown) => {
  const procedure = zagora()
    .input(z.boolean())
    .handler((_, shouldThrow) => {
      if (shouldThrow) {
        throw thrown;
      }
      return "ok";
    })
    .callable();

  const result = procedure(true);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.isTypedError).toBe(false);
    expect(result.error.kind).toBe("UNKNOWN_ERROR");
    if (result.error.kind === "UNKNOWN_ERROR") {
      expect(result.error.cause).toBe(thrown);
    }
  }
});

test("context merges plain containers and preserves dependencies", () => {
  class Database {
    constructor(readonly name: string) {}

    query() {
      return this.name;
    }
  }

  interface Context {
    db: Database;
    config: { timeout?: number; retries?: number };
  }

  const production = new Database("production");
  const testDatabase = new Database("test");
  const initialContext: Context = {
    db: production,
    config: { timeout: 5, retries: 1 },
  };
  const procedure = zagora()
    .context(initialContext)
    .handler(({ context }) => ({
      db: context.db,
      name: context.db.query(),
      config: context.config,
    }))
    .callable({
      context: {
        db: testDatabase,
        config: { retries: 2 },
      },
    });

  const result = procedure();
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.data.db).toBe(testDatabase);
    expect(result.data.db).toBeInstanceOf(Database);
    expect(result.data.name).toBe("test");
    expect(result.data.config).toEqual({ timeout: 5, retries: 2 });
  }
});

test("callable context works without an initial context value", () => {
  class Database {
    query() {
      return "ok";
    }
  }

  const db = new Database();
  const procedure = zagora()
    .context<{ db: Database }>()
    .handler(({ context }) => context.db.query())
    .callable({ context: { db } });

  const result = procedure();
  expect(result).toMatchObject({ ok: true, data: "ok" });

  // @ts-expect-error context roots must be objects
  zagora().context("invalid");
});

test("error helpers only use own keys and preserve the declared kind", () => {
  const errorSchema = z.object({ message: z.string() });
  const errorMap = Object.assign(Object.create({ INHERITED: errorSchema }), {
    DECLARED: errorSchema,
  });
  const helpers = createErrorHelpers(errorMap);

  expect(Object.keys(helpers)).toEqual(["DECLARED"]);
  expect(helpers.DECLARED?.({ kind: "OTHER", message: "failure" })).toEqual({
    kind: "DECLARED",
    message: "failure",
  });
});

test("error validation cannot replace the declared kind", () => {
  const procedure = zagora()
    .errors({
      DECLARED: schema<{ message: string }, { message: string; kind: string }>(
        (value) => ({
          value: { ...(value as { message: string }), kind: "OTHER" },
        }),
      ),
    })
    .handler(({ errors }) => {
      throw errors.DECLARED({ message: "failure" });
    })
    .callable();

  expect(procedure()).toMatchObject({
    ok: false,
    isTypedError: true,
    error: { kind: "DECLARED", message: "failure" },
  });
});

test.each([
  new Error("failure"),
  undefined,
])("untyped handler throws remain unknown errors when an error map exists", (thrown) => {
  const procedure = zagora()
    .errors({ DECLARED: z.object({ message: z.string() }) })
    .handler(() => {
      throw thrown;
    })
    .callable();

  const result = procedure();
  expectInternalError(result, thrown);
});

test("success results expose the shape promised by their type", () => {
  const result = createResult("ok", null, false);
  expect(result).toEqual({ ok: true, data: "ok", error: undefined });
  expect(Object.hasOwn(result, "error")).toBe(true);
});

test("maybe-Promise handlers preserve their runtime branch", async () => {
  const procedure = zagora()
    .input(z.enum(["sync", "async"]))
    .handler((_, mode) => (mode === "async" ? Promise.resolve(mode) : mode))
    .callable();

  const syncResult = procedure("sync");
  expect(syncResult).not.toBeInstanceOf(Promise);
  expect(syncResult).toMatchObject({ ok: true, data: "sync" });

  const asyncResult = procedure("async");
  expect(asyncResult).toBeInstanceOf(Promise);
  expect(await asyncResult).toMatchObject({ ok: true, data: "async" });
});

test("async cache methods only make paths that invoke them async", async () => {
  const cache = {
    has() {
      return false;
    },
    get() {
      return undefined;
    },
    async set() {},
  };
  const procedure = zagora()
    .cache(cache)
    .input(z.string())
    .handler((_, input) => input)
    .callable();

  const invalidResult = procedure(123 as any);
  expect(invalidResult).not.toBeInstanceOf(Promise);
  if (invalidResult instanceof Promise) {
    throw new Error("Invalid input should fail before the cache is invoked");
  }
  expect(invalidResult.ok).toBe(false);

  const validResult = procedure("valid");
  expect(validResult).toBeInstanceOf(Promise);
  expect((await validResult).ok).toBe(true);
});

test("an async error-map entry makes every runtime path async", async () => {
  const procedure = zagora()
    .input(v.string())
    .errors({
      SYNC_ERROR: v.object({ message: v.string() }),
      ASYNC_ERROR: v.pipeAsync(
        v.object({ message: v.string() }),
        v.checkAsync(async () => true),
      ),
    })
    .handler(({ errors }, input) => {
      if (input === "sync-error") {
        throw errors.SYNC_ERROR({ message: input });
      }
      if (input === "async-error") {
        throw errors.ASYNC_ERROR({ message: input });
      }
      return input;
    })
    .callable();

  const invalidResult = procedure(123 as any);
  const successResult = procedure("success");
  const syncErrorResult = procedure("sync-error");
  const asyncErrorResult = procedure("async-error");

  for (const result of [
    invalidResult,
    successResult,
    syncErrorResult,
    asyncErrorResult,
  ]) {
    expect(result).toBeInstanceOf(Promise);
  }

  expect(await invalidResult).toMatchObject({
    ok: false,
    isTypedError: false,
    error: { kind: "VALIDATION_ERROR" },
  });
  expect(await successResult).toMatchObject({ ok: true, data: "success" });
  expect(await syncErrorResult).toMatchObject({
    ok: false,
    isTypedError: true,
    error: { kind: "SYNC_ERROR", message: "sync-error" },
  });
  expect(await asyncErrorResult).toMatchObject({
    ok: false,
    isTypedError: true,
    error: { kind: "ASYNC_ERROR", message: "async-error" },
  });
});
