import { useEffect, useState } from 'react';

/**
 * Why: Delays reacting to a fast-changing value (keystrokes) until it settles, so a query keyed on
 * it doesn't fire one request per keystroke.
 * @param value - The latest value.
 * @param delayMs - Milliseconds to wait after the last change.
 * @returns The value once it has stopped changing for `delayMs`.
 * @example
 * const price = useDebouncedValue(form.price, 400);
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
