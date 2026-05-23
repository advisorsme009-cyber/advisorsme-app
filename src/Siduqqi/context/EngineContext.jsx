import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { apiUrl } from "../hooks/api";
import { useSettings } from "./SettingsContext";

const EngineContext = createContext(null);

export const useEngine = () => useContext(EngineContext);

// Deep-merge utility: merges source into target (returns new object)
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// Set a nested value by dot-path: "revenue.growth_yoy_pct.2024" → nested object
function buildDelta(path, value) {
  const parts = path.split(".");
  let obj = {};
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
  return obj;
}

export const EngineProvider = ({ children }) => {
  const { clientId, getCachedData, setCachedData, clearCache } = useSettings();

  const [assumptions, setAssumptions] = useState(null);
  const [results, setResults] = useState(null);
  const [historical, setHistorical] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [assumptionsLoading, setAssumptionsLoading] = useState(false);
  const [patching, setPatching] = useState(false);
  const [generatingDefaults, setGeneratingDefaults] = useState(false);

  // Debounce refs
  const pendingDelta = useRef({});
  const debounceTimer = useRef(null);

  // --- API Calls ---

  const loadAssumptions = useCallback(
    async (cId) => {
      if (!cId) return;
      setAssumptionsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiUrl}/engine/assumptions/${encodeURIComponent(cId)}`);
        if (res.status === 404) {
          setAssumptions(null);
          return;
        }
        if (!res.ok) throw new Error(`Failed to load assumptions (${res.status})`);
        const data = await res.json();
        setAssumptions(data);
        setCachedData("engine_assumptions", cId, data);
      } catch (err) {
        setError(err.message);
      } finally {
        setAssumptionsLoading(false);
      }
    },
    [setCachedData]
  );

  const loadAllResults = useCallback(
    async (cId) => {
      if (!cId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiUrl}/engine/results/${encodeURIComponent(cId)}`);
        if (res.status === 404) {
          setResults(null);
          return;
        }
        if (!res.ok) throw new Error(`Failed to load results (${res.status})`);
        const json = await res.json();
        // Normalize: the endpoint returns { data: { "IS-CON": {...}, "BS": {...}, ... } }
        const moduleData = json.data || json;
        setResults(moduleData);
        setCachedData("engine_results", cId, moduleData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [setCachedData]
  );

  const recalculate = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiUrl}/engine/recalculate/${encodeURIComponent(clientId)}`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      if (!res.ok) throw new Error(`Recalculation failed (${res.status})`);
      await loadAllResults(clientId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clientId, loadAllResults]);

  const saveFullAssumptions = useCallback(
    async (data) => {
      if (!clientId) return;
      setAssumptionsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${apiUrl}/engine/assumptions/${encodeURIComponent(clientId)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }
        );
        if (!res.ok) throw new Error(`Failed to save assumptions (${res.status})`);
        setAssumptions(data);
        setCachedData("engine_assumptions", clientId, data);
      } catch (err) {
        setError(err.message);
      } finally {
        setAssumptionsLoading(false);
      }
    },
    [clientId, setCachedData]
  );

  // --- Generate Default Assumptions ---

  const generateDefaults = useCallback(
    async (save = false) => {
      if (!clientId) return null;
      setGeneratingDefaults(true);
      setError(null);
      try {
        const res = await fetch(
          `${apiUrl}/engine/generate-defaults/${encodeURIComponent(clientId)}?save=${save}`,
          { method: "POST", headers: { "Content-Type": "application/json" } }
        );
        if (!res.ok) throw new Error(`Failed to generate defaults (${res.status})`);
        const json = await res.json();
        const generated = json.assumptions || json;
        if (save) {
          setAssumptions(generated);
          setCachedData("engine_assumptions", clientId, generated);
        }
        return generated;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setGeneratingDefaults(false);
      }
    },
    [clientId, setCachedData]
  );

  // --- Load Historical Data ---

  const loadHistorical = useCallback(
    async (cId) => {
      if (!cId) return;
      try {
        const res = await fetch(`${apiUrl}/engine/historical/${encodeURIComponent(cId)}`);
        if (res.status === 404) {
          setHistorical(null);
          return;
        }
        if (!res.ok) throw new Error(`Failed to load historical data (${res.status})`);
        const json = await res.json();
        const data = json.data || json;
        setHistorical(data);
        setCachedData("engine_historical", cId, data);
      } catch (err) {
        setError(err.message);
      }
    },
    [setCachedData]
  );

  // --- Debounced PATCH ---

  const flushPatch = useCallback(async () => {
    const delta = pendingDelta.current;
    if (!clientId || Object.keys(delta).length === 0) return;
    pendingDelta.current = {};
    setPatching(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiUrl}/engine/assumptions/${encodeURIComponent(clientId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(delta),
        }
      );
      if (!res.ok) throw new Error(`Failed to update assumptions (${res.status})`);
      // Refetch results since PATCH auto-recalculates
      await loadAllResults(clientId);
      // Also refresh assumptions to stay in sync
      const freshAssumptions = await fetch(
        `${apiUrl}/engine/assumptions/${encodeURIComponent(clientId)}`
      );
      if (freshAssumptions.ok) {
        const data = await freshAssumptions.json();
        setAssumptions(data);
        setCachedData("engine_assumptions", clientId, data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPatching(false);
    }
  }, [clientId, loadAllResults, setCachedData]);

  // --- Classify Line Item Driver ---
  // Hits the specialized PATCH /engine/assumptions/{id}/classify-item endpoint
  // which overrides a S&M / G&A line item's driver ("yoy_growth" |
  // "pct_of_revenue" | "fixed") and triggers a full recalculate on the backend.
  const classifyLineItem = useCallback(
    async (module, item, driver) => {
      if (!clientId) return;
      setPatching(true);
      setError(null);
      try {
        const res = await fetch(
          `${apiUrl}/engine/assumptions/${encodeURIComponent(clientId)}/classify-item`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ module, item, driver }),
          }
        );
        if (!res.ok) throw new Error(`Failed to classify line item (${res.status})`);
        // Backend recalculates on this PATCH — refetch results + assumptions.
        await loadAllResults(clientId);
        const freshAssumptions = await fetch(
          `${apiUrl}/engine/assumptions/${encodeURIComponent(clientId)}`
        );
        if (freshAssumptions.ok) {
          const data = await freshAssumptions.json();
          setAssumptions(data);
          setCachedData("engine_assumptions", clientId, data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setPatching(false);
      }
    },
    [clientId, loadAllResults, setCachedData]
  );

  const queuePatch = useCallback(
    (path, value) => {
      // Accumulate into pending delta
      const delta = buildDelta(path, value);
      pendingDelta.current = deepMerge(pendingDelta.current, delta);

      // Update local assumptions immediately for responsive UI
      setAssumptions((prev) => (prev ? deepMerge(prev, delta) : prev));

      // Reset debounce timer
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(flushPatch, 500);
    },
    [flushPatch]
  );

  // --- Load on clientId change ---

  useEffect(() => {
    if (!clientId) {
      setAssumptions(null);
      setResults(null);
      setHistorical(null);
      return;
    }

    // Check cache first
    const cachedAssumptions = getCachedData("engine_assumptions", clientId);
    const cachedResults = getCachedData("engine_results", clientId);
    const cachedHistorical = getCachedData("engine_historical", clientId);

    if (cachedAssumptions && cachedResults) {
      setAssumptions(cachedAssumptions);
      setResults(cachedResults);
      if (cachedHistorical) setHistorical(cachedHistorical);
    } else {
      loadAssumptions(clientId);
      loadAllResults(clientId);
      loadHistorical(clientId);
    }
  }, [clientId, getCachedData, loadAssumptions, loadAllResults, loadHistorical]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return (
    <EngineContext.Provider
      value={{
        assumptions,
        results,
        historical,
        loading,
        error,
        assumptionsLoading,
        patching,
        generatingDefaults,
        loadAssumptions,
        loadAllResults,
        loadHistorical,
        recalculate,
        saveFullAssumptions,
        generateDefaults,
        queuePatch,
        flushPatch,
        classifyLineItem,
        setError,
      }}
    >
      {children}
    </EngineContext.Provider>
  );
};
