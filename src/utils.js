"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleError = exports.isZagoraTypedError = void 0;
exports.isAsyncFunction = isAsyncFunction;
exports.generalValidator = generalValidator;
exports.validateInput = validateInput;
exports.createResult = createResult;
exports.handleTupleDefaults = handleTupleDefaults;
exports.createErrorHelpers = createErrorHelpers;
const error_ts_1 = require("./error.ts");
const isZagoraTypedError = (error) => {
    return Boolean(error instanceof Error &&
        error.name === "ZagoraError" &&
        error.data !== undefined);
};
exports.isZagoraTypedError = isZagoraTypedError;
// note: basic, but coverting a lot, if not just use `is-async-function` in future
function isAsyncFunction(fn) {
    if (typeof fn !== "function") {
        return false;
    }
    const str = Function.prototype.toString.call(fn);
    if (str.startsWith("async")) {
        return true;
    }
    const obj = Object.prototype.toString.call(fn);
    if (obj === "[object AsyncFunction]") {
        return true;
    }
    try {
        const result = fn();
        return result instanceof Promise;
    }
    catch (_err) {
        return false;
    }
}
function generalValidator(schema, value, internal, isOutputValidation = false, originalError) {
    var _a;
    const result = internal !== null && internal !== void 0 ? internal : schema["~standard"].validate(value);
    if (result instanceof Promise) {
        return result.then((res) => {
            return generalValidator(schema, res, res, isOutputValidation, originalError);
        });
    }
    if (result.issues) {
        let error = error_ts_1.ZagoraError.fromIssues(result.issues, `${isOutputValidation ? "Output" : "Options"} validation failed`);
        if (originalError) {
            const key = ((_a = originalError === null || originalError === void 0 ? void 0 : originalError.data) === null || _a === void 0 ? void 0 : _a.type) || "___";
            const issues = result.issues
                .map((issue) => issue.message)
                .join(", ");
            error = new error_ts_1.ZagoraError(`Invalid error data for ${key}: ${issues}`, {
                issues: result.issues,
                data: value,
                // cause: originalError,
                reason: originalError.reason || originalError.message,
            });
        }
        return {
            data: null,
            error,
            isDefined: false,
        };
    }
    if (originalError) {
        // Rewrite the passed error data to the processed after validation,
        // so that it can respect defaults and options set in error schemas.
        // (originalError as any).data = result.value;
        return { data: null, error: result.value, isDefined: true };
    }
    return { data: result.value, error: null, isDefined: false };
}
function validateInput(schema, rawArgs, processed) {
    // Handle tuple defaults if needed
    const processedArgs = handleTupleDefaults(schema, rawArgs);
    // console.log("valibot processed tuple defaults:::", processedArgs);
    const processResult = (res) => {
        if (!res.issues) {
            // const validatedValue = res.value;
            // const args = Array.isArray(validatedValue)
            //   ? validatedValue
            //   : [validatedValue];
            return { data: res.value, error: null, isDefined: false };
        }
        return {
            data: null,
            error: error_ts_1.ZagoraError.fromIssues(res.issues, "Input validation failed..."),
            isDefined: false,
        };
    };
    const schemaAny = schema;
    const isTupleSchema = (schemaAny._def && schemaAny._def.type === "tuple") ||
        schemaAny.type === "tuple";
    const isArraySchema = (schemaAny._def && schemaAny._def.type === "array") ||
        schemaAny.type === "array";
    const isPrimitiveSchema = !isTupleSchema;
    // console.log({
    //   isTupleSchema,
    //   isArraySchema,
    //   isPrimitiveSchema,
    // });
    let args = processedArgs;
    // NOTE: if z.array() then it should allow func([1,2,3]);
    // NOTE: if z.string() then func('foo');
    // NOTE: if z.tuple(z.string(), z.number()) then func('foo', 123);
    if (isPrimitiveSchema || isArraySchema) {
        // console.log("isPrimitiveSchema || isArraySchema", {
        //   isPrimitiveSchema,
        //   isArraySchema,
        //   args,
        // });
        args = args[0];
    }
    // Try tuple validation first
    const result = schema["~standard"].validate(args);
    if (result instanceof Promise) {
        return result.then((res) => processResult(res));
    }
    return processResult(result);
}
function createResult(data, error, isDefined) {
    const res = [data, error, isDefined];
    res.data = data;
    res.error = error;
    res.isDefined = isDefined;
    return res;
}
function handleTupleDefaults(schema, rawArgs) {
    var _a;
    // Check if this might be a tuple schema by examining the schema structure
    const schemaAny = schema;
    const isZodTuple = schemaAny._def && schemaAny._def.type === "tuple";
    const isValibotTuple = schemaAny.type === "tuple" && !isZodTuple;
    // Try to detect if this is a StandardSchema tuple schema
    if (isZodTuple || isValibotTuple) {
        const tupleItems = ((_a = schemaAny === null || schemaAny === void 0 ? void 0 : schemaAny._def) === null || _a === void 0 ? void 0 : _a.items) || schemaAny.items;
        if (tupleItems && Array.isArray(tupleItems)) {
            const result = [...rawArgs];
            // Fill in defaults for missing elements
            for (let i = rawArgs.length; i < tupleItems.length; i++) {
                const itemSchema = tupleItems[i];
                if (itemSchema && itemSchema.type === "default" && itemSchema._def) {
                    // console.log("only zod>>");
                    const defaultValue = typeof itemSchema._def.defaultValue === "function"
                        ? itemSchema._def.defaultValue()
                        : itemSchema._def.defaultValue;
                    result[i] = defaultValue;
                    // console.log("only zod", i, defaultValue);
                }
                else if (itemSchema &&
                    isValibotTuple &&
                    itemSchema.type === "optional") {
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
function createErrorHelpers(schema, isAsync) {
    const helpers = {};
    for (const [key, errorSchema] of Object.entries(schema)) {
        helpers[key] = createHelper(key, errorSchema, isAsync);
    }
    return helpers;
}
function createHelper(key, errorSchema, isAsync) {
    return (errorData) => {
        return Object.assign({ type: key }, errorData);
    };
}
const handleError = (err, errorsSchema) => {
    if (!errorsSchema)
        return null;
    // Check if it's a typed error object (plain object with type field)
    if (err &&
        typeof err === "object" &&
        "type" in err &&
        typeof err.type === "string" &&
        !(0, exports.isZagoraTypedError)(err)) {
        const errorType = err.type;
        if (errorType in errorsSchema) {
            const schema = errorsSchema[errorType];
            const result = schema["~standard"].validate(err);
            if (result instanceof Promise) {
                return result.then((res) => {
                    if (res.issues) {
                        return {
                            data: null,
                            error: error_ts_1.ZagoraError.fromIssues(res.issues, `Invalid error data for ${errorType}`),
                            isDefined: false,
                        };
                    }
                    return { data: null, error: res.value, isDefined: true };
                });
            }
            if (result.issues) {
                return {
                    data: null,
                    error: error_ts_1.ZagoraError.fromIssues(result.issues, `Invalid error data for ${errorType}`),
                    isDefined: false,
                };
            }
            return { data: null, error: result.value, isDefined: true };
        }
    }
    return null;
};
exports.handleError = handleError;
