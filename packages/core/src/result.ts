export type Result<T, E> =
  | { readonly success: true; readonly value: T; readonly error?: never }
  | { readonly success: false; readonly value?: never; readonly error: E };

/**
 * Creates a successful Result wrapping a value.
 */
export function ok<T>(value: T): Result<T, never> {
  return { success: true, value };
}

/**
 * Creates a failed Result wrapping an error.
 */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}
