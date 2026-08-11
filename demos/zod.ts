// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";
import { zagora } from "../src/index.ts";

// Define input/output schemas
const SpeedSchema = z.enum(["slow", "normal", "fast"]);
const NumberSchema = z.string().transform(Number).pipe(z.number().int().gte(0));

const InputSchema = z.object({
  speed: SpeedSchema,
  num: z.number().default(123),
  includeDetails: z.boolean().default(false),
});

const SuccessSchema = z.object({
  block_number: NumberSchema,
  base_fee: NumberSchema,
  next_fee: NumberSchema,
  eth_price: z.string().transform(Number).pipe(z.number().gte(0)),
  gas_price: z.string().transform(Number).pipe(z.number().gte(0)),
  gas_fee: NumberSchema,
  priority_fee: NumberSchema,
});

const errorSchemas = {
  NET_ERR: z.object({
    code: z.number(),
    message: z.string(),
    url: z.string().optional(),
  }),
  AUTH_ERR: z.object({
    userId: z.string(),
    url: z.url().optional(),
  }),
  RATE_LIMIT: z.object({
    retryAfter: z.number(),
    limit: z.number(),
    message: z.string(),
  }),
};

// "contract" means just access to the Zagora instance
const getPricesContract = zagora({ autoCallable: true })
  .errors(errorSchemas)
  .input(InputSchema)
  .output(SuccessSchema);

// on "~zagora" property you can access the metadata like input/output/error schemas,
// and the handler function if it's after the `.handler` call.
// getPricesContract["~zagora"].inputSchema;

const getPrices = getPricesContract.handler(
  async ({ errors: err }, { speed, num, includeDetails }) => {
    // Simulate rate limiting
    if (num && num > 1000) {
      throw err.RATE_LIMIT({
        retryAfter: 60,
        limit: 1000,
        message: "Rate limit exceeded, try again in 60 seconds",
      });
    }

    // Simulate validation error
    if (speed === "slow" && includeDetails) {
      throw err.AUTH_ERR({
        userId: "user123",
        url: "https://www.ethgastracker.com/api/gas/latest",
      });
    }

    try {
      const resp = await fetch("https://www.ethgastracker.com/api/gas/latest");

      if (!resp.ok) {
        throw err.NET_ERR({
          code: resp.status,
          message: `HTTP ${resp.status}: ${resp.statusText}`,
          url: resp.url,
        });
      }

      const { data }: any = await resp.json();

      // Success case - return the data
      return {
        block_number: String(data.blockNr),
        base_fee: String(data.baseFee),
        next_fee: String(data.nextFee),
        eth_price: String(data.ethPrice),
        gas_price: String(data.oracle[speed].gwei),
        gas_fee: String(data.oracle[speed].gasFee),
        priority_fee: String(data.oracle[speed].priorityFee),
      };
    } catch (error) {
      // This will be automatically wrapped in ZagoraError since we didn't handle it with our typed errors
      throw new Error(`Failed to fetch gas prices: ${error}`);
    }
  },
);

// here the `handlerFn` has properly-inferred input and output types
// const handlerFn = getPrices['~zagora'].handlerFn;
// type HandlerReturnType = Awaited<ReturnType<typeof handlerFn>>;

// Test 1: Success case
console.log("1. Success case:");
const prices = await getPrices({
  speed: "normal",
  num: 50,
  includeDetails: false,
});
console.log("Result:", prices ? "Got gas prices data" : null);
console.log("Error:", prices.error);
console.log();

if (prices.error && prices.error.kind === "NET_ERR") {
  console.log("Network error occurred with code:", prices.error.code);
  console.log("Error url:", prices.error.url);
}

// Test 2: Rate limit error
console.log("2. Rate limit error:");
const pricesLimited = await getPrices({
  speed: "fast",
  num: 1500,
});
console.log("Result:", pricesLimited.ok ? pricesLimited.data : null);
console.log("Error:", pricesLimited.error);
console.log("Error kind:", pricesLimited.error?.kind);
console.log();

// Test 3: Validation error
console.log("3. Auth error:");
const pricesErroring = await getPrices({
  speed: "slow",
  includeDetails: true,
});
console.log("Result:", pricesErroring.ok ? pricesErroring.data : null);
console.log("Error:", pricesErroring.error);
console.log("Error kind:", pricesErroring.error?.kind);
console.log();

// == EXAMPLE FETCH WRAPPER

export const zagoraFetch = zagora()
  .input(
    z.tuple([
      z.string(),
      z
        .object({
          method: z.enum(["GET", "POST", "PUT", "DELETE"]),
          headers: z.record(z.string(), z.string()).optional(),
          body: z.any().optional(),
        })
        .default({
          method: "GET",
        }),
    ]),
  )
  .output(
    z
      .object({
        userId: z.number().min(1),
        id: z.number().min(1),
        title: z.string().min(1),
        completed: z.boolean(),
      })
      .strict(),
  )
  .errors({
    FETCH_ERROR: z.object({
      msg: z.string().default("Unknown error"),
      code: z.number().default(500),
    }),
  })
  .handler(async ({ errors }, url, reqInit) => {
    const resp = await fetch(url, reqInit);

    if (!resp.ok) {
      throw errors.FETCH_ERROR({
        msg: `HTTP error ${resp.status}: ${resp.statusText}`,
        code: resp.status,
      });
    }

    const data = (await resp.json()) as any;

    // return { ...data, foo: 123 }; // should fail output validation
    return data;
  })
  .callable();

const zagoraFetched = await zagoraFetch(
  "https://jsonplaceholder.typicode.com/todos/1",
);

console.log({
  zagoraFetched,
});
