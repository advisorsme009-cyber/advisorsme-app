import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Container,
} from "@mui/material";
import { ThemeProvider } from "@emotion/react";
import LinkedinAITheme from "../LinkedinAI/style/LinkedinAITheme";
import { apiUrl } from "./hooks/api";
import FinancialTableView from "./utils/FinancialTableView";

const BSForecasting = () => {
  const [clientId, setClientId] = useState("pwc-test-123456");
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setError("");
    setData(null);
    setIsLoading(true);

    try {
      const response = await fetch(
        `${apiUrl}/calculation/BS/forecasting/lv1/fetch/?client_id=${encodeURIComponent(
          clientId
        )}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        }
      );
      if (!response.ok)
        throw new Error(`API call failed with status: ${response.status}`);

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(`Failed to fetch data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const exportData = async () => {
    setError("");
    setIsExporting(true);

    try {
      const response = await fetch(
        `${apiUrl}/calculation/BS/forecasting/lv1/export/?client_id=${encodeURIComponent(
          clientId
        )}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        }
      );

      if (!response.ok)
        throw new Error(`Export failed with status: ${response.status}`);

      // Get the blob from the streaming response
      const blob = await response.blob();

      // Extract filename from content-disposition header or use default
      const contentDisposition = response.headers.get("content-disposition");
      let filename = "BS_forecasting.xlsx";
      console.log(response.headers);
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create a download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      setError(`Failed to export data: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Container maxWidth={false} sx={{ py: 4, minHeight: "100vh" }}>
        <Typography
          variant="h3"
          component="h1"
          gutterBottom
          sx={{ textAlign: "center", fontWeight: "bold", mb: 4 }}
        >
          Balance Sheet Forecasting Data
        </Typography>

        <Box sx={{ display: "flex", gap: 2, mb: 4, justifyContent: "center" }}>
          <TextField
            label="Client ID"
            variant="outlined"
            size="small"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            sx={{ minWidth: 300 }}
          />
          <Button
            variant="contained"
            onClick={fetchData}
            disabled={isLoading || !clientId}
            startIcon={
              isLoading ? <CircularProgress size={20} color="inherit" /> : null
            }
          >
            {isLoading ? "Loading..." : "Fetch Data"}
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={exportData}
            disabled={isExporting || !clientId}
            startIcon={
              isExporting ? (
                <CircularProgress size={20} color="inherit" />
              ) : null
            }
          >
            {isExporting ? "Exporting..." : "Export to Excel"}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {data && (
          <FinancialTableView
            data={data}
            firstColumnLabel="Parameter"
            formatNumber={(n) => {
              if (n === null || n === undefined) return "—";
              return n.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
            }}
          />
        )}
      </Container>
    </ThemeProvider>
  );
};

export default BSForecasting;
