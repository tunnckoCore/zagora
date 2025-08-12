// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

/* result tuple */
type TupleResult<TData, TErr> = [TData | null, TErr | Error | null];

// convert union -> intersection helper
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

// Given `T` a tuple type, produce an intersection of function
// types that act as overloads for each prefix of T.
type OverloadedByPrefixes<T extends any[], R> = UnionToIntersection<
  // @ts-expect-error bruh... `...args: P` fails but.. just be quiet
  ValuePrefixes<T> extends infer P ? (P extends any ? (...args: P) => R : never) : never
>;

/* prefixes of a value-tuple (mutable) */
type ValuePrefixes<T extends any[]> = T extends [infer H, ...infer R]
  ? [] | [H, ...ValuePrefixes<R>]
  : [];

/* Infer arg tuple from a z.ZodTuple */
type InferArgsFromTuple<T extends z.ZodTuple<any, any>> = z.infer<T>;

export function zagora() {
  return new FluentBuilder();
}

export const za = zagora();

export { z };

export class FluentBuilder<
  InputTuple extends z.ZodTuple<any, any> | null = null,
  Output extends z.ZodTypeAny | null = null,
  ErrSchema extends z.ZodTypeAny | Record<string, z.ZodTypeAny> | null = null,
> {
  private _inputTuple: InputTuple | null = null;
  private _output: Output | null = null;
  private _err: ErrSchema | null = null;

  // REQUIRED: caller provides a z.tuple(...) here
  input<Tuple extends z.ZodTuple<any, any>>(tuple: Tuple) {
    const next = new FluentBuilder<Tuple, Output, ErrSchema>();
    (next as any)._inputTuple = tuple as Tuple;
    (next as any)._output = this._output;
    (next as any)._err = this._err;
    return next;
  }

  output<NewOut extends z.ZodTypeAny>(schema: NewOut) {
    const next = new FluentBuilder<InputTuple, NewOut, ErrSchema>();
    (next as any)._inputTuple = this._inputTuple;
    (next as any)._output = schema;
    (next as any)._err = this._err;
    return next;
  }

  errors<NewErr extends z.ZodTypeAny>(schema: NewErr) {
    const next = new FluentBuilder<InputTuple, Output, NewErr>();
    (next as any)._inputTuple = this._inputTuple;
    (next as any)._output = this._output;
    (next as any)._err = schema;
    return next;
  }

  errorsMap<NewMap extends Record<string, z.ZodTypeAny>>(map: NewMap) {
    const next = new FluentBuilder<InputTuple, Output, NewMap>();
    (next as any)._inputTuple = this._inputTuple;
    (next as any)._output = this._output;
    (next as any)._err = map;
    return next;
  }

  handler<
    IT extends z.ZodTuple<any, any> = InputTuple extends z.ZodTuple<any, any> ? InputTuple : never,
    Args extends any[] = InferArgsFromTuple<IT>,
    H extends (...args: Args) => any = (...args: Args) => any,
  >(impl: H) {
    if (!this._inputTuple) throw new Error('.input(z.tuple(...)) must be called first');
    if (!this._output) throw new Error('.output(...) must be called first');

    const tuple = this._inputTuple as z.ZodTuple<any, any>;
    const items: z.ZodTypeAny[] = ((tuple as any)?._def?.items ??
      (tuple as any)?._def?.tuple ??
      []) as z.ZodTypeAny[];

    const outputSchema = this._output as z.ZodTypeAny;
    const errSchema = this._err as z.ZodTypeAny | Record<string, z.ZodTypeAny> | null;

    const isOmittable = (s: z.ZodTypeAny) => {
      const tn = (s as any)?._def?.typeName;
      return tn === 'ZodOptional' || tn === 'ZodDefault';
    };

    // compute minimum required prefix length
    let minRequired = 0;
    for (let i = items.length - 1; i >= 0; --i) {
      if (!isOmittable(items[i])) {
        minRequired = i + 1;
        break;
      }
    }

    // build prefix parsers for allowed call shapes
    const tupleParsers: z.ZodTuple<any, any>[] = [];
    for (let k = minRequired; k <= items.length; ++k) {
      const prefix = items.slice(0, k) as any;
      tupleParsers.push(z.tuple(prefix));
    }
    const inputParser = tupleParsers.length === 1 ? tupleParsers[0] : z.union(tupleParsers as any);
    const runtimeErrSchema =
      errSchema && !(errSchema instanceof Object && !('parse' in errSchema))
        ? (errSchema as z.ZodTypeAny)
        : undefined;

    // runtime wrapper: validate provided args (prefix), fill defaults, call impl
    const wrapper = async (...rawArgs: unknown[]) => {
      const parsed = inputParser.safeParse(rawArgs as unknown);
      if (!parsed.success) return [null, parsed.error as unknown as Error] as const;

      const provided = parsed.data as unknown[];
      const finalArgs: unknown[] = [...provided];
      for (let i = provided.length; i < items.length; ++i) {
        const p = items[i].safeParse(undefined);
        if (!p.success) return [null, p.error as unknown as Error] as const;
        finalArgs.push(p.data);
      }

      try {
        const rawResult = await (impl as any)(...finalArgs);

        if (Array.isArray(rawResult) && rawResult.length === 2) {
          const [maybeOut, maybeErr] = rawResult as [unknown, unknown];

          if (maybeErr != null) {
            // errors map
            if (errSchema && typeof errSchema === 'object' && !('parse' in errSchema)) {
              for (const k of Object.keys(errSchema)) {
                const s = (errSchema as Record<string, z.ZodTypeAny>)[k];
                const r = s.safeParse(maybeErr);
                if (r.success) return [null, r.data] as const;
              }
              return [
                null,
                maybeErr instanceof Error ? maybeErr : new Error(String(maybeErr ?? 'unknown')),
              ] as const;
            }

            // single error schema
            if (runtimeErrSchema) {
              const r = await runtimeErrSchema.safeParseAsync(maybeErr);
              if (!r.success) return [null, r.error as unknown as Error] as const;
              return [null, r.data] as const;
            }

            return [
              null,
              maybeErr instanceof Error ? maybeErr : new Error(String(maybeErr ?? 'unknown')),
            ] as const;
          }

          const po = await outputSchema.safeParseAsync(maybeOut);
          if (!po.success) return [null, po.error as unknown as Error] as const;
          return [po.data, null] as const;
        }

        const po = await outputSchema.safeParseAsync(rawResult);
        if (!po.success) return [null, po.error as unknown as Error] as const;
        return [po.data, null] as const;
      } catch (err: unknown) {
        if (errSchema && typeof errSchema === 'object' && !('parse' in errSchema)) {
          for (const k of Object.keys(errSchema)) {
            const s = (errSchema as Record<string, z.ZodTypeAny>)[k];
            const r = s.safeParse(err);
            if (r.success) return [null, r.data] as const;
          }
          return [null, err instanceof Error ? err : new Error(String(err ?? 'unknown'))] as const;
        }
        if (runtimeErrSchema) {
          const r = await runtimeErrSchema.safeParseAsync(err);
          if (!r.success) return [null, r.error as unknown as Error] as const;
          return [null, r.data] as const;
        }
        return [null, err instanceof Error ? err : new Error(String(err ?? 'unknown'))] as const;
      }
    };

    // Handler return/result type
    type HandlerResult = Promise<
      TupleResult<
        Output extends z.ZodTypeAny ? z.infer<Output> : unknown,
        ErrSchema extends z.ZodTypeAny
          ? z.infer<ErrSchema>
          : ErrSchema extends Record<string, z.ZodTypeAny>
            ? { [K in keyof ErrSchema]: z.infer<ErrSchema[K]> }[keyof ErrSchema]
            : Error | unknown
      >
    >;

    type ForwardType = OverloadedByPrefixes<Args, HandlerResult>;

    const forwardImpl = (...args: any[]) => wrapper(...(args as unknown[]));
    const forward = forwardImpl as unknown as ForwardType;

    return forward;
  }
}
