/**
 * Detects the literal type `any`.
 *
 * This helper type returns `true` if the type parameter `T` is literally the `any` type,
 * and `false` otherwise. Uses the `0 extends 1 & T` trick which only passes for `any`.
 */

// TEST: with expect-type
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Reports whether the supplied value type `V` is definitely, possibly, or never promise-like.
 *
 * ## Behavior:
 * - `string | number | { … }`         → `false`
 * - `{ … } | undefined | null | void` → `false`
 * - `new Promise(...)`                → `true`
 * - `Promise.resolve(...)`            → `true`
 * - `async () => …` return type       → `true`
 * - **explicit** `ReturnType<void>`   → `false`
 * - `any`                             → `false`
 * - `Promise<any>`                    → `true`
 *
 * ## Special Notes
 * - The literal value `any` is explicitly treated as "not a promise"
 * - However, `Promise<any>` IS detected as a promise (since we know it's wrapped)
 * - Mixed promise/non-promise unions produce `boolean` to preserve uncertainty
 *
 * @template V - The value type you want to test
 */
// TEST: with expect-type
export type IsPromise<V> = IsAny<V> extends true
  ? false
  : [V] extends [never]
    ? false
    : [V] extends [PromiseLike<any>]
      ? true
      : [Extract<V, PromiseLike<any>>] extends [never]
        ? false
        : boolean;

/**
 * Preserves sync, async, and possibly-async return shapes from the input type.
 *
 * ## Use Case
 * Perfect for functions that should return `Promise<Result>` for async handlers
 * and `Result` for sync handlers.
 *
 * ## Behavior:
 * - `ConditionalAsync<Promise<T>, Result>` → `Promise<Result>`
 * - `ConditionalAsync<T, Result>`          → `Result`
 * - `ConditionalAsync<T | Promise<T>, Result>` → `Result | Promise<Result>`
 * - `ConditionalAsync<any, Result>`        → `Result` (bare `any` is treated as sync)
 * - `ConditionalAsync<Promise<any>, Result>` → `Promise<Result>` (Promise<any> is treated as async)
 *
 * ## Example:
 * ```ts
 * type Handler<T> = () => T;
 * type CallableResult<T> = ConditionalAsync<T, Result<Awaited<T>>>;
 *
 * // async () => string  →  ReturnType is Promise<string>  →  Promise<Result<string>>
 * // () => string        →  ReturnType is string           →  Result<string>
 * // () => Promise<T>    →  ReturnType is Promise<T>       →  Promise<Result<T>>
 * ```
 *
 * @template T - The type to check (typically a function's return type)
 * @template Result - The result type to wrap conditionally
 */
// TEST: with expect-type
type ResolvePromise<TAsync extends boolean, Result> = TAsync extends true
  ? Promise<Result>
  : Result;

export type ConditionalAsync<T, Result> = ResolvePromise<IsPromise<T>, Result>;
