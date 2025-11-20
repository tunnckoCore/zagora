import type { StandardSchemaV1 } from "@standard-schema/spec";

export type Schema<I, O = I> = StandardSchemaV1<I, O>;

export type AnySchema = Schema<any, any>;

export type SchemaIssue = StandardSchemaV1.Issue;

export type InferSchemaOutput<T extends AnySchema> = T extends StandardSchemaV1<
  any,
  infer UOutput
>
  ? UOutput
  : never;

export type InferSchemaInput<T extends AnySchema> = T extends StandardSchemaV1<
  infer UInput,
  any
>
  ? UInput
  : never;

// ============================================================================
// SPREADABLE TUPLE - Convert tuple type to function overloads with valid param order
// ============================================================================

type IsOptional<T> = undefined extends T ? true : false;

type SpreadTuple<T extends readonly any[], R> = T extends readonly [infer A]
  ? (arg: A) => R
  : T extends readonly [infer A, infer B]
    ? IsOptional<B> extends true
      ? ((arg1: A, arg2?: B) => R) | ((arg1: A) => R)
      : ((arg1: A, arg2: B) => R) | ((arg1: A) => R)
    : T extends readonly [infer A, infer B, infer C]
      ? IsOptional<B> extends true
        ? IsOptional<C> extends true
          ?
              | ((arg1: A, arg2?: B, arg3?: C) => R)
              | ((arg1: A, arg2?: B) => R)
              | ((arg1: A) => R)
          :
              | ((arg1: A, arg2?: B, arg3?: C) => R)
              | ((arg1: A, arg2?: B) => R)
              | ((arg1: A) => R)
        : IsOptional<C> extends true
          ?
              | ((arg1: A, arg2: B, arg3?: C) => R)
              | ((arg1: A, arg2: B) => R)
              | ((arg1: A) => R)
          :
              | ((arg1: A, arg2: B, arg3: C) => R)
              | ((arg1: A, arg2: B) => R)
              | ((arg1: A) => R)
      : T extends readonly [infer A, infer B, infer C, infer D]
        ? IsOptional<B> extends true
          ? IsOptional<C> extends true
            ? IsOptional<D> extends true
              ?
                  | ((arg1: A, arg2?: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2?: B, arg3?: C) => R)
                  | ((arg1: A, arg2?: B) => R)
                  | ((arg1: A) => R)
              :
                  | ((arg1: A, arg2?: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2?: B, arg3?: C) => R)
                  | ((arg1: A, arg2?: B) => R)
                  | ((arg1: A) => R)
            : IsOptional<D> extends true
              ?
                  | ((arg1: A, arg2?: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2?: B, arg3?: C) => R)
                  | ((arg1: A, arg2?: B) => R)
                  | ((arg1: A) => R)
              :
                  | ((arg1: A, arg2?: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2?: B, arg3?: C) => R)
                  | ((arg1: A, arg2?: B) => R)
                  | ((arg1: A) => R)
          : IsOptional<C> extends true
            ? IsOptional<D> extends true
              ?
                  | ((arg1: A, arg2: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2: B, arg3?: C) => R)
                  | ((arg1: A, arg2: B) => R)
                  | ((arg1: A) => R)
              :
                  | ((arg1: A, arg2: B, arg3?: C, arg4?: D) => R)
                  | ((arg1: A, arg2: B, arg3?: C) => R)
                  | ((arg1: A, arg2: B) => R)
                  | ((arg1: A) => R)
            : IsOptional<D> extends true
              ?
                  | ((arg1: A, arg2: B, arg3: C, arg4?: D) => R)
                  | ((arg1: A, arg2: B, arg3: C) => R)
                  | ((arg1: A, arg2: B) => R)
                  | ((arg1: A) => R)
              :
                  | ((arg1: A, arg2: B, arg3: C, arg4?: D) => R)
                  | ((arg1: A, arg2: B, arg3: C) => R)
                  | ((arg1: A, arg2: B) => R)
                  | ((arg1: A) => R)
        : (...args: T) => R;

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

// ============================================================================
// BUILDER
// ============================================================================

class Builder<TSchema extends AnySchema = never> {
  private schema?: TSchema;

  input<T extends AnySchema>(schema: T): Builder<T> {
    const builder = new Builder<T>();
    (builder as any).schema = schema;
    return builder;
  }

  handler<
    TFn extends InferSchemaOutput<TSchema> extends readonly any[]
      ? SpreadTuple<InferSchemaOutput<TSchema>, any>
      : (arg: InferSchemaOutput<TSchema>) => any,
  >(
    fn: TFn,
  ): InferSchemaInput<TSchema> extends readonly any[]
    ? SpreadTuple<InferSchemaInput<TSchema>, ReturnType<TFn>>
    : InferSchemaInput<TSchema> extends any
      ? (arg: InferSchemaInput<TSchema>) => ReturnType<TFn>
      : never {
    const schema = this.schema as any;
    const wrapped = (...args: any[]) => {
      const isTuple = schema._def?.type === "tuple" || schema.type === "tuple";

      const input = isTuple ? args : args[0];
      const result = schema["~standard"].validate(input);

      const parsed = (result as any).value;

      if (Array.isArray(parsed)) {
        const finalArgs = handleTupleDefaults(schema, parsed);
        return (fn as (...args: any[]) => any)(...finalArgs);
      } else {
        return (fn as (arg: any) => any)(parsed);
      }
    };
    return wrapped as any;
  }
}

export function builder() {
  return new Builder();
}
