"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Zagora = exports.zagora = void 0;
const error_ts_1 = require("./error.ts");
const utils_ts_1 = require("./utils.ts");
__exportStar(require("./error.ts"), exports);
__exportStar(require("./types.ts"), exports);
__exportStar(require("./utils.ts"), exports);
const zagora = () => {
    return new Zagora();
};
exports.zagora = zagora;
class Zagora {
    "~zagora";
    constructor(def) {
        this["~zagora"] = def || {};
    }
    input(schema) {
        return new Zagora(Object.assign(Object.assign({}, this["~zagora"]), { inputSchema: schema }));
    }
    output(schema) {
        return new Zagora(Object.assign(Object.assign({}, this["~zagora"]), { outputSchema: schema }));
    }
    errors(errorsMap) {
        return new Zagora(Object.assign(Object.assign({}, this["~zagora"]), { errorsSchema: errorsMap }));
    }
    handler(impl) {
        var _a, _b;
        const isAsync = (0, utils_ts_1.isAsyncFunction)(impl);
        const inputSchema = this["~zagora"].inputSchema || undefined;
        const outputSchema = this["~zagora"].outputSchema || undefined;
        const errorsSchema = this["~zagora"].errorsSchema || undefined;
        const schemaAny = inputSchema;
        const isTupleSchema = ((schemaAny === null || schemaAny === void 0 ? void 0 : schemaAny._def) && ((_a = schemaAny === null || schemaAny === void 0 ? void 0 : schemaAny._def) === null || _a === void 0 ? void 0 : _a.type) === "tuple") ||
            (schemaAny === null || schemaAny === void 0 ? void 0 : schemaAny.type) === "tuple";
        const isArraySchema = ((schemaAny === null || schemaAny === void 0 ? void 0 : schemaAny._def) && ((_b = schemaAny === null || schemaAny === void 0 ? void 0 : schemaAny._def) === null || _b === void 0 ? void 0 : _b.type) === "array") ||
            (schemaAny === null || schemaAny === void 0 ? void 0 : schemaAny.type) === "array";
        const isPrimitiveSchema = !isTupleSchema;
        const wrapper = (rawArgs, processed) => {
            if (processed === "____$$MAGIC_VALUE_" &&
                inputSchema &&
                inputSchema["~standard"]) {
                const inputResult = (0, utils_ts_1.validateInput)(inputSchema, rawArgs);
                if (inputResult instanceof Promise) {
                    return inputResult.then((res) => {
                        if (res.error) {
                            return res;
                        }
                        return wrapper(rawArgs, res.data);
                    });
                }
                if (inputResult.error) {
                    return inputResult;
                }
                return wrapper(rawArgs, inputResult.data);
            }
            try {
                const errs = errorsSchema
                    ? (0, utils_ts_1.createErrorHelpers)(errorsSchema, isAsync)
                    : null;
                const finalArgs = isArraySchema || isPrimitiveSchema
                    ? [processed, errs]
                    : [...processed, errs];
                const rawResult = impl(...finalArgs.filter(Boolean));
                if (rawResult instanceof Promise) {
                    return rawResult
                        .then((data) => {
                        const typedError = (0, utils_ts_1.handleError)(data, errorsSchema);
                        if (typedError)
                            return typedError;
                        return outputSchema
                            ? (0, utils_ts_1.generalValidator)(outputSchema, data, null, true)
                            : { data, error: null, isDefined: false };
                    })
                        .catch((error) => {
                        const typedError = (0, utils_ts_1.handleError)(error, errorsSchema);
                        if (typedError)
                            return typedError;
                        if (error instanceof error_ts_1.ZagoraError) {
                            return { data: null, error, isDefined: false };
                        }
                        return {
                            data: null,
                            error: new error_ts_1.ZagoraError("An async handler threw unknown error", {
                                cause: error,
                            }),
                            isDefined: false,
                        };
                    });
                }
                const typedError = (0, utils_ts_1.handleError)(rawResult, errorsSchema);
                if (typedError)
                    return typedError;
                const outputResult = outputSchema
                    ? (0, utils_ts_1.generalValidator)(outputSchema, rawResult, null, true)
                    : { data: rawResult, error: null, isDefined: false };
                if (outputResult.error) {
                    return outputResult;
                }
                return outputResult;
            }
            catch (error) {
                const typedError = (0, utils_ts_1.handleError)(error, errorsSchema);
                if (typedError)
                    return typedError;
                if (error instanceof error_ts_1.ZagoraError) {
                    return { data: null, error, isDefined: false };
                }
                return {
                    data: null,
                    error: new error_ts_1.ZagoraError("Synchronous handler threw unknown error", {
                        cause: error,
                    }),
                    isDefined: false,
                };
            }
        };
        const forwardImpl = ((...args) => {
            const resp = wrapper(args, "____$$MAGIC_VALUE_");
            if (resp instanceof Promise) {
                return resp.then((x) => (0, utils_ts_1.createResult)(x.data, x.error, x.isDefined));
            }
            return (0, utils_ts_1.createResult)(resp.data, resp.error, resp.isDefined);
        });
        const forward = forwardImpl;
        forward["~zagora"] = Object.assign(Object.assign({}, this["~zagora"]), { handler: forward });
        return forward;
    }
}
exports.Zagora = Zagora;
// ===== EXAMPLE USAGES
// const zag = new Zagora();
// const foo = zag
//   .input(
//     z.tuple([
//       z.enum(["login", "auth", "foobie"]),
//       z
//         .object({
//           name: z.string(),
//           age: z.number().min(0),
//           username: z.string().optional(),
//         })
//         .strict()
//         .default({
//           name: "barry",
//           age: 0,
//           // username: undefined,
//         }),
//     ]),
//   )
//   // .input(z.string())
//   .output(
//     z
//       .object({
//         opts: z.any(),
//         str: z.string().min(1),
//       })
//       .strict(),
//   )
//   .errors({
//     AUTH_ERROR: z.object({
//       type: z.literal("AUTH_ERROR"),
//       userId: z.uuid(),
//       email: z.email().default("sasa@example.com"),
//     }),
//     RATE_LIMIT_ERROR: z.object({
//       type: z.literal("RATE_LIMIT_ERROR"),
//       userId: z.uuid(),
//       email: z.email().default("sasa@example.com"),
//       retryAfter: z.number().min(300),
//       attempts: z.number().min(10),
//     }),
//   })
//   .handler((mode, opts, errors) => {
//     if (mode === "login") {
//       return errors.AUTH_ERROR({
//         userId: crypto.randomUUID(),
//         // sasa: 121,
//         // email: "sasa@example.com",
//       });
//     }
//     if (mode === "auth") {
//       return errors.RATE_LIMIT_ERROR({
//         userId: crypto.randomUUID(),
//         email: "random@user.com",
//         retryAfter: 300,
//         attempts: 10,
//       });
//     }
//     // console.log({ opts, mode, errors });
//     return {
//       str: `foo-${mode}`,
//       opts,
//     };
//   });
// // NOTE (works): should type error when there is a second required argument,
// // defined in the tuple input schema.
// // NOTE (works): should not type error when there's second arg but has set as optional/default.
// const bar = foo("foobie", {
//   age: 11,
//   name: "barry",
//   username: "asasa",
// });
// console.log(
//   "foo::::",
//   {
//     data: bar.data,
//     error: bar.error,
//   },
//   "<<<",
// );
