# zagora

A minimalist & robust way to create type-safe and error-safe never throwing functions & libraries in TypeScript - with input/output validation and typed errors. Schema can be any StandardSchema-compliant validation library. No batteries, no routers, it's just functions that you can export and use. Simple, but robust, alternative to oRPC and tRPC, no network layer.

## Install

```bash
npm i zagora
```

## Import

This is ESM-only package with built-in types.

```ts
import { zagora } from 'zagora';
```

The `zagora(config?: { errorsFirst: boolean })` returns a fresh builder instance. By default the errors are place as the very last argument passed to the handler function. Make sure to always add that argument when you use `.errors`, otherwise you may get a type error - that's expected behavior. If you don't want to use the `errors` argument, just rename it to `_errors`.

## Why zagora?

- **Minimal:** tiny surface, powered by StandardSchema
- **Error-safety:** handler never throws to caller — you always get `[data | null, error | null]`.
- **Never throw:** your functions will never throw or crash your process
- **Type-safety:** full inference for handler params and results (including Zod transforms).
- **Ergonomics:** it's just pure functions, fluent builder API, default filling, optional trailing args, per-argument
  diagnostics.
- **Lightweight** alternative to remote-RPC frameworks (oRPC/tRPC) when you just want typed,
  validated functions without network glue.

## Quick example

```ts
import z from 'zod';
// import * as v from 'valibot';
import { zagora } from 'zagora';

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

// Tuple acts as schema for multiple function arguments
const InputSchema = z.tuple([z.string(), z.number().default(123)]);

const getPrices = zagora() // or `za`
  .input(InputSchema)
  .output(SuccessSchema)
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

const [data, err, isDefined] = await getPrices('normal');
// or object pattern
// const { data, error, isDefined } = await getPrices('normal');

// OK — second arg omitted (default applied at runtime)
console.log(await getPrices('normal'));
console.log(await getPrices('normal', 222)); // OK

// err in IDE / compile-time
console.log(await getPrices('normal', 'sasa'));
```

Tuple-return style, or object-return style.

- Handler may return `[data, err]` to short-circuit success/error, or throw — builder:
  - catches throws and returns `[null, error]`
  - validates returned data/error against provided schemas

## Typed errors

The typed errors are accessible via the handler arguments (it's always the last argument). Optionally, you can provide `errorsFirst: true` option to the `zagora` call to change that and the typed error helpers will always be the first argument.

All while everything is fully typed, and the inference and intellisense is working without needing to explicitly declare types.

```ts
import z from 'zod';
// import * as v from 'valibot';
import { zagora } from 'zagora';

const uppercaseString = zagora()
	.input(z.string())
	.output(z.object({
		uppercased: z.string(),
	}))
	.errors({
  	network: z.object({
  		type: z.literal("NETWORK_ERROR"),
  		message: z.string(),
  		statusCode: z.number().int().min(400).max(599),
  		retryAfter: z.number().optional(),
  	}),
  	validation: z.object({
  		type: z.literal("VALIDATION_ERROR"),
  		message: z.string(),
  		field: z.string(),
  		value: z.unknown(),
  	}),
	})
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
				field: "foo",
				value: `some input: ${input}`,
			});
		}
		return {
		  uppercased: input.toUpperCase(),
		}
	});

const [data, error, isDefined] = uppercaseString('hello world');

if (error && isDefined) {
  if (error.type === 'NETWORK_ERROR') {
    console.log('Net err:', error.message);
    console.log('Net err:', error.retryAfter);
    console.log('Net err:', error.statuscode);
  }
  if (error.type === 'VALIDATION_ERROR') {
    console.log('Validation err:', error.message);
    console.log('Validation err:', error.field); // "foo"
    console.log('Validation err:', error.value); // "some input: hello world"
  }
} else {
  console.log('Result:', data);
  console.log('With intellisense:', data.uppercased);
}
```

## API summary

- `zagora()`: create new builder
  - `.input(z.tuple([...schemas]))` - input schemas for validation
  - `.output(zodSchema)` - output schema for validation
  - `.errors(schema)` - typed errors, accessible via the handler arguments (it's always the last argument)
  - `.handler(fn) -> returns safeFn`
    - `safeFn(...args)` -> `Promise<[data|null, err|null, boolean]>`
  - `.handlerSync(fn) -> returns safeSyncFn`
    - `safeSyncFn(...args)` -> `[data|null, err|null, boolean]`

## Why this over oRPC / tRPC (in some cases)

- **No runtime transport:** zagora is for local, in-process functions where you want:
  - validated inputs and outputs
  - type-safe handler parameters (inferred from schemas)
  - consistent error handling without try/catch at call-site
- **Lightweight:** drop-in for libs, internal APIs, CLIs, workers — no network boilerplate.
- **No routers:** zagora does not enforce notion of routing, it returns just safe and typed functions
- **Interop:** you can still build RPC layers on top (zagora enforces types & validation, leaving
  transport separate).

## Why this over plain TypeScript functions

- Plain TS offers compile-time types but no runtime validation — a mismatch between runtime and
  compile-time can blow up.
- zagora combines runtime validation/transforms (StandardSchema) + compile-time inference, and returns a safe,
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
