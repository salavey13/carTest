// /lib/readPath.ts
/**
 * Safe nested property accessor with fallback.
 * Reads a property from an object using a path array, returning a fallback value if the path doesn't exist.
 *
 * @example
 * readPath({ a: { b: 1 } }, ['a', 'b'], 0) // returns 1
 * readPath({ a: {} }, ['a', 'b'], 'fallback') // returns 'fallback'
 */

export function readPath<T>(obj: unknown, path: string[], fallback: T): T {
  if (!obj || typeof obj !== "object") {
    return fallback;
  }

  let current: unknown = obj;
  for (const key of path) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return fallback;
    }
  }

  return current as T;
}
