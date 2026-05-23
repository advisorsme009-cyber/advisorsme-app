import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "./api";

const STORAGE_KEY = "fasterEngine.activeJobId";
const POLL_INTERVAL_MS = 2000;
const MAX_BACKOFF_MS = 8000;
const MAX_CONSECUTIVE_FAILURES = 4;

const TERMINAL_STATUSES = new Set(["done", "error"]);

const INITIAL_JOB = null;

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

export function useFasterEngine() {
  const [health, setHealth] = useState({ loading: true, data: null, error: null });
  const [job, setJob] = useState(INITIAL_JOB);
  const [polling, setPolling] = useState(false);
  const [pollError, setPollError] = useState(null);
  const abortRef = useRef(null);

  const fetchHealth = useCallback(async () => {
    setHealth((h) => ({ ...h, loading: true, error: null }));
    try {
      const res = await fetch(`${apiUrl}/engine2/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth({ loading: false, data, error: null });
    } catch (err) {
      setHealth({ loading: false, data: null, error: err.message || String(err) });
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const stopPolling = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setPolling(false);
  }, []);

  const fetchStatusOnce = useCallback(async (id, signal) => {
    const res = await fetch(`${apiUrl}/engine2/status/${id}`, { signal });
    if (res.status === 404) {
      const err = new Error("Job not found");
      err.code = 404;
      throw err;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);

  const pollJob = useCallback(
    async (id) => {
      stopPolling();
      const controller = new AbortController();
      abortRef.current = controller;
      setPolling(true);
      setPollError(null);

      let delay = POLL_INTERVAL_MS;
      let consecutiveFailures = 0;

      try {
        while (!controller.signal.aborted) {
          try {
            const next = await fetchStatusOnce(id, controller.signal);
            setJob(next);
            consecutiveFailures = 0;
            delay = POLL_INTERVAL_MS;
            if (TERMINAL_STATUSES.has(next.status)) {
              if (next.status === "done") {
                try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
              }
              break;
            }
          } catch (err) {
            if (err.name === "AbortError") return;
            if (err.code === 404) {
              try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
              setPollError("Job not found on server (it may have been restarted).");
              break;
            }
            consecutiveFailures += 1;
            if (consecutiveFailures > MAX_CONSECUTIVE_FAILURES) {
              setPollError("Lost connection to server");
              break;
            }
            delay = Math.min(delay * 2, MAX_BACKOFF_MS);
          }
          try {
            await sleep(delay, controller.signal);
          } catch (err) {
            if (err.name === "AbortError") return;
            throw err;
          }
        }
      } finally {
        setPolling(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [fetchStatusOnce, stopPolling]
  );

  const submit = useCallback(
    async (files) => {
      if (!files?.length) throw new Error("Select at least one PDF.");
      const fd = new FormData();
      for (const f of files) fd.append("files", f);

      const res = await fetch(`${apiUrl}/engine2/generate`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        let detail = "";
        try { detail = await res.text(); } catch { /* ignore */ }
        throw new Error(detail || `Upload failed: HTTP ${res.status}`);
      }
      const initial = await res.json();
      setJob(initial);
      try { localStorage.setItem(STORAGE_KEY, initial.id); } catch { /* ignore */ }
      pollJob(initial.id);
      return initial;
    },
    [pollJob]
  );

  const reset = useCallback(() => {
    stopPolling();
    setJob(INITIAL_JOB);
    setPollError(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, [stopPolling]);

  // Resume an in-flight job after refresh.
  useEffect(() => {
    let storedId = null;
    try { storedId = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    if (!storedId) return;
    (async () => {
      try {
        const initial = await fetchStatusOnce(storedId);
        setJob(initial);
        if (!TERMINAL_STATUSES.has(initial.status)) {
          pollJob(storedId);
        } else if (initial.status === "done") {
          try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        }
      } catch (err) {
        if (err.code === 404) {
          try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return {
    health,
    job,
    polling,
    pollError,
    submit,
    reset,
    stopPolling,
    refreshHealth: fetchHealth,
  };
}
