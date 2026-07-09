import { useEffect, useRef } from 'react';

/**
 * Returns a ref to an AbortController that is automatically
 * aborted when the component unmounts (or when deps change).
 *
 * Usage:
 *   const abortRef = useAbortController();
 *   fetch(url, { signal: abortRef.current.signal })
 */
export function useAbortController(deps: any[] = []) {
  const abortRef = useRef<AbortController>(new AbortController());

  useEffect(() => {
    abortRef.current = new AbortController();
    return () => {
      abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return abortRef;
}
