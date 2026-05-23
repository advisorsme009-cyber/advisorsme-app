import { useState, useCallback } from "react";
import { apiUrl } from "./api";

function extractFilename(contentDisposition, defaultName) {
  if (!contentDisposition) return defaultName;
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match ? match[1] : defaultName;
}

async function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export default function useEngineExport() {
  const [exporting, setExporting] = useState(null); // null | module key | "all"
  const [error, setError] = useState(null);

  const doExport = useCallback(async (url, label, defaultFilename) => {
    setExporting(label);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/octet-stream" },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const filename = extractFilename(
        res.headers.get("content-disposition"),
        defaultFilename
      );
      await downloadBlob(blob, filename);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setExporting(null);
    }
  }, []);

  const exportModule = useCallback(
    (clientId, moduleKey) => {
      const encoded = encodeURIComponent(clientId);
      const encodedModule = encodeURIComponent(moduleKey);
      return doExport(
        `${apiUrl}/engine/export/${encoded}/${encodedModule}`,
        moduleKey,
        `${moduleKey}_export.xlsx`
      );
    },
    [doExport]
  );

  const exportAll = useCallback(
    (clientId) => {
      const encoded = encodeURIComponent(clientId);
      return doExport(
        `${apiUrl}/engine/export/${encoded}`,
        "all",
        "financial_model_export.xlsx"
      );
    },
    [doExport]
  );

  return { exportModule, exportAll, exporting, error, setError };
}
