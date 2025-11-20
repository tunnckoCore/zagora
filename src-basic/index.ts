import type { StandardSchemaV1 } from "@standard-schema/spec";

type InferInput<T> = T extends StandardSchemaV1<infer I, any> ? I : never;
type InferOutput<T> = T extends StandardSchemaV1<infer _, infer O> ? O : never;
type ZagoraFunction<Input, R> = Input extends [any, ...any[]]
  ? (...args: Input) => R
  : (arg: Input) => R;
type HandlerType<Schema, R> = ZagoraFunction<InferOutput<Schema>, R>;

function handleTupleDefaults(
  schema: StandardSchemaV1,
  rawArgs: unknown[],
): unknown[] {
  // Check if this might be a tuple schema by examining the schema structure
  const schemaAny = schema as any;
  const isZodTuple = schemaAny._def && schemaAny._def.type === "tuple";
  const isValibotTuple = schemaAny.type === "tuple" && !isZodTuple;
  // console.log("is tuple when valibot tuple", schemaAny);

  // Try to detect if this is a StandardSchema tuple schema
  if (isZodTuple || isValibotTuple) {
    const tupleItems = schemaAny?._def?.items || schemaAny.items;

    if (tupleItems && Array.isArray(tupleItems)) {
      const result = [...rawArgs];

      // Fill in defaults for missing elements
      for (let i = rawArgs.length; i < tupleItems.length; i++) {
        const itemSchema = tupleItems[i];

        if (itemSchema && itemSchema.type === "default" && itemSchema._def) {
          // console.log("only zod>>");
          const defaultValue =
            typeof itemSchema._def.defaultValue === "function"
              ? itemSchema._def.defaultValue()
              : itemSchema._def.defaultValue;

          result[i] = defaultValue;
          // console.log("only zod", i, defaultValue);
        } else if (
          itemSchema &&
          isValibotTuple &&
          itemSchema.type === "optional"
        ) {
          // console.log("only valibot");

          result[i] = itemSchema.default;
        }
      }

      // console.log("handle tuples...", result);
      return result;
    }
  }

  return rawArgs;
}

export class Zagora<
  Schema extends StandardSchemaV1<any, any>,
  Input = InferInput<Schema>,
> {
  constructor(private schema: Schema) {}

  handler<R>(fn: HandlerType<Schema, R>): ZagoraFunction<Input, R> {
    const schemaAny = this.schema as any;
    const isTuple =
      (schemaAny._def && schemaAny._def.type === "tuple") ||
      schemaAny.type === "tuple";
    let resultFn: ZagoraFunction<Input, R>;
    if (isTuple) {
      resultFn = ((...args: any[]) => {
        const processedArgs = handleTupleDefaults(this.schema, args);
        const result = (this.schema as any).safeParse(processedArgs);
        if (result.success) {
          return (fn as (...args: any[]) => R).apply(
            null,
            result.data as any[],
          );
        } else {
          throw new Error(
            result.error.issues.map((i: any) => i.message).join(", "),
          );
        }
      }) as ZagoraFunction<Input, R>;
    } else {
      resultFn = ((arg: any) => {
        const result = (this.schema as any).safeParse(arg);
        if (result.success) {
          return fn(result.data);
        } else {
          throw new Error(
            result.error.issues.map((i: any) => i.message).join(", "),
          );
        }
      }) as ZagoraFunction<Input, R>;
    }
    return resultFn;
  }
}

export function zagora() {
  return {
    input<Schema extends StandardSchemaV1<any, any>>(schema: Schema) {
      return new Zagora<Schema, InferInput<Schema>>(schema);
    },
  };
}
