import { expectTypeOf, test } from "vitest";
import z from "zod";
import { zagora } from "../dist/index";

test("use `autoCallable: true` from dist - single instance multiple procedures", () => {
  const za = zagora({ autoCallable: true, disableOptions: true });

  const add = za
    .input(z.tuple([z.number(), z.number()]))
    .output(z.number())
    .handler((a, b) => {
      expectTypeOf(a).toEqualTypeOf<number>();
      expectTypeOf(b).toEqualTypeOf<number>();
      return a + b;
    });
  expectTypeOf<typeof add>().not.toEqualTypeOf<any>();

  const subtract = za
    .input(z.tuple([z.number(), z.number()]))
    .handler((a, b) => {
      expectTypeOf(a).toEqualTypeOf<number>();
      expectTypeOf(b).toEqualTypeOf<number>();
      return a - b;
    });
  expectTypeOf<typeof subtract>().not.toEqualTypeOf<any>();

  const multiply = za
    .input(z.tuple([z.number(), z.number()]))
    .handler((a, b) => {
      expectTypeOf(a).toEqualTypeOf<number>();
      expectTypeOf(b).toEqualTypeOf<number>();
      return a * b;
    });
  expectTypeOf<typeof multiply>().not.toEqualTypeOf<any>();
});
