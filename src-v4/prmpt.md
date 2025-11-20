we are having src-v4/zod-infer-test.ts

which is basic thing that is using only zod.

we need to convert it to use StandardSchema

1. make 3 new files 
- sscore.ts - the StandardSchema implementation
- ss-zod.ts - the zod usage examples (not real tests)
- ss-valibot.ts - the same as the zod ones but with Valibot!

2. do not touch any other files

3. use `schema['~standard'].validate` and the following helper for applying defaults cuz `.validate` does not do it

```ts

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
```


4. type check after you consider a task is done and before saying "Perfect it's working, and is ready" - cuz it's not most of the times!

5. ignore any other typescript errors from other than these 3 files!
