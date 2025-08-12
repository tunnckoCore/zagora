# zagora

Small, focused, Zod-first builder for zero-throw, full-inference functions. Just 214 lines of
TypeScript madness that give you runtime validation + rock-solid types + error-safety for your
functions.

## Install

```bash
npm i zagora
```

## Import

This is ESM-only package with built-in types.

```ts
import { z, za, zagora } from 'zagora';
```

- `z` is re-exported Zod
- `zagora()` returns a fresh builder instance
- `za` is a ready-made builder instance you can reuse

## Why zagora?

- **Minimal:** tiny surface, powered by Zod only.
- **Error-safety:** handler never throws to caller — you always get [data | null, error | null].
- **Type-safety:** full inference for handler params and results (including Zod transforms).
- **Ergonomics:** fluent builder API, default filling, optional trailing args, per-argument
  diagnostics.
- **Lightweight** alternative to remote-RPC frameworks (oRPC/tRPC) when you just want typed,
  validated functions without network glue.

## Quick example

```ts
import { z, za, zagora } from 'zagora';

const NumberSchema = z.string().transform(Number).pipe(z.number().int().gte(0));

const SuccessSchema = z.object({
  block_number: NumberSchema,
  base_fee: NumberSchema,
  next_fee: NumberSchema,
  eth_price: z.string().transform(Number).pipe(z.number().gte(0)),
  gas_price: z.string().transform(Number).pipe(z.number().gte(0)),
  gas_fee: NumberSchema,
  priority_fee: NumberSchema,
});

const ErrorSchema = z.instanceof(Error);

const inputTuple = z.tuple([z.string(), z.number().default(123)]);

const getPrices = zagora() // or `za`
  .input(inputTuple)
  .output(SuccessSchema)
  .errors(ErrorSchema)
  .handler(async (speed, num) => {
    // speed is string, num is number (inferred)
    const resp = await fetch(`https://www.ethgastracker.com/api/gas/latest`);
    if (!resp.ok) throw new Error('Failed to fetch gas prices');
    const { data }: any = await resp.json();

    speed; // is string
    num; // is number 123

    console.log({ num }); // num is typed number and will be 123 if omitted
    return {
      block_number: String(data.blockNr),
      base_fee: String(data.baseFee),
      next_fee: String(data.nextFee),
      eth_price: String(data.ethPrice),
      gas_price: String(data.oracle[speed].gwei),
      gas_fee: String(data.oracle[speed].gasFee),
      priority_fee: String(data.oracle[speed].priorityFee),
    };
  });

const [data, err] = await getPrices('normal');

// OK — second arg omitted (default applied at runtime)
console.log(await getPrices('normal'));
console.log(await getPrices('normal', 222)); // OK

// err in IDE / compile-time
console.log(await getPrices('normal', 'sasa'));
```

Tuple-return style

- Handler may return [data, err] to short-circuit success/error, or throw — builder:
  - catches throws and returns [null, error]
  - validates returned data/error against provided schemas

Errors map (typed error unions)

```ts
const E1 = z.object({ code: z.literal('E1'), msg: z.string() });
const E2 = z.object({ code: z.literal('E2'), reason: z.string() });

const safe2 = zagora()
  .input(z.tuple([z.string()]))
  .output(SuccessSchema)
  .errorsMap({ E1, E2 })
  .handler(async (name) => {
    if (name === 'a') return [null, { code: 'E1', msg: 'aha' }];
    return { block_number: '1', base_fee: '100' };
  });

const [d, er] = await safe2('a');
// er is typed as { code: "E1"; msg: string } | { code: "E2"; reason: string } | Error
```

## API summary

- `zagora()`: create new builder
  - `.input(z.tuple([...schemas]))` — prefer z.tuple for best inference
  - `.output(zodSchema)`
  - `.errors(schema)` or `.errorsMap({ name: schema })`
  - `.handler(fn) -> returns safeFn`
    - `safeFn(...args)` -> `Promise<[data|null, err|null]>`

## Why this over oRPC / tRPC (in some cases)

- **No runtime transport:** zagora is for local, in-process functions where you want:
  - validated inputs and outputs
  - type-safe handler parameters (inferred from schemas)
  - consistent error handling without try/catch at call-site
- **Lightweight:** drop-in for libs, internal APIs, CLIs, workers — no network boilerplate.
- **Interop:** you can still build RPC layers on top (zagora enforces types & validation, leaving
  transport separate).

## Why this over plain TypeScript functions

- Plain TS offers compile-time types but no runtime validation — a mismatch between runtime and
  compile-time can blow up.
- zagora combines runtime validation/transforms (Zod) + compile-time inference, and returns a safe,
  uniform result tuple.

## Why this over raw Zod usage alone

- zagora gives a small ergonomic layer
- fluent builder
- supports omitted trailing args via zod defaults
- handler gets fully populated args (defaults applied) at runtime
- single place to validate outputs/errors
- unified non-throwing result shape

## Notes & tips

- Use z.tuple([...]) for input schemas to get the most accurate editor inference.
- Handler param inference is contextual — prefer to omit explicit param types and let TS infer from
  schemas.
- The builder purposely always returns tuple-style [data|null, error|null] so call-sites never need
  try/catch.
- For small apps this could replace heavy RPC infra; for distributed systems you can still use
  zagora for typed validation on both client and server.

## License

Released under the Apache-2.0 License.
