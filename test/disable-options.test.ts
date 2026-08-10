// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "vitest";
import z from "zod";
import { zagora } from "../src/index";

test("disableOptions: false (default) - handler receives options as first arg", async () => {
  const fn = zagora()
    .input(z.string())
    .output(z.string())
    .context({ userId: "123" })
    .handler(({ context }, input) => {
      return `${input}-${context.userId}`;
    })
    .callable();

  const res = await fn("hello");
  if (res.ok) {
    expect(res.data).toBe("hello-123");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("disableOptions: true - handler receives only input", async () => {
  const fn = zagora({ disableOptions: true })
    .input(z.string())
    .output(z.string())
    .handler((input) => {
      return input.toUpperCase();
    })
    .callable();

  const res = await fn("hello");
  if (res.ok) {
    expect(res.data).toBe("HELLO");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("disableOptions: true - handler with tuple input spreads args", async () => {
  const fn = zagora({ disableOptions: true })
    .input(z.tuple([z.number(), z.string()]))
    .output(z.string())
    .handler((num, str) => {
      return `${str}-${num}`;
    })
    .callable();

  const res = await fn(42, "answer");
  if (res.ok) {
    expect(res.data).toBe("answer-42");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("disableOptions: true - handler with no input", async () => {
  const fn = zagora({ disableOptions: true })
    .output(z.string())
    .handler(() => {
      return "no input needed";
    })
    .callable();

  const res = await fn();
  if (res.ok) {
    expect(res.data).toBe("no input needed");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("disableOptions: true - async handler receives only input", async () => {
  const fn = zagora({ disableOptions: true })
    .input(z.string())
    .output(z.string())
    .handler(async (input) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return input.toLowerCase();
    })
    .callable();

  const res = await fn("WORLD");
  if (res.ok) {
    expect(res.data).toBe("world");
  } else {
    expect(false, "Expected success").toBe(true);
  }
});

test("disableOptions: true - defined errors & context are ignored & not passed", async () => {
  const fn = zagora({ disableOptions: true })
    .input(z.string())
    .output(z.string())
    .context({ db: "postgres" })
    .errors({
      CUSTOM_ERROR: z.object({
        message: z.string(),
      }),
    })
    .handler((input) => `foo-${input}`)
    .callable();

  const success = await fn("xyz");
  if (success.ok) {
    expect(success.data).toBe("foo-xyz");
  } else {
    expect(false, "Expected success").toBe(true);
  }

  const funck = zagora({ disableOptions: true })
    .handler(() => "foobie")
    .callable();
  const res = funck();
  expect(res.ok).toBe(true);
  expect((res as any).data).toBe("foobie");
});
