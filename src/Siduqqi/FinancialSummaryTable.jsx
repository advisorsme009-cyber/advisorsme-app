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
import CorporateFinancialTableView from './utils/CorporateFinancialTableView';
import { apiUrl } from './hooks/api';

const FinancialSummaryTable = ({ clientId = "pwc-test-123456" }) => {
  const navigate = useNavigate();
  // 0: Income Statement, 1: Balance Sheet
  const [activeTab, setActiveTab] = useState(0); 
  // 0: Historical, 1: Forecasted
  const [viewMode, setViewMode] = useState(0);

  // State for data
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Cache to store fetched data
  // Structure: { incomeStatement: { historical: null, forecast: null }, balanceSheet: { historical: null, forecast: null } }
  const [cache, setCache] = useState({
    incomeStatement: { historical: null, forecast: null },
    balanceSheet: { historical: null, forecast: null }
  });

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    // When switching main tabs, default to Historical view? Or keep current?
    // User didn't specify, but resetting to Historical is safer or keeping current is fine.
    // Let's keep current viewMode logic simple, just switch context.
  };

  const handleViewModeChange = (event, newValue) => {
    setViewMode(newValue);
  };

  const handleReferenceClick = (doc) => {
    if (!clientId) return;
    const path = `/advisors/lv3Calculations/${encodeURIComponent(
      clientId
    )}/${encodeURIComponent(doc)}`;
    navigate(path);
  };

  // Helper to normalize data for the table
  const normalizeData = (data, isForecast, isIncomeStatement) => {
    if (!data) return {};
    const normalized = {};

    // Logic similar to previous mergeData but for single source
    // 1. IS Forecast (ForecastingCalculationLv1)
    if (isIncomeStatement && isForecast) {
       const extracted = data.extracted_param?.["IS-CON"] || {};
       const calculated = data.calculation_lv1 || {};
       
       let hasData = false;

       // Merge extracted
        Object.entries(extracted).forEach(([key, value]) => {
         if (!normalized[key]) {
             normalized[key] = {
                 param_name: value.param_name || key,
                 reference: value.reference || null,
                 ...value
             };
             hasData = true;
         } else {
             Object.entries(value).forEach(([k, v]) => {
                 if (/^\d{4}$/.test(k)) normalized[key][k] = v;
             });
             hasData = true;
         }
       });

       // Merge calculated
       Object.entries(calculated).forEach(([key, value]) => {
          if (!normalized[key]) {
              normalized[key] = {
                  param_name: key, 
                  reference: null,
                  ...value
              };
              hasData = true;
          } else {
               Object.entries(value).forEach(([k, v]) => {
                  if (/^\d{4}$/.test(k)) normalized[key][k] = v;
               });
               hasData = true;
          }
       });
       
       if (hasData) return normalized;
       // If no data found with special structure, fall through to generic parsing below
       console.warn("IS Forecast special parsing found no data, falling back to generic parsing", data);
    }

    // 2. IS Historical or BS Forecast/Historical (Simpler structure)
    Object.entries(data).forEach(([key, value]) => {
        if (!normalized[key]) {
            normalized[key] = {
                param_name: value.param_name || key,
                reference: value.reference || null,
                ...value 
            };
        } else {
            Object.entries(value).forEach(([k, v]) => {
                 if (/^\d{4}$/.test(k)) normalized[key][k] = v;
             });
        }
    });

    return normalized;
  };

  useEffect(() => {
    const fetchData = async () => {
      const currentCategory = activeTab === 0 ? 'incomeStatement' : 'balanceSheet';
      
      // Check if we already have data for the current category in cache
      // We fetch BOTH Historical and Forecast for the category at once to allow smooth toggling
      if (cache[currentCategory].historical && cache[currentCategory].forecast) {
        return; // Already cached
      }

      setIsLoading(true);
      setError("");

      try {
        let histUrl = "";
        let forecastUrl = "";

        if (activeTab === 0) {
          // Income Statement
          histUrl = `${apiUrl}/calculation/PL/fetch/${clientId}`;
          forecastUrl = `${apiUrl}/calculation/lv1/fetch?client_id=${clientId}`;
        } else {
          // Balance Sheet
          histUrl = `${apiUrl}/calculation/BS/historical/lv1/fetch/?client_id=${encodeURIComponent(clientId)}`;
          forecastUrl = `${apiUrl}/calculation/BS/forecasting/lv1/fetch/?client_id=${encodeURIComponent(clientId)}`;
        }

        // We fetch both to populate cache fully for this tab
        const [histRes, forecastRes] = await Promise.all([
            fetch(histUrl, { headers: { Accept: "application/json" } }),
            fetch(forecastUrl, { headers: { Accept: "application/json" } })
        ]);

        if (!histRes.ok) throw new Error(`Historical fetch failed: ${histRes.status}`);
        if (!forecastRes.ok) throw new Error(`Forecast fetch failed: ${forecastRes.status}`);

        const histJson = await histRes.json();
        const forecastJson = await forecastRes.json();

        console.log("FinancialSummaryTable Data Fetched:", { histJson, forecastJson });

        // Update cache
        setCache(prev => ({
          ...prev,
          [currentCategory]: {
            historical: normalizeData(histJson, false, activeTab === 0),
            forecast: normalizeData(forecastJson, true, activeTab === 0)
          }
        }));

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
  }, [activeTab, clientId]); // Dependency on activeTab ensures we fetch when switching IS <-> BS

  // Validate which data to show
  const currentCategory = activeTab === 0 ? 'incomeStatement' : 'balanceSheet';
  const currentData = viewMode === 0 
    ? cache[currentCategory].historical 
    : cache[currentCategory].forecast;

  const getTableTitle = () => {
    const report = activeTab === 0 ? "Income Statement" : "Balance Sheet";
    const type = viewMode === 0 ? "Historical" : "Forecasted";
    return `${report} - ${type}`;
  };

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ width: '100%', p: 3, bgcolor: '#F5F6F8', minHeight: '100vh' }}>
        
        {/* Page Title */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 500, color: '#333' }}>
            Financial Summary
          </Typography>
        </Box>

        {/* Main Tabs (IS vs BS) */}
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
          
          {/* Header & Sub-Tabs */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', color: '#333' }}>
              {activeTab === 0 ? "Income Statement Overview" : "Balance Sheet Overview"}
            </Typography>

            {/* View Mode Tabs (Historical vs Forecasted) */}
            <Tabs
              value={viewMode}
              onChange={handleViewModeChange}
              sx={{
                minHeight: '36px',
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  minHeight: '36px',
                  padding: '6px 16px',
                  borderRadius: '18px',
                  marginRight: '8px',
                  color: '#5e6c84',
                  '&.Mui-selected': {
                    color: '#fff',
                    backgroundColor: '#1F559B', // Corporate Blue
                  }
                },
                '& .MuiTabs-indicator': {
                  display: 'none', // Hide the underline indicator for "pill" look
                }
              }}
            >
               <Tab label="Historical" />
               <Tab label="Forecasted" />
            </Tabs>
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
          {!isLoading && !error && currentData && (
            <CorporateFinancialTableView 
                data={currentData}
                title={getTableTitle()}
            />
          )}

          {!isLoading && !error && (!currentData || Object.keys(currentData).length === 0) && (
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
