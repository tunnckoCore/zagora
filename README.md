# zagora

A minimalist & robust way to create type-safe and error-safe never throwing functions & libraries in TypeScript - with input/output validation and typed errors. Schema can be any StandardSchema-compliant validation library. No batteries, no routers, it's just functions that you can export and use. Simple, but robust, alternative to oRPC and tRPC, no network layer.

## Install

```bash
npm i zagora
```

## Usage

This is ESM-only package with built-in types.

```ts
import { zagora } from 'zagora';
```

The `zagora()` returns a fresh builder instance. By default the errors are place as the very last argument passed to the handler function.

### API summary

- `zagora()`: create new builder
  - `.input(inputSchema)` - input schemas for validation
  - `.output(outputSchema )` - output schema for validation
  - `.errors(Record<string,schema>)` - typed errors, accessible via the handler arguments (it's always the last argument)
  - `.handler(fn) -> returns safeFn`
    - `safeFn(...args)` -> `Promise<[data|null, err|null, boolean]>`


## Why zagora?

- **Minimal:** tiny surface, powered by StandardSchema (Zod, Valibot, Arktype)
- **Error-safety:** handlers never throw, you always get `[data, error, isDefined]` or `{ data, error, isDefined }`
- **Never throw:** your functions will never throw or crash your process, similar to `effect.ts` and `neverthrow`
- **Type-safety:** full inference for handler params and results (including Zod transforms).
- **Ergonomics:** it's just pure functions, fluent builder API, default filling, optional trailing args, per-argument diagnostics.
- **Lightweight** alternative to remote-RPC frameworks (oRPC/tRPC) when you just want typed,
  validated functions without network glue.

While `orpc` is great and you can use it for direct function calls (and not network requests with `createRouterClient`), and for example for building "type-safe SDK"s, it does have a few opinions that may get in the way. I use it extensively in my projects, but `zagora` is smaller and even more focused approach - i always wanted "just functions" where you define input, outputs, and you get error-safe, typed function back not a wrapper around it.

Both `tRPC` and `oRPC` are promoted as "backend", or specifically for when you're building "apps". Recently, all major frameworks also introduced similar concepts, like "server actions" and so on. All that is cool, but `zagora` is focused on building just functions, a low-level library for building other libraries - I have a lot of them, so i need a simple way for building type-safe and error-safe functions, where i don't necessarily need network layer and i don't need "routers" concept, and etc.

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

const getPrices = zagora()
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
- catches throws and returns `[null, error]`
- validates returned data/error against provided schemas

## Typed errors

The typed errors are accessible via the handler arguments (it's always the last argument).

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
			throw err.network({
				message: "Network failed",
				statusCode: 500,
			});
		}
		if (input === "validation") {
			throw err.validation({
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

## Why this over oRPC / tRPC (in some cases)

- **No runtime transport:** zagora is for local, in-process functions when you want:
  - validated inputs and outputs
  - type-safe handler parameters (inferred from schemas)
  - consistent error handling without try/catch at call-site
- **Lightweight:** for libs, internal APIs, CLIs, workers — no network boilerplate.
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
  `zagora` for typed validation on both client and server.

## License

Released under the Apache-2.0 License.
