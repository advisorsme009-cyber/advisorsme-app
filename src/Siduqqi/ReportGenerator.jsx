import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  CircularProgress,
  Alert,
  Grid
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';

import LinkedinAITheme from '../LinkedinAI/style/LinkedinAITheme';
import { apiUrl } from './hooks/api';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// --- 1. The "Recipe Book" (Configuration) ---
const CHART_RECIPES = {
  // Income Statement Recipes
  "IS": [
    {
      id: "main_performance",
      title: "💰 The Big Picture (Revenue vs Profit)",
      type: "line",
      keys: ["revenue", "grossProfit", "netIncomeLoss"],
      colors: ["#2E8B57", "#3CB371", "#20B2AA"], // Different shades of Green
      description: "Are we making more money than we spend?"
    },
    {
      id: "expense_breakdown",
      title: "💸 Where is the Money Going?",
      type: "doughnut", // Using Doughnut as "Pie of Pain"
      keys: ["costOfRevenue", "sellingMarketingExpenses", "generalAdminExpensesAdj"],
      colors: ["#FF6347", "#FFA07A", "#CD5C5C"], // Shades of Red
      description: "Breakdown of costs and spending."
    },
    {
      id: "growth_tracker",
      title: "🚀 How Fast Are We Growing?",
      type: "bar",
      keys: ["salesGrowthYoY"],
      colors: ["#4682B4"], // Blue for growth
      description: "Year-over-Year growth percentage."
    }
    // Removed "community_impact" as per instruction to "Show these three" for IS
  ],
  
  // Balance Sheet Recipes
  "BS": [
    {
      id: "health_check",
      title: "⚖️ Assets vs. Liabilities",
      type: "bar",
      keys: ["totalAssets", "totalLiabilities"], 
      colors: ["#2E8B57", "#DC143C"], // Green vs Red
      description: "Do we own more than we owe?"
    },
     {
      id: "liquidity_gauge",
      title: "💧 Liquidity Check",
      type: "gauge_metric", // Custom type to handle separately
      keys: ["currentAssets", "currentLiabilities"],
      description: "Current Ratio (Assets / Liabilities)"
    }
  ]
};

// --- DATA NORMALIZATION HELPERS (Adapted from FinancialSummaryTable) ---
const normalizeData = (data, isForecast, isIncomeStatement) => {
    if (!data) return {};
    const normalized = {};

    // 1. IS Forecast (ForecastingCalculationLv1) has special structure
    if (isIncomeStatement && isForecast) {
       const extracted = data.extracted_param?.["IS-CON"] || {};
       const calculated = data.calculation_lv1 || {};
       
       const merge = (source) => {
           Object.entries(source).forEach(([key, value]) => {
                if (!normalized[key]) {
                    normalized[key] = {
                        param_name: value.param_name || key,
                        ...value
                    };
                } else {
                    Object.entries(value).forEach(([k, v]) => {
                        if (/^\d{4}$/.test(k)) normalized[key][k] = v;
                    });
                }
           });
       };

       merge(extracted);
       merge(calculated);
       
       if (Object.keys(normalized).length > 0) return normalized;
    }

    // 2. Standard Structure
    Object.entries(data).forEach(([key, value]) => {
        if (!normalized[key]) {
            normalized[key] = {
                param_name: value.param_name || key,
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


const ReportGenerator = ({ clientId = "pwc-test-123456" }) => {
  // Statement Type: 'IS' or 'BS'
  const [statementType, setStatementType] = useState('IS');
  
  // View Mode: 'Historical' or 'Forecasted'
  const [viewMode, setViewMode] = useState('Historical');

  // Request State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Data Cache
  const [cache, setCache] = useState({
    IS: { Historical: null, Forecasted: null },
    BS: { Historical: null, Forecasted: null }
  });

  // --- Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
        // If we have data for this combination, don't refetch
        if (cache[statementType][viewMode]) return;

        setIsLoading(true);
        setError("");

        try {
            let url = "";
            const isIS = statementType === 'IS';
            const isForecast = viewMode === 'Forecasted';

            if (isIS) {
                if (!isForecast) {
                    url = `${apiUrl}/calculation/PL/fetch/${clientId}`;
                } else {
                    url = `${apiUrl}/calculation/lv1/fetch?client_id=${clientId}`;
                }
            } else {
                // BS
                 if (!isForecast) {
                    url = `${apiUrl}/calculation/BS/historical/lv1/fetch/?client_id=${encodeURIComponent(clientId)}`;
                } else {
                    url = `${apiUrl}/calculation/BS/forecasting/lv1/fetch/?client_id=${encodeURIComponent(clientId)}`;
                }
            }

            const res = await fetch(url, { headers: { Accept: "application/json" } });
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
            
            const json = await res.json();
            const normalized = normalizeData(json, isForecast, isIS);

            setCache(prev => ({
                ...prev,
                [statementType]: {
                    ...prev[statementType],
                    [viewMode]: normalized
                }
            }));

        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (clientId) fetchData();
  }, [statementType, viewMode, clientId, cache]); // Depend on inputs


  // --- Chart Building Logic ---
  const currentData = cache[statementType][viewMode];

  const charts = useMemo(() => {
    if (!currentData) return [];
    
    const recipes = CHART_RECIPES[statementType] || [];
    
    return recipes.map(recipe => {
        // Special handling for the Liquidity Gauge
        if (recipe.type === 'gauge_metric') {
             const assetsKey = recipe.keys[0]; // currentAssets
             const liabKey = recipe.keys[1];   // currentLiabilities
             
             // Get latest year for gauge
             const assetData = currentData[assetsKey] || {};
             const rawYears = Object.keys(assetData).filter(k => /^\d{4}$/.test(k)).sort();
             const latestYear = rawYears[rawYears.length - 1];
             
             const currentAssets = parseFloat(currentData[assetsKey]?.[latestYear] || 0);
             const currentLiabilities = parseFloat(currentData[liabKey]?.[latestYear] || 0);
             
             const ratio = currentLiabilities ? (currentAssets / currentLiabilities).toFixed(2) : "N/A";
             
             return {
                 ...recipe,
                 metric: ratio,
                 year: latestYear,
                 isGauge: true
             };
        }

        // Standard Charts (Line, Bar, Doughnut)
        const labels = [];
        
        // 1. Gather all Labels (Years) first from the first available key
        // We find the first key that actually exists in data
        const validKey = recipe.keys.find(k => currentData[k]);
        if (validKey) {
             const rawData = currentData[validKey];
             Object.keys(rawData).forEach(k => {
                 if (/^\d{4}$/.test(k)) labels.push(k);
             });
             labels.sort();
        }

        // 2. Build Datasets
        const datasets = recipe.keys.map((key, index) => {
            const rawData = currentData[key] || {};
            const dataPoints = labels.map(year => rawData[year] || 0);
            
            return {
                label: rawData.param_name || key,
                data: dataPoints,
                backgroundColor: recipe.colors[index % recipe.colors.length],
                borderColor: recipe.colors[index % recipe.colors.length],
                borderWidth: 2,
                tension: 0.3, // Smooth curves for lines
                fill: recipe.type === 'area', // if we had area
            };
        });
        
        // For Pie/Doughnut, we usually show a snapshot of the latest year, or average?
        // "Pie of Pain" usually implies breakdown. A pie chart can't show time series easily.
        // Solution: If Doughnut/Pie, aggregate or show latest year. 
        // Let's show Latest Year for 'Pie of Pain'.
        if (recipe.type === 'doughnut' || recipe.type === 'pie') {
            const latestYear = labels[labels.length - 1];
            const pieData = datasets.map(ds => ds.data[ds.data.length - 1]);
            
            return {
                ...recipe,
                data: {
                    labels: datasets.map(ds => ds.label),
                    datasets: [{
                        data: pieData,
                        backgroundColor: recipe.colors,
                        borderColor: '#fff',
                        borderWidth: 1
                    }]
                },
                year: latestYear
            };
        }

        return {
            ...recipe,
            data: {
                labels,
                datasets
            }
        };

    });
  }, [currentData, statementType, viewMode]);


  // --- Render ---
  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ width: '100%', p: 3, bgcolor: '#F5F6F8', minHeight: '100vh' }}>
        
        <Box sx={{ mb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 500, color: '#333' }}>
                Report Generator
            </Typography>
        </Box>

        {/* Controls */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
            <Grid container spacing={2} alignItems="center">
                <Grid item>
                     {/* Statement Tabs */}
                     <Tabs 
                        value={statementType} 
                        onChange={(e, v) => setStatementType(v)}
                        sx={{ minHeight: '40px' }}
                     >
                        <Tab label="Income Statement" value="IS" />
                        <Tab label="Balance Sheet" value="BS" />
                     </Tabs>
                </Grid>
                <Grid item sx={{ flexGrow: 1 }} />
                <Grid item>
                    {/* View Mode Tabs (Pill style) */}
                     <Tabs
                        value={viewMode}
                        onChange={(e, v) => setViewMode(v)}
                        sx={{
                            '& .MuiTab-root': {
                                minHeight: '36px',
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                padding: '6px 16px',
                                borderRadius: '18px',
                                mr: 1,
                                color: '#5e6c84',
                                '&.Mui-selected': {
                                    color: '#fff',
                                    bgcolor: '#1F559B'
                                }
                            },
                             '& .MuiTabs-indicator': { display: 'none' }
                        }}
                     >
                        <Tab label="Historical" value="Historical" />
                        <Tab label="Forecasted" value="Forecasted" />
                     </Tabs>
                </Grid>
            </Grid>
        </Paper>

        {/* Content */}
        {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
                <CircularProgress />
            </Box>
        )}

        {error && (
             <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
        )}

        {!isLoading && !error && (
            <Grid container spacing={3}>
                {charts.map((chart, i) => (
                    <Grid item xs={12} md={statementType === 'IS' && chart.id === 'main_performance' ? 12 : 6} key={i}>
                        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, height: '100%', minHeight: '350px' }}>
                            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1 }}>
                                {chart.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                {chart.description} {chart.year ? `(${chart.year})` : ''}
                            </Typography>

                            <Box sx={{ height: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                {/* Gauge / Metric */}
                                {chart.isGauge ? (
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography variant="h2" sx={{ fontWeight: 'bold', color: parseFloat(chart.metric) > 1.5 ? '#2E8B57' : (parseFloat(chart.metric) < 1 ? '#DC143C' : '#FFA500') }}>
                                            {chart.metric}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Current Ratio
                                        </Typography>
                                        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                            {parseFloat(chart.metric) > 1 ? "Safe (Assets > Liabilities)" : "Risky (Assets < Liabilities)"}
                                        </Typography>
                                    </Box>
                                ) : (
                                    // STANDARD CHARTS
                                    <>
                                        {chart.type === 'line' && <Line data={chart.data} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />}
                                        {chart.type === 'bar' && <Bar data={chart.data} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />}
                                        {(chart.type === 'doughnut' || chart.type === 'pie') && <Doughnut data={chart.data} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />}
                                    </>
                                )}
                            </Box>
                        </Paper>
                    </Grid>
                ))}

                {charts.length === 0 && (
                     <Grid item xs={12}>
                        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
                            <Typography color="text.secondary">No chart data available for this selection.</Typography>
                        </Paper>
                     </Grid>
                )}
            </Grid>
        )}

      </Box>
    </ThemeProvider>
  );
};

export default ReportGenerator;
