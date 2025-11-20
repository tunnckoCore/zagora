import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { AnySchema, ZagoraResult } from "../src/types.ts";

export function handleTupleDefaults(
  schema: StandardSchemaV1,
  rawArgs: unknown[],
): unknown[] {
  // Check if this might be a tuple schema by examining the schema structure
  const schemaAny = schema as any;
  const isZodTuple = schemaAny._def && schemaAny._def.type === "tuple";
  const isValibotTuple = schemaAny.type === "tuple" && !isZodTuple;

  // Try to detect if this is a StandardSchema tuple schema
  if (isZodTuple || isValibotTuple) {
    const tupleItems = schemaAny?._def?.items || schemaAny.items;

    if (tupleItems && Array.isArray(tupleItems)) {
      const result = [...rawArgs];

      // Fill in defaults for missing elements
      for (let i = rawArgs.length; i < tupleItems.length; i++) {
        const itemSchema = tupleItems[i];

        if (itemSchema && itemSchema.type === "default" && itemSchema._def) {
          const defaultValue =
            typeof itemSchema._def.defaultValue === "function"
              ? itemSchema._def.defaultValue()
              : itemSchema._def.defaultValue;

          result[i] = defaultValue;
        } else if (
          itemSchema &&
          isValibotTuple &&
          itemSchema.type === "optional"
        ) {
          result[i] = itemSchema.default;
        }
      }

      return result;
    }
  }

  return rawArgs;
}

export function createResult<
  TOutputSchema extends AnySchema | undefined = undefined,
  TErrors extends Record<string, StandardSchemaV1> | undefined = undefined,
>(
  data: any,
  error: any,
  isDefined: boolean,
): ZagoraResult<TOutputSchema, TErrors> {
  const res = [data, error, isDefined] as unknown as ZagoraResult<
    TOutputSchema,
    TErrors
  >;

  res.data = data;
  res.error = error;
  res.isDefined = isDefined;

  return res;
}
