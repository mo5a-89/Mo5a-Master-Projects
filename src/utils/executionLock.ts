/**
 * Execution Lock & Concurrency Defense Utility
 * Prevents double-clicks, duplicate background requests, and state corruption
 * on heavy operations such as Export Word, Print, OCR AI Extraction, and Database Mutations.
 */

import { useState, useCallback, useRef } from 'react';

// Global active locks registry to prevent cross-component race conditions
const activeGlobalLocks = new Set<string>();

export function isGloballyLocked(lockKey: string): boolean {
  return activeGlobalLocks.has(lockKey);
}

export function acquireGlobalLock(lockKey: string, autoReleaseMs = 30000): boolean {
  if (activeGlobalLocks.has(lockKey)) {
    console.warn(`[ExecutionLock] Blocked concurrent execution attempt for locked key: "${lockKey}"`);
    return false;
  }
  activeGlobalLocks.add(lockKey);
  
  // Safety timeout in case an unhandled exception or unmounted component misses release
  setTimeout(() => {
    if (activeGlobalLocks.has(lockKey)) {
      activeGlobalLocks.delete(lockKey);
      console.warn(`[ExecutionLock] Auto-released stagnant lock for key: "${lockKey}"`);
    }
  }, autoReleaseMs);

  return true;
}

export function releaseGlobalLock(lockKey: string): void {
  activeGlobalLocks.delete(lockKey);
}

/**
 * Execute an async operation guarded with concurrency lock.
 * Returns null if blocked by an existing lock.
 */
export async function withExecutionLock<T>(
  lockKey: string,
  operation: () => Promise<T>,
  options?: {
    timeoutMs?: number;
    onBlocked?: () => void;
  }
): Promise<T | null> {
  const acquired = acquireGlobalLock(lockKey, options?.timeoutMs || 45000);
  if (!acquired) {
    options?.onBlocked?.();
    return null;
  }

  try {
    return await operation();
  } finally {
    releaseGlobalLock(lockKey);
  }
}

/**
 * React Hook for component-level concurrency locking with reactive loading states
 */
export function useExecutionLock() {
  const [activeLocks, setActiveLocks] = useState<Record<string, boolean>>({});
  const locksRef = useRef<Record<string, boolean>>({});

  const isLocked = useCallback((key: string): boolean => {
    return !!locksRef.current[key] || activeGlobalLocks.has(key);
  }, []);

  const runWithLock = useCallback(
    async <T>(
      key: string,
      fn: () => Promise<T> | T,
      options?: { timeoutMs?: number; onBlocked?: () => void }
    ): Promise<T | null> => {
      if (isLocked(key)) {
        console.warn(`[useExecutionLock] Blocked double-trigger for key: ${key}`);
        options?.onBlocked?.();
        return null;
      }

      // Mark locked
      locksRef.current = { ...locksRef.current, [key]: true };
      setActiveLocks((prev) => ({ ...prev, [key]: true }));
      acquireGlobalLock(key, options?.timeoutMs || 45000);

      try {
        const result = await fn();
        return result;
      } catch (err) {
        console.error(`[useExecutionLock] Error in locked task "${key}":`, err);
        throw err;
      } finally {
        delete locksRef.current[key];
        setActiveLocks((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        releaseGlobalLock(key);
      }
    },
    [isLocked]
  );

  return {
    isLocked,
    activeLocks,
    runWithLock,
  };
}
