import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  Paper,
} from "@mui/material";
import { ThemeProvider } from "@emotion/react";
import LinkedinAITheme from "../LinkedinAI/style/LinkedinAITheme";
import { apiUrl } from "./hooks/api";
import { useSettings } from "./context/SettingsContext";
import CorporateFinancialTableView from "./utils/CorporateFinancialTableView";

const IsConHistorical = () => {
  const { clientId, getCachedData, setCachedData } = useSettings();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    if (!clientId) return;
    setError("");
    setData(null);
    setIsLoading(true);

    try {
      const response = await fetch(
        `${apiUrl}/calculation/PL/fetch/${clientId}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        }
      );
      if (!response.ok)
        throw new Error(`API call failed with status: ${response.status}`);

      const result = await response.json();
      setData(result);
      setCachedData("isconhistorical", clientId, result);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(`Failed to fetch data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      const cached = getCachedData("isconhistorical", clientId);
      if (cached) {
        setData(cached);
      } else {
        fetchData();
      }
    }
  }, [clientId]);

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ width: '100%', p: 3, bgcolor: '#F5F6F8', minHeight: '100vh' }}>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 500, color: '#333' }}>
              IS-CON Historical Data
            </Typography>
            <Typography variant="body2" color="text.secondary">
              (Income Statement)
            </Typography>
          </Box>
          
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={fetchData}
              disabled={isLoading || !clientId}
              sx={{ bgcolor: '#1F559B', '&:hover': { bgcolor: '#163C6E' } }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : "Refresh Data"}
            </Button>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {isLoading && !data && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress />
          </Box>
        )}

        {!data && !isLoading && !error && (
          <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
             <Typography color="text.secondary">Enter a client ID in the settings to fetch data.</Typography>
          </Paper>
        )}

        {data && (() => {
          const keys = Object.keys(data);
          // Determine the split index roughly around where the KPI starts
          const kpiStartIndex = keys.indexOf('salesGrowthYoY') !== -1 
            ? keys.indexOf('salesGrowthYoY') 
            : keys.indexOf('netIncomeLoss') + 1 || keys.length;

          const table1Data = {};
          const kpiData = {};
          
          keys.forEach((k, idx) => {
            if (idx < kpiStartIndex) {
              table1Data[k] = data[k];
            } else {
              kpiData[k] = data[k];
            }
          });

          return (
            <Stack spacing={4}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 2 }}>
                 <CorporateFinancialTableView data={table1Data} title="Metric" />
              </Paper>
              
              {Object.keys(kpiData).length > 0 && (
                <Paper elevation={0} sx={{ p: 3, borderRadius: 2 }}>
                   <CorporateFinancialTableView 
                      data={kpiData} 
                      title="KPI Table" 
                      formatNumber={(n) => {
                        if (n === null || n === undefined || n === "") return "—";
                        const num = Number(n);
                        if (isNaN(num)) return n;
                        return num.toLocaleString("en-US", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        }) + "%";
                      }}
                   />
                </Paper>
              )}
            </Stack>
          );
        })()}

      </Box>
    </ThemeProvider>
  );
};

export default IsConHistorical;
