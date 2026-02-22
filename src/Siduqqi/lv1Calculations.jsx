import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Typography,
  Paper,
} from "@mui/material";
import { ThemeProvider } from "@emotion/react";
import LinkedinAITheme from "../LinkedinAI/style/LinkedinAITheme";
import { apiUrl } from "./hooks/api";
import { useSettings } from "./context/SettingsContext";
import CorporateFinancialTableView from "./utils/CorporateFinancialTableView";

export default function Lv1Calculations() {
  const navigate = useNavigate();
  const { clientId, getCachedData, setCachedData } = useSettings();
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFetch = async () => {
    if (!clientId) return;
    setError("");
    setLoading(true);
    try {
      const url = `${apiUrl}/calculation/lv1/fetch?client_id=${encodeURIComponent(
        clientId
      )}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setRawData(data);
      setCachedData("lv1", clientId, { data });
    } catch (e) {
      setError(e.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      const cached = getCachedData("lv1", clientId);
      if (cached) {
        setRawData(cached.data || cached);
      } else {
        handleFetch();
      }
    }
  }, [clientId]);

  const handleReferenceClick = (doc) => {
    if (!clientId) return;
    const path = `/advisors/lv3Calculations/${encodeURIComponent(
      clientId
    )}/${encodeURIComponent(doc)}`;
    navigate(path);
  };

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ width: '100%', p: 3, bgcolor: '#F5F6F8', minHeight: '100vh' }}>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 500, color: '#333' }}>
              IS-CON
            </Typography>
            <Typography variant="body2" color="text.secondary">
              (Lv1 Calculations)
            </Typography>
          </Box>
          
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={handleFetch}
              disabled={loading || !clientId}
              sx={{ bgcolor: '#1F559B', '&:hover': { bgcolor: '#163C6E' } }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Refresh"}
            </Button>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading && !rawData && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress />
          </Box>
        )}

        {!rawData && !loading && !error && (
          <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
             <Typography color="text.secondary">Enter a client ID in the settings to fetch data.</Typography>
          </Paper>
        )}

        {rawData && (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 2 }}>
            <CorporateFinancialTableView
              title="Parameter"
              data={rawData}
              onReferenceClick={handleReferenceClick}
              formatNumber={(n) => {
                if (n === null || n === undefined || n === "") return "—";
                const num = Number(n);
                if (isNaN(num)) return n;
                return num.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                });
              }}
            />
          </Paper>
        )}

      </Box>
    </ThemeProvider>
  );
}
