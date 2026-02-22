import React, { useState, useEffect } from "react";
import {
  Button,
  Box,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Paper,
  Typography,
  Stack,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import LinkedinAITheme from "../LinkedinAI/style/LinkedinAITheme";
import { apiUrl } from "./hooks/api";
import CorporateFinancialTableView from "./utils/CorporateFinancialTableView";
import CorporateEditableTable from "./utils/CorporateEditableTable";
import { useSettings } from "./context/SettingsContext";

const ForecastingCalculationLv1 = () => {
  const { clientId, getCachedData, setCachedData } = useSettings();
  const [data, setData] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const initFormData = (jsonData) => {
    const extractedParams = jsonData.extracted_param?.["IS-CON"] || {};
    const assumptions = jsonData.assumptions || {};
    const initialFormData = {};

    for (const paramKey in extractedParams) {
      const param = extractedParams[paramKey];
      for (const year in param) {
        if (year !== "param_name") {
          initialFormData[`extracted_param.${paramKey}.${year}`] = param[year];
        }
      }
    }
    for (const paramKey in assumptions) {
      const param = assumptions[paramKey];
      for (const year in param) {
        if (year !== "param_name") {
          initialFormData[`assumptions.${paramKey}.${year}`] = param[year];
        }
      }
    }
    setFormData(initialFormData);
  };

  const fetchData = async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiUrl}/calculation/lv1/revenue/create?client_id=${encodeURIComponent(clientId)}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const jsonData = await response.json();
      setData(jsonData);
      setCachedData("forecastingLv1", clientId, jsonData);
      initFormData(jsonData);
    } catch (e) {
      console.error("Failed to fetch data:", e);
      setError("Failed to fetch data. Please check the API server.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (!isNaN(value) || value === "" || value === "-" || value === ".") {
      setFormData((prev) => ({
        ...prev,
        [name]: value === "" || value === "-" ? null : parseFloat(value),
      }));
    }
  };

  const handleRecalculate = async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);

    const payload = {
      client_id: clientId,
      extracted_params: {},
      assumptions: {},
    };

    for (const key in formData) {
      const value = formData[key];
      const parts = key.split(".");
      const category = parts[0];
      const paramName = parts[1];
      const year = parts[2];

      if (category === "extracted_param") {
        if (!payload.extracted_params["IS-CON"]) {
          payload.extracted_params["IS-CON"] = {};
        }
        if (!payload.extracted_params["IS-CON"][paramName]) {
          payload.extracted_params["IS-CON"][paramName] = {
            param_name: data.extracted_param["IS-CON"][paramName]?.param_name,
          };
        }
        payload.extracted_params["IS-CON"][paramName][year] = value;
      } else if (category === "assumptions") {
        if (!payload.assumptions[paramName]) {
          payload.assumptions[paramName] = {
            param_name: data.assumptions[paramName]?.param_name,
          };
        }
        payload.assumptions[paramName][year] = value;
      }
    }

    try {
      const response = await fetch(
        `${apiUrl}/calculation/lv1/revenue/update/`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updateResult = await response.json();
      if (updateResult.status === "success") {
        await fetchData();
      } else {
        throw new Error("Update failed. Server response status not success.");
      }
    } catch (e) {
      console.error("Failed to update data:", e);
      setError("Failed to update data. Please check the API server and data format.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      const cached = getCachedData("forecastingLv1", clientId);
      if (cached) {
        setData(cached);
        initFormData(cached);
      } else {
        fetchData();
      }
    }
  }, [clientId]);


  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ width: '100%', p: 3, bgcolor: '#F5F6F8', minHeight: '100vh' }}>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 500, color: '#333' }}>
            Forecasting Calculations (LV1)
          </Typography>
          
          <Stack direction="row" spacing={2}>
             <Button
                variant="outlined"
                onClick={fetchData}
                disabled={loading || !clientId}
                sx={{ bgcolor: 'white' }}
             >
                Refresh
             </Button>
             <Button
                variant="contained"
                onClick={handleRecalculate}
                disabled={loading || !data || !clientId}
                sx={{ bgcolor: '#1F559B', '&:hover': { bgcolor: '#163C6E' } }}
             >
                {loading ? <CircularProgress size={24} color="inherit" /> : "Recalculate"}
             </Button>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, bgcolor: 'white', borderRadius: 1 }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange} 
            sx={{
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, fontSize: '0.95rem' },
              '& .Mui-selected': { color: '#1976d2' }
            }}
          >
            <Tab label="Assumptions" />
            <Tab label="Calculations (LV1)" />
            <Tab label="Extracted Parameters" />
          </Tabs>
        </Box>

        <Paper elevation={0} sx={{ p: 3, borderRadius: 2 }}>
          {loading && !data ? (
             <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                <CircularProgress />
             </Box>
          ) : !data ? (
             <Typography variant="body1" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                No data available. Please provide a valid Client ID.
             </Typography>
          ) : (
            <>
              {activeTab === 0 && (
                 <CorporateEditableTable 
                    title="Assumptions"
                    data={data.assumptions || {}}
                    sectionKey="assumptions"
                    formData={formData}
                    onInputChange={handleInputChange}
                 />
              )}
              {activeTab === 1 && (
                 <CorporateFinancialTableView 
                    title="Calculations (LV1)"
                    data={data.calculation_lv1 || {}}
                 />
              )}
              {activeTab === 2 && (
                 <CorporateEditableTable 
                    title="Extracted Parameters"
                    data={(data.extracted_param && data.extracted_param["IS-CON"]) || {}}
                    sectionKey="extracted_param"
                    formData={formData}
                    onInputChange={handleInputChange}
                 />
              )}
            </>
          )}
        </Paper>

      </Box>
    </ThemeProvider>
  );
};

export default ForecastingCalculationLv1;
