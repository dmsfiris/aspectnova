// src/store/devtools.web.ts
import type { StateCreator, StoreMutatorIdentifier } from "zustand";

/**
 * Web shim for the devtools middleware used on native.
 * Keeps the full StateCreator signature so generics are preserved.
 */
export function devtools<
  S,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(initializer: StateCreator<S, Mps, Mcs>, _options?: unknown): StateCreator<S, Mps, Mcs> {
  return initializer;
}
