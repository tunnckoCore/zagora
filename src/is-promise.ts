/**
 * Detects the literal type `any`.
 *
 * This helper type returns `true` if the type parameter `T` is literally the `any` type,
 * and `false` otherwise. Uses the `0 extends 1 & T` trick which only passes for `any`.
 */

// TEST: with expect-type
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Returns `true` if the supplied value type `V` is a concrete promise.
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
 * - Uses array wrapper `[T]` to prevent distributive conditional types
 *
 * @template V - The value type you want to test
 */
// TEST: with expect-type
export type IsPromise<V> = IsAny<V> extends true
  ? false // Bare `any` → treat as non-promise
  : [V] extends [Promise<any>]
    ? true // Explicitly Promise<T> → is a promise
    : [V] extends [PromiseLike<any>]
      ? true // PromiseLike<T> → is a promise
      : [Awaited<V>] extends [V]
        ? false // Awaiting V gives us V → not a promise
        : IsAny<Awaited<V>> extends true
          ? false // If Awaited<V> is any, we can't tell → treat as non-promise
          : true; // Awaiting V gives us something different → is a promise

/**
 * Conditionally wraps a result type in a Promise based on whether the input type is a Promise.
 *
 * ## Use Case
 * Perfect for functions that should return `Promise<Result>` for async handlers
 * and `Result` for sync handlers.
 *
 * ## Behavior:
 * - `ConditionalAsync<Promise<T>, Result>` → `Promise<Result>`
 * - `ConditionalAsync<T, Result>`          → `Result`
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
export type ConditionalAsync<T, Result> = IsPromise<T> extends true
  ? Promise<Result> // Is a promise → wrap in Promise
  : Result; // Not a promise (including bare `any`) → return as-is
