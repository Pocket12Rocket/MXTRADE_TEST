import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Why: A fast double-click or double-tap can fire a handler twice before React re-renders with a
 * disabled button, so the guard has to be a ref that blocks re-entry synchronously.
 * @returns {{run: (asyncFn: () => Promise<*>, options?: {holdOnSuccess?: boolean}) => Promise<*>, pending: boolean}}
 *   `run` executes the function unless one is already running (then it returns undefined);
 *   `pending` is true while it runs, for disabling buttons and showing a busy label.
 *   With `holdOnSuccess` the lock stays after success, for actions that navigate away.
 * @example
 * const { run, pending } = useSingleFlight();
 * const handleSave = () => run(async () => { await saveProfile(values); });
 */
export function useSingleFlight() {
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (asyncFn, { holdOnSuccess = false } = {}) => {
    if (inFlight.current) {
      return undefined;
    }
    inFlight.current = true;
    setPending(true);
    let keepLock = false;
    try {
      const result = await asyncFn();
      keepLock = holdOnSuccess;
      return result;
    } finally {
      if (!keepLock) {
        inFlight.current = false;
        if (mounted.current) {
          setPending(false);
        }
      }
    }
  }, []);

  return { run, pending };
}
