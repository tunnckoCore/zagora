// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";
import { zagora } from "./src/index.ts";

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
  network: z.object({
    type: z.literal("NetworkError"),
    code: z.number(),
    message: z.string(),
    url: z.string().optional(),
  }),
  auth: z.object({
    type: z.literal("AuthError"),
    userId: z.string(),
    url: z.url().optional(),
  }),
  rateLimit: z.object({
    type: z.literal("RateLimitError"),
    retryAfter: z.number(),
    limit: z.number(),
    message: z.string(),
  }),
};

// Create zagora instance with error schemas

// Main handler example
const getPrices = zagora()
  .errors(errorSchemas)
  .input(InputSchema)
  .output(SuccessSchema)
  .handler(async ({ speed, num, includeDetails }, err) => {
    // Simulate rate limiting
    if (num && num > 1000) {
      return err.rateLimit({
        retryAfter: 60,
        limit: 1000,
        message: "Rate limit exceeded, try again in 60 seconds",
      });
    }

    // Simulate validation error
    if (speed === "slow" && includeDetails) {
      return err.auth({
        userId: "user123",
        url: "https://www.ethgastracker.com/api/gas/latest",
      });
    }

    try {
      const resp = await fetch("https://www.ethgastracker.com/api/gas/latest");

      if (!resp.ok) {
        // Return typed network error
        return err.network({
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
  });

// Test 1: Success case
console.log("1. Success case:");
const [result1, error1, isDefined1] = await getPrices({
  speed: "normal",
  num: 50,
  includeDetails: false,
});
console.log("Result:", result1 ? "Got gas prices data" : null);
console.log("Error:", error1);
console.log();

if (error1 && isDefined1 && error1.type === "NetworkError") {
  console.log("Network error occurred with code:", error1.code);
  console.log("Error url:", error1.url);
}

// Test 2: Rate limit error
console.log("2. Rate limit error:");
const [result2, error2] = await getPrices({
  speed: "fast",
  num: 1500,
});
console.log("Result:", result2);
console.log("Error:", error2);
console.log("Error type:", (error2 as any)?.type);
console.log();

// Test 3: Validation error
console.log("3. Validation error:");
const [result3, error3] = await getPrices({
  speed: "slow",
  includeDetails: true,
});
console.log("Result:", result3);
console.log("Error:", error3);
console.log("Error type:", (error3 as any)?.type);
console.log();
