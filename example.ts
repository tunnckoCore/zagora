import { z, za, zagora } from './src/index.ts';

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

console.log(await getPrices('normal')); // OK — second arg omitted (default applied at runtime)
console.log(await getPrices('normal', 222)); // OK

// @ts-ignore IT MUST FAIL!
console.log(await getPrices('normal', 'sasa')); // err in IDE / compile-time
