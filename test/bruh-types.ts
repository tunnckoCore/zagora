type Result<T = any, E = any> = { data: T; error: E };

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

type WrappedReturn<F extends (...args: any[]) => any> =
  ReturnType<F> extends Promise<any>
    ? Promise<UnwrapPromise<ReturnType<F>>>
    : UnwrapPromise<ReturnType<F>>;

function handler<F extends (...args: any[]) => any>(
  fn: F
): (...args: Parameters<F>) => WrappedReturn<F> {
  // runtime simply calls the original function
  // (we must assert `any` because TS can't fully prove the implementation matches the conditional type)
  return ((...args: Parameters<F>) => fn(...args)) as any;
}

const syncFn = (a: number, b: string) => ({ data: a + b.length, error: null });
const asyncFn = async (a: number, b: string) => ({
  data: a + b.length,
  error: null,
});

const wrappedSync = handler(syncFn);
// wrappedSync has type: (a: number, b: string) => { data: number; error: null }

const wrappedAsync = handler(asyncFn);
// wrappedAsync has type: (a: number, b: string) => Promise<{ data: number; error: null }>
