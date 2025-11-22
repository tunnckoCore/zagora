"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZagoraError = void 0;
class ZagoraError extends Error {
    issues;
    cause;
    data;
    reason;
    constructor(message, options) {
        super(message);
        this.name = "ZagoraError";
        this.issues = options === null || options === void 0 ? void 0 : options.issues;
        this.cause = options === null || options === void 0 ? void 0 : options.cause;
        this.data = options === null || options === void 0 ? void 0 : options.data;
        this.reason = (options === null || options === void 0 ? void 0 : options.reason) || "Unknown or internal error";
    }
    static fromIssues(issues, reason, error) {
        const message = issues.map((issue) => issue.message).join(", ");
        return new ZagoraError(message, {
            issues,
            reason: reason || "Failure caused by validation",
        });
    }
}
exports.ZagoraError = ZagoraError;
