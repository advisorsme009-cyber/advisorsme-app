import React, { useState, useMemo } from 'react';
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
import MetricSelector from './MetricSelector';
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
import { useSettings } from './context/SettingsContext';
import { useEngine } from './context/EngineContext';

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
      keys: ["costOfRevenue", "sellingMarketingExpenses", "generalAdminExpenses"],
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
      keys: ["totalCurrentAssets", "totalCurrentLiabilities"],
      description: "Current Ratio (Assets / Liabilities)"
    }
  ]
};

// --- ENGINE DATA HELPERS ---

// Map statement type tab to engine module key
const STATEMENT_TO_MODULE = { IS: "IS-CON", BS: "BS" };

// Merge _analytics into module data so chart recipes can reference analytics keys
function prepareModuleData(moduleResults) {
  if (!moduleResults) return null;
  const data = { ...moduleResults };
  if (data._analytics) {
    Object.entries(data._analytics).forEach(([key, value]) => {
      if (!data[key]) data[key] = value;
    });
    delete data._analytics;
  }
  return data;
}

// Filter data to only include years matching the viewMode
function filterByViewMode(data, forecastStartYear, viewMode) {
  if (!data || !forecastStartYear || viewMode === "All") return data;
  const filtered = {};
  Object.entries(data).forEach(([key, metric]) => {
    if (!metric || typeof metric !== "object") return;
    const newMetric = {};
    Object.entries(metric).forEach(([k, v]) => {
      if (/^\d{4}$/.test(k)) {
        const yr = Number(k);
        if (viewMode === "Historical" && yr < forecastStartYear) newMetric[k] = v;
        else if (viewMode === "Forecasted" && yr >= forecastStartYear) newMetric[k] = v;
      } else {
        newMetric[k] = v;
      }
    });
    filtered[key] = newMetric;
  });
  return filtered;
}

const LEVEL3_CATEGORIES = ["S&M", "G&A", "FA", "WC", "DEBT", "eosp", "equity"];

const ReportGenerator = () => {
  const { clientId } = useSettings();
  const { results, assumptions, loading: isLoading, error: engineError } = useEngine();

  // Statement Type: 'IS' or 'BS'
  const [statementType, setStatementType] = useState('IS');

  // View Mode: 'Historical', 'Forecasted', or 'All'
  const [viewMode, setViewMode] = useState('All');

  // Custom Metrics State
  const [selectedMetrics, setSelectedMetrics] = useState(['revenue', 'costOfRevenue']);

  // Level 3 State
  const [activeLevel, setActiveLevel] = useState('1');
  const [level3Category, setLevel3Category] = useState(null);

  const error = engineError || "";

  const handleToggleMetric = (metricKey) => {
    setSelectedMetrics(prev => {
        if (prev.includes(metricKey)) {
            return prev.filter(k => k !== metricKey);
        } else {
            if (prev.length >= 3) return prev;
            return [...prev, metricKey];
        }
    });
  };

  // Determine forecast start year from assumptions
  const forecastStartYear = assumptions?.general?.reporting_date
    ? assumptions.general.reporting_date + 1
    : undefined;

  // --- Prepare data from engine results ---
  const moduleKey = STATEMENT_TO_MODULE[statementType];
  const rawModuleData = useMemo(
    () => prepareModuleData(results?.[moduleKey]),
    [results, moduleKey]
  );
  const currentData = useMemo(
    () => filterByViewMode(rawModuleData, forecastStartYear, viewMode),
    [rawModuleData, forecastStartYear, viewMode]
  );

  // Level 3 data comes directly from engine results
  const level3DataForCategory = useMemo(() => {
    if (!level3Category || !results?.[level3Category]) return null;
    const prepared = prepareModuleData(results[level3Category]);
    return filterByViewMode(prepared, forecastStartYear, viewMode);
  }, [results, level3Category, forecastStartYear, viewMode]);

  // Derive available metrics for the dropdown
  const availableMetrics = useMemo(() => {
    // If Level 3, return metrics from the selected category
    if (activeLevel === '3') {
        if (!level3Category || !level3DataForCategory) return [];

        return Object.entries(level3DataForCategory)
            .filter(([, value]) => value && value.param_name)
            .map(([key, value]) => ({
                key: key,
                label: value.param_name || key,
                isLevel3: true,
                category: level3Category
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    // Level 1/2/4 use the main IS/BS module data
    if (!currentData) return [];
    return Object.entries(currentData)
        .filter(([, value]) => value && value.param_name)
        .map(([key, value]) => ({
            key: key,
            label: value.param_name || key
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

  }, [currentData, activeLevel, level3Category, level3DataForCategory]);

  const charts = useMemo(() => {
    if (!currentData) return [];
    
    const recipes = CHART_RECIPES[statementType] || [];
    const generatedCharts = [];

    // 1. Custom Selected Chart logic moved to render/separate memo
    // We strictly use this loop for standard recipes now
    const standardCharts = recipes.map(recipe => {
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

    }); // End of map

    return standardCharts;

  }, [currentData, statementType, viewMode]);

  // Prepare Custom Chart Data
  const customChartData = useMemo(() => {
     const findMetricData = (k) => {
         if (currentData && currentData[k]) return currentData[k];
         if (level3DataForCategory && level3DataForCategory[k]) return level3DataForCategory[k];
         return null;
    };

     if (selectedMetrics.length === 0) return null;

     const labels = [];
     const validKey = selectedMetrics.find(k => findMetricData(k));

     if (validKey) {
         const rawData = findMetricData(validKey);
          Object.keys(rawData).forEach(k => {
               if (/^\d{4}$/.test(k)) labels.push(k);
           });
          labels.sort();
     }

     const customDatasets = selectedMetrics.map((key, index) => {
          const rawData = findMetricData(key) || {};
          const dataPoints = labels.map(year => rawData[year] || 0);
          const customColors = ["#8884d8", "#82ca9d", "#ffc658"];

          return {
             label: rawData.param_name || key,
             data: dataPoints,
             backgroundColor: customColors[index % customColors.length],
             borderColor: customColors[index % customColors.length],
             borderWidth: 2,
             tension: 0.3,
             fill: false
          };
     });

     return {
         labels,
         datasets: customDatasets
     };

  }, [currentData, selectedMetrics, level3DataForCategory]);


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
                        <Tab label="All" value="All" />
                        <Tab label="Historical" value="Historical" />
                        <Tab label="Forecasted" value="Forecasted" />
                     </Tabs>
                </Grid>
                
            </Grid>
        </Paper>


        {/* Content */}
        {isLoading && !results && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
                <CircularProgress />
            </Box>
        )}

        {error && (
             <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
        )}

        {!(isLoading && !results) && !error && (
            <Grid container spacing={3}>
                {/* Custom Analysis Card (Always Visible) */}
                <Grid item xs={12}>
                     <Paper elevation={0} sx={{ p: 3, borderRadius: 2, minHeight: '400px' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Box>
                                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                                    🔎 Custom Analysis
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Compare specific metrics over time.
                                </Typography>
                            </Box>
                            <Box>
                                <MetricSelector
                                    metrics={availableMetrics}
                                    selectedMetrics={selectedMetrics}
                                    onToggleMetric={handleToggleMetric}
                                    maxSelection={3}
                                    activeLevel={activeLevel}
                                    onLevelChange={setActiveLevel}
                                    level3Categories={LEVEL3_CATEGORIES}
                                    selectedLevel3Category={level3Category}
                                    onLevel3CategoryChange={setLevel3Category}
                                    isLoadingLevel3={false}
                                />
                            </Box>
                        </Box>
                        
                        <Box sx={{ height: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {customChartData ? (
                                <Line data={customChartData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                            ) : (
                                <Typography color="text.secondary">Select metrics from the top-right button to visualize data.</Typography>
                            )}
                        </Box>
                     </Paper>
                </Grid>

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
