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
import { apiUrl } from './hooks/api';
import { useSettings } from './context/SettingsContext';

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




const LEVEL3_CATEGORIES = ["S&M", "G&A", "FA", "debt", "WC", "EOSP", "equity"];

const ReportGenerator = () => {
  const { clientId, getCachedData, setCachedData } = useSettings();
  // Statement Type: 'IS' or 'BS'
  const [statementType, setStatementType] = useState('IS');
  
  // View Mode: 'Historical' or 'Forecasted'
  const [viewMode, setViewMode] = useState('Historical');

  // Custom Metrics State
  const [selectedMetrics, setSelectedMetrics] = useState(['revenue', 'costOfRevenue']);

  // Request State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Data Cache
  const [cache, setCache] = useState({
    IS: { Historical: null, Forecasted: null },
    BS: { Historical: null, Forecasted: null }
  });

  // Level 3 State
  const [activeLevel, setActiveLevel] = useState('1');
  const [level3Category, setLevel3Category] = useState(null);
  const [level3Cache, setLevel3Cache] = useState({}); // { [category]: { Historical: ..., Forecasted: ... } }
  const [isLoadingLevel3, setIsLoadingLevel3] = useState(false);

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

  // --- Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
        // Find in local cache or global setting cache
        const globalCacheKey = `report_${statementType}_${viewMode}`;
        const cachedData = getCachedData(globalCacheKey, clientId);

        if (cache[statementType][viewMode] || cachedData) {
            if (cachedData && !cache[statementType][viewMode]) {
                 setCache(prev => ({
                    ...prev,
                    [statementType]: {
                        ...prev[statementType],
                        [viewMode]: cachedData
                    }
                }));
            }
            return;
        }

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

            setCachedData(globalCacheKey, clientId, normalized);

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


  // --- Level 3 Data Fetching ---
  const fetchLevel3Data = async (cat) => {
      if (!cat) return;
      
      const globalKey = `report_lv3_${cat}_${viewMode}`;
      const cachedLv3 = getCachedData(globalKey, clientId);

      if (level3Cache[cat]?.[viewMode] || cachedLv3) {
          if (cachedLv3 && !level3Cache[cat]?.[viewMode]) {
             setLevel3Cache(prev => ({
                  ...prev,
                  [cat]: {
                      ...prev[cat],
                      [viewMode]: cachedLv3 
                  }
              }));
          }
          return; // already cached
      }

      setIsLoadingLevel3(true);
      try {
          // Determine Endpoint
          // Based on lv3Calculations.jsx logic
          let url = "";
          const docLower = cat.toLowerCase();
          
          // Helper to get base url
          const getEndpointPath = (selectedDoc) => {
            const normalized = (selectedDoc || "").toLowerCase();
            if (normalized === "fa") return "fa";
            if (normalized === "debt") return "debt";
            if (normalized === "wc") return "wc";
            return "sm_ga"; // default for S&M and G&A
          };

          const endpoint = getEndpointPath(cat);

          // Construct URL
          if (docLower === "wc") {
             url = `${apiUrl}/calculation/lv3/WC/fetch/?client_id=${encodeURIComponent(clientId)}`;
          } else if (docLower === "eosp" || docLower === "equity") {
             const docPath = docLower === "eosp" ? "EOSP" : "equity";
             url = `${apiUrl}/calculation/BS/lv3/${docPath}/fetch/?client_id=${encodeURIComponent(clientId)}`;
          } else if (docLower === "s&m" || docLower === "g&a") {
             url = `${apiUrl}/calculation/lv3/${endpoint}/fetch?client_id=${encodeURIComponent(clientId)}&document=${encodeURIComponent(cat)}`;
          } else {
             url = `${apiUrl}/calculation/lv3/${endpoint}/fetch?client_id=${encodeURIComponent(clientId)}`;
          }

          const res = await fetch(url, { headers: { Accept: "application/json" } });
          if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
          const json = await res.json();
          
          // Normalize Level 3 Data
          // Level 3 data has structure: { historical: {...}, forecasted: {...} }
          // We need to extract based on viewMode
          let rawDataForView = {};
          if (viewMode === 'Forecasted') {
              rawDataForView = json.forecasted || {};
          } else {
              rawDataForView = json.historical || {};
          }

          // We need to normalize this similarly to standard data for our charts
          // Extract items that have param_name
          const normalized = {};
          Object.entries(rawDataForView).forEach(([key, value]) => {
                if (key !== 'param_name' && value && typeof value === 'object' && value.param_name) {
                     normalized[key] = {
                         ...value,
                         param_name: value.param_name
                     };
                }
          });

          setCachedData(globalKey, clientId, normalized);

          setLevel3Cache(prev => ({
              ...prev,
              [cat]: {
                  ...prev[cat],
                  [viewMode]: normalized // Cache by view mode
              }
          }));

      } catch (err) {
          console.error("Level 3 Fetch Error:", err);
          // Optional: show toast or error
      } finally {
          setIsLoadingLevel3(false);
      }
  };

  // Effect to fetch when category changes (and we are in Level 3)
  useEffect(() => {
      if (activeLevel === '3' && level3Category) {
          fetchLevel3Data(level3Category);
      }
  }, [activeLevel, level3Category, viewMode]);


  // --- Chart Building Logic ---


  // --- Chart Building Logic ---
  const currentData = cache[statementType][viewMode];

  // Derive available metrics for the dropdown
  const availableMetrics = useMemo(() => {
    // If Level 3, return metrics from the selected category
    if (activeLevel === '3') {
        if (!level3Category) return [];
        const data = level3Cache[level3Category]?.[viewMode];
        if (!data) return [];

        return Object.entries(data)
            .map(([key, value]) => ({
                key: key,
                label: value.param_name || key,
                // store origin to help data retrieval later if needed, though we flatten data for chart
                isLevel3: true,
                category: level3Category
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    // Default (Level 1/2/4 - currently leveraging main dataset for all non-3 levels as placeholder)
    // PROMPT: "Consider for now only Level 1" was previous instruction, but now we have dynamic levels.
    // For now, if Level 1, 2, 4, we use the main IS/BS data.
    // Ideally Level 2/4 might have different API endpoints too? 
    // Assuming for now Level 1/2/4 share the main dataset or are filtered by a property we don't have yet.
    // User only specified Level 3 details. So we keep `currentData` for others.
    
    // FILTER: Only show metrics if activeLevel matches? 
    // Since we don't have explicit "level" tags in `currentData`, we just return all for 1,2,4 
    // OR we could try to filter if we knew how.
    // Reverting to: logic used in previous step -> "matchLevel = activeLevel === '1'" was used inside MetricSelector.
    // But now MetricSelector doesn't filter by level logic, WE pass the metrics.
    
    // For this step, if user selects Level 1, we show IS/BS data.
    // If they select Level 4, we show IS/BS data (as before).
    if (!currentData) return [];
    return Object.entries(currentData)
        .filter(([key, value]) => value && value.param_name)
        .map(([key, value]) => ({
            key: key,
            label: value.param_name || key
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

  }, [currentData, activeLevel, level3Category, level3Cache, viewMode]);

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
     // Need access to both currentData and level3Cache
     const findMetricData = (k) => {
         if (currentData && currentData[k]) return currentData[k];
         for (const cat of Object.keys(level3Cache)) {
             const catData = level3Cache[cat]?.[viewMode];
             if (catData && catData[k]) return catData[k];
         }
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

  }, [currentData, selectedMetrics, level3Cache, viewMode]);


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
                                    // New Props
                                    activeLevel={activeLevel}
                                    onLevelChange={setActiveLevel}
                                    level3Categories={LEVEL3_CATEGORIES}
                                    selectedLevel3Category={level3Category}
                                    onLevel3CategoryChange={setLevel3Category}
                                    isLoadingLevel3={isLoadingLevel3}
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
