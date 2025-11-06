// src/store/devtools.native.ts
import type { StateCreator } from "zustand";

// Will be set asynchronously if available
let realDevtools:
  | ((
      fn: StateCreator<unknown, [never], [never]>,
      options?: { name?: string }
    ) => StateCreator<unknown, [never], [never]>)
  | null = null;

// Lazy-load zustand/middleware without blocking module init
// eslint-disable-next-line @typescript-eslint/no-floating-promises, no-void
void (async () => {
  try {
    const mod = await import("zustand/middleware");
    realDevtools = mod.devtools as unknown as typeof realDevtools;
  } catch {
    realDevtools = null;
  }
})();

/**
 * Safe devtools enhancer for native:
 * - In production: NO-OP (returns original creator).
 * - In development: wraps with zustand devtools if it has loaded.
 */
export function devtools<T, Mps extends [never] = [never], Mgs extends [never] = [never]>(
  fn: StateCreator<T, Mps, Mgs>,
  opts?: { name?: string }
): StateCreator<T, Mps, Mgs> {
  const isDev = typeof __DEV__ !== "undefined" && __DEV__ === true;

  if (!isDev || !realDevtools) {
    return fn;
  }

  return (
    realDevtools as unknown as (
      f: StateCreator<T, Mps, Mgs>,
      o?: { name?: string }
    ) => StateCreator<T, Mps, Mgs>
  )(fn, { name: opts?.name });
}
