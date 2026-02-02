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

const IsConHistorical = () => {
  const [clientId, setClientId] = useState("");
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setError("");
    setData(null);
    setIsLoading(true);

    try {
      const response = await fetch(
        `${apiUrl}
        fetch/${clientId}`,
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

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Container maxWidth={false} sx={{ py: 4, minHeight: "100vh" }}>
        <Typography
          variant="h3"
          component="h1"
          gutterBottom
          sx={{ textAlign: "center", fontWeight: "bold", mb: 4 }}
        >
          IS-CON Historical Data
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
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {data && <FinancialTableView data={data} firstColumnLabel="Metric" />}
      </Container>
    </ThemeProvider>
  );
};

export default IsConHistorical;
