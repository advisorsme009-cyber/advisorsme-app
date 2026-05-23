import { useCallback, useRef, useState } from "react";
import { apiUrl } from "./api";

const INITIAL_STATE = {
  running: false,
  progress: 0,
  stageProgress: 0,
  currentStage: "",
  currentStageId: "",
  currentStep: "",
  events: [],
  result: null,
  error: null,
};

export function usePipeline() {
  const [state, setState] = useState(INITIAL_STATE);
  const abortRef = useRef(null);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
    setState((s) => ({
      ...s,
      running: false,
      error: s.error || "Cancelled",
    }));
  }, []);

  const run = useCallback(
    async ({ clientId, files, years, force = false, dpi = 150 }) => {
      if (!clientId) throw new Error("clientId is required");
      if (!files?.length) throw new Error("At least one PDF file is required");
      if (files.length !== years.length) {
        throw new Error("files and years arrays must be the same length");
      }
      if (years.some((y) => !Number.isInteger(y))) {
        throw new Error("All years must be integers");
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setState({
        ...INITIAL_STATE,
        running: true,
      });

      const fd = new FormData();
      fd.append("client_id", clientId);
      fd.append("years", JSON.stringify(years));
      fd.append("force", String(force));
      fd.append("dpi", String(dpi));
      files.forEach((f) => fd.append("files", f));

      try {
        const res = await fetch(`${apiUrl}/process-pipeline`, {
          method: "POST",
          body: fd,
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
        }
        if (!res.body) throw new Error("Response has no body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        // Read SSE stream line-by-line
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;
            let event;
            try {
              event = JSON.parse(payload);
            } catch (err) {
              console.warn("Failed to parse SSE line:", payload, err);
              continue;
            }

            setState((s) => ({
              ...s,
              progress: typeof event.progress === "number" ? event.progress : s.progress,
              stageProgress:
                typeof event.stageProgress === "number"
                  ? event.stageProgress
                  : s.stageProgress,
              currentStage: event.stageName || s.currentStage,
              currentStageId: event.stage || s.currentStageId,
              currentStep: event.step || s.currentStep,
              events: [...s.events, event],
              result: event.type === "complete" ? event : s.result,
              running: event.type !== "complete",
              error:
                event.type === "complete" && event.status === "error"
                  ? event.detail?.error || "Pipeline failed"
                  : s.error,
            }));
          }
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : String(err);
        setState((s) => ({ ...s, running: false, error: message }));
      } finally {
        abortRef.current = null;
      }
    },
    []
  );

  return { state, run, cancel, reset };
}
