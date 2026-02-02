import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  Menu,
  MenuItem,
  CircularProgress,
  Alert
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { ThemeProvider } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import LinkedinAITheme from '../LinkedinAI/style/LinkedinAITheme';
import FinancialTableView from './utils/FinancialTableView';
import { apiUrl } from './hooks/api';

const FinancialSummaryTable = ({ clientId = "pwc-test-123456" }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0); // 0: Income Statement, 1: Balance Sheet
  const [anchorEl, setAnchorEl] = useState(null);
  
  // State for data
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [mergedData, setMergedData] = useState(null);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleExportClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setAnchorEl(null);
  };

  const handleReferenceClick = (doc) => {
    if (!clientId) return;
    const path = `/advisors/lv3Calculations/${encodeURIComponent(
      clientId
    )}/${encodeURIComponent(doc)}`;
    navigate(path);
  };

  // Helper to normalize and merge data
  const mergeData = (historicalData, forecastData, isIncomeStatement) => {
    const combined = {};

    // 1. Process Historical Data
    // Historical data format: { "Revenue": { "2018": 123, ... }, ... }
    if (historicalData) {
      Object.entries(historicalData).forEach(([key, value]) => {
        if (!combined[key]) {
          combined[key] = {
            param_name: value.param_name || key,
            reference: value.reference || null,
            ...value // Spread to get year keys like "2018", "2019"
          };
        } else {
             // If already exists, just merge new years
            combined[key] = { ...combined[key], ...value };
        }
      });
    }

    // 2. Process Forecast Data
    // IS Forecast (ForecastingCalculationLv1) structure: { extracted_param: { "IS-CON": { ... } }, assumptions: { ... }, calculation_lv1: { ... } }
    // BS Forecast (BSForecasting) structure: { "MetricName": { ...years... } } similar to historical
    
    let forecastSource = forecastData;
    
    if (isIncomeStatement && forecastData) {
      // For Income Statement, we might need to decide which part of forecast to show.
      // The prompt implies unified view. Usually "Forecast" comes from 'calculation_lv1' or 'extracted_param["IS-CON"]'
      // Depending on the requirement, we might need to merge multiple sections or just one.
      // Based on `ForecastingCalculationLv1.jsx`, `extracted_param["IS-CON"]` seems to map to historical items like "Revenue".
      // Let's try to merge `extracted_param["IS-CON"]` AND `calculation_lv1` if possible, or just the one that aligns.
      // Typically "Forecast" extends the historical lines.
      
      const extracted = forecastData.extracted_param?.["IS-CON"] || {};
      const calculated = forecastData.calculation_lv1 || {};
      
      // Merge extracted params (often contains the forecast values for same keys)
       Object.entries(extracted).forEach(([key, value]) => {
         if (!combined[key]) {
             combined[key] = {
                 param_name: value.param_name || key,
                 reference: value.reference || null,
                 ...value
             };
         } else {
             // Merge years
             Object.entries(value).forEach(([k, v]) => {
                 if (/^\d{4}$/.test(k)) {
                     combined[key][k] = v;
                 }
             });
         }
       });

       // Merge calculation_lv1 (The actual forecast results)
       Object.entries(calculated).forEach(([key, value]) => {
          if (!combined[key]) {
              combined[key] = {
                  param_name: key, // calculation_lv1 usually keys by param name
                  reference: null,
                  ...value
              };
          } else {
               Object.entries(value).forEach(([k, v]) => {
                  if (/^\d{4}$/.test(k)) {
                      combined[key][k] = v;
                  }
               });
          }
       });
    } else if (!isIncomeStatement && forecastData) {
        // BS Forecast is simpler flat structure
         Object.entries(forecastData).forEach(([key, value]) => {
            if (!combined[key]) {
                 combined[key] = {
                     param_name: value.param_name || key,
                     reference: value.reference || null,
                     ...value
                 };
             } else {
                 Object.entries(value).forEach(([k, v]) => {
                     if (/^\d{4}$/.test(k)) {
                         combined[key][k] = v;
                     }
                 });
             }
         });
    }

    return combined;
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError("");
      setMergedData(null);

      try {
        let histUrl = "";
        let forecastUrl = "";

        if (activeTab === 0) {
          // Income Statement
          histUrl = `${apiUrl}/calculation/PL/fetch/${clientId}`;
          // For IS Forecast, usually we create/fetch:
          forecastUrl = `${apiUrl}/calculation/lv1/revenue/create?client_id=${clientId}`;
        } else {
          // Balance Sheet
          histUrl = `${apiUrl}/calculation/BS/historical/lv1/fetch/?client_id=${encodeURIComponent(clientId)}`;
          forecastUrl = `${apiUrl}/calculation/BS/forecasting/lv1/fetch/?client_id=${encodeURIComponent(clientId)}`;
        }

        const [histRes, forecastRes] = await Promise.all([
            fetch(histUrl, { headers: { Accept: "application/json" } }),
            fetch(forecastUrl, { headers: { Accept: "application/json" } })
        ]);

        if (!histRes.ok) throw new Error(`Historical fetch failed: ${histRes.status}`);
        if (!forecastRes.ok) throw new Error(`Forecast fetch failed: ${forecastRes.status}`);

        const histJson = await histRes.json();
        const forecastJson = await forecastRes.json();

        const merged = mergeData(histJson, forecastJson, activeTab === 0);
        setMergedData(merged);

      } catch (err) {
        console.error("Data fetch error:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (clientId) {
      fetchData();
    }
  }, [activeTab, clientId]);

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ width: '100%', p: 3, bgcolor: '#F5F6F8', minHeight: '100vh' }}>
        
        {/* Page Title */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 500, color: '#333' }}>
            Financial Summary
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, bgcolor: 'white', borderRadius: 1 }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange} 
            aria-label="financial summary tabs"
            sx={{
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, fontSize: '0.95rem' },
              '& .Mui-selected': { color: '#1976d2' }
            }}
          >
            <Tab label="Income Statement" />
            <Tab label="Balance Sheet" />
          </Tabs>
        </Box>

        {/* Main Content */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2 }}>
          
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', color: '#333' }}>
              {activeTab === 0 ? "Income Statement Overview" : "Balance Sheet Overview"}
            </Typography>
           
          </Box>

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
             <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
             </Box>
          )}

          {/* Data Table */}
          {!isLoading && !error && mergedData && (
            <FinancialTableView 
                data={mergedData}
                firstColumnLabel="Metrics"
                onReferenceClick={handleReferenceClick}
            />
          )}

          {!isLoading && !error && !mergedData && (
             <Typography variant="body1" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                No data available.
             </Typography>
          )}

        </Paper>
      </Box>
    </ThemeProvider>
  );
}

export default FinancialSummaryTable;
