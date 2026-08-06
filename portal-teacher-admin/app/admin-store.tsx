"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ADMIN_STORAGE_EVENT } from "./admin-domain";
import { adminErrorCopy } from "./admin-i18n";
import { loadAdminState, reloadAdminState, type AdminMutationResult } from "./admin-service";
import { AdminServiceError, type AdminLocale, type AdminState } from "./admin-types";

type AdminStoreError = {
  code: string;
  message: string;
  fieldErrors: Record<string, string>;
};

type AdminStoreValue = {
  state: AdminState | null;
  loading: boolean;
  loadError: string;
  busyKey: string | null;
  error: AdminStoreError | null;
  clearError: () => void;
  refresh: () => Promise<void>;
  run: <T>(
    key: string,
    operation: () => Promise<AdminMutationResult<T>>,
    successMessage?: string,
  ) => Promise<T | null>;
};

const AdminStoreContext = createContext<AdminStoreValue | null>(null);

export function AdminStoreProvider({
  locale,
  showToast,
  onStateChange,
  children,
}: {
  locale: AdminLocale;
  showToast: (message: string) => void;
  onStateChange?: (state: AdminState) => void;
  children: ReactNode;
}) {
  const [state, setState] = useState<AdminState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<AdminStoreError | null>(null);
  const stateRef = useRef<AdminState | null>(null);

  const commitState = useCallback((nextState: AdminState) => {
    stateRef.current = nextState;
    setState(nextState);
    onStateChange?.(nextState);
  }, [onStateChange]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      commitState(await loadAdminState());
    } catch (loadFailure) {
      const code = loadFailure instanceof AdminServiceError ? loadFailure.message : "LOAD_FAILED";
      setLoadError(adminErrorCopy(locale, code));
    } finally {
      setLoading(false);
    }
  }, [commitState, locale]);

  useEffect(() => {
    let cancelled = false;
    loadAdminState()
      .then((nextState) => {
        if (cancelled) return;
        commitState(nextState);
        setLoading(false);
      })
      .catch((loadFailure: unknown) => {
        if (cancelled) return;
        const code = loadFailure instanceof AdminServiceError ? loadFailure.message : "LOAD_FAILED";
        setLoadError(adminErrorCopy(locale, code));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [commitState, locale]);

  useEffect(() => {
    const sync = async (event: Event) => {
      const revision = event instanceof CustomEvent ? Number(event.detail?.revision) : Number.POSITIVE_INFINITY;
      if (Number.isFinite(revision) && revision <= (stateRef.current?.revision ?? 0)) return;
      try {
        commitState(await reloadAdminState());
      } catch {
        // The originating operation already reports storage errors to the user.
      }
    };
    window.addEventListener(ADMIN_STORAGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ADMIN_STORAGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [commitState]);

  const run = useCallback(async <T,>(
    key: string,
    operation: () => Promise<AdminMutationResult<T>>,
    successMessage?: string,
  ) => {
    if (busyKey) return null;
    setBusyKey(key);
    setError(null);
    try {
      const result = await operation();
      commitState(result.state);
      if (successMessage) showToast(successMessage);
      return result.value;
    } catch (failure) {
      if (failure instanceof AdminServiceError) {
        const nextError = {
          code: failure.message,
          message: adminErrorCopy(locale, failure.message),
          fieldErrors: failure.fieldErrors,
        };
        setError(nextError);
        showToast(nextError.message);
      } else {
        const message = adminErrorCopy(locale, "OPERATION_FAILED");
        setError({ code: "OPERATION_FAILED", message, fieldErrors: {} });
        showToast(message);
      }
      return null;
    } finally {
      setBusyKey(null);
    }
  }, [busyKey, commitState, locale, showToast]);

  const value = useMemo<AdminStoreValue>(() => ({
    state,
    loading,
    loadError,
    busyKey,
    error,
    clearError: () => setError(null),
    refresh,
    run,
  }), [busyKey, error, loadError, loading, refresh, run, state]);

  return <AdminStoreContext.Provider value={value}>{children}</AdminStoreContext.Provider>;
}

export function useAdminStore() {
  const value = useContext(AdminStoreContext);
  if (!value) throw new Error("useAdminStore must be used inside AdminStoreProvider");
  return value;
}
