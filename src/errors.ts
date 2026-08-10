import type {
  AnySchema,
  InferSchemaInput,
  InferSchemaOutput,
  Prettify,
  SchemaIssue,
} from "./types";

export type ValidationError<ErrorKindNames = never> = Prettify<
  Readonly<{
    kind: "VALIDATION_ERROR";
    message: string;
    issues: readonly SchemaIssue[];
    key?: ErrorKindNames;
  }>
>;
export type InternalError = Prettify<ReturnType<typeof createInternalError>>;
export type DefinedError<T> = Prettify<{ readonly kind: string } & T>;
export type ZagoraError<T> = ValidationError | InternalError | DefinedError<T>;

export function isValidationError(val: any): val is ValidationError {
  return Boolean(
    val &&
      val.kind === "VALIDATION_ERROR" &&
      val.issues &&
      Array.isArray(val.issues) &&
      val.message &&
      typeof val.message === "string",
  );
}

export function isInternalError(val: any): val is InternalError {
  return Boolean(
    val &&
      val.kind === "UNKNOWN_ERROR" &&
      val.message &&
      typeof val.message === "string" &&
      "cause" in val &&
      "stack" in val,
  );
}

export function isDefinedError<T>(val: any): val is DefinedError<T> {
  return (
    Boolean(
      val?.kind &&
        typeof val.kind === "string" &&
        val.kind.length > 0 &&
        val.kind === val.kind.toUpperCase(),
    ) &&
    !isValidationError(val) &&
    !isInternalError(val)
  );
}

export function isZagoraError<T>(val: any): val is ZagoraError<T> {
  return isValidationError(val) || isInternalError(val) || isDefinedError(val);
}

export function createValidationError<ErrorKindNames = never>(
  mode: "input" | "output" | "error data" | "env",
  issues: SchemaIssue[],
  key?: ErrorKindNames,
) {
  const modeName = mode.charAt(0).toUpperCase() + mode.slice(1);
  const str = key ? ` for ${(key as string).toUpperCase()}` : "";
  const issuesMsg = issues
    // strip "input" cuz it can be confusing when we are schema validating output and errors too
    .map((issue) => {
      const key = issue.path?.join(".") || "(root)";
      const message = issue.message.replace("Invalid input: ", "");
      return `${key} => ${message}`;
    })
    .join("; ");

  return {
    kind: "VALIDATION_ERROR" as const,
    message: `${modeName} validation failed${str}: ${issuesMsg}`,
    key,
    issues: issues as SchemaIssue[],
  } as const;
}

export function createInternalError(msg: string, cause?: any) {
  return {
    kind: "UNKNOWN_ERROR" as const,
    message: msg,
    cause,
    stack: cause?.stack,
  } as const;
}

export function createErrorHelpers(
  errorMap: any,
): Record<string, (data: any) => any> {
  const helpers: any = {};
  for (const key of Object.keys(errorMap)) {
    const schema = errorMap[key];
    if (!schema) continue;

    helpers[key] = (data: any) => {
      return { ...data, kind: key };
    };
  }
  return helpers;
}

export type ErrorHelpers<
  TErrorsMap extends Record<string, AnySchema> | undefined,
> = TErrorsMap extends Record<string, AnySchema>
  ? {
      [K in keyof TErrorsMap]: (
        data: Prettify<Omit<InferSchemaInput<TErrorsMap[K]>, "kind">>,
      ) => never;
    }
  : never;

export type InferSchemaMapPlain<
  T extends Record<string, AnySchema>,
  ResolveErr extends boolean,
> = {
  [K in keyof T]: ResolveErr extends true
    ? Prettify<{ kind: K } & Omit<InferSchemaOutput<T[K]>, "kind">>
    : Prettify<InferSchemaOutput<T[K]>>;
};

export type ResolveErrorKindNames<TErrorsMap> = TErrorsMap extends Record<
  string,
  AnySchema
>
  ? keyof TErrorsMap
  : undefined;
