import React, { useState, useEffect } from "react";
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Box,
  MenuItem,
} from "@mui/material";
import { ThemeProvider } from "@emotion/react";
import LinkedinAITheme from "../LinkedinAI/style/LinkedinAITheme";
import { apiUrl } from "./hooks/api";

// Function to format numbers with commas
const formatNumber = (num) => {
  if (num === null || num === undefined) return "";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const API_BASE_URL = `${apiUrl}/calculation/lv3/`;
const CLIENT_ID = "pwc-test-123456";

const ForecastingCalculationLv3 = () => {
  const [data, setData] = useState(null);
  const [inputValues, setInputValues] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState("S&M");

  const fetchData = async (documentType) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/sm_ga/fetch?client_id=${CLIENT_ID}&document=${encodeURIComponent(
          documentType
        )}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const fetchedData = await response.json();
      setData(fetchedData);

      // Populate input values from fetched data, specifically the growth percentages
      const newValues = {};
      Object.keys(fetchedData).forEach((category) => {
        newValues[category] = {};
        Object.keys(fetchedData[category]).forEach((paramKey) => {
          newValues[category][paramKey] = {
            ...fetchedData[category][paramKey].growth_percentages,
          };
        });
      });
      setInputValues(newValues);
    } catch (e) {
      console.error("Failed to fetch data:", e);
      setError(
        "Failed to fetch data. Please check the API endpoint and network connection."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch for default document
    fetchData(selectedDocument);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (category, paramKey, year) => (event) => {
    const value = event.target.value;
    setInputValues((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [paramKey]: {
          ...prev[category][paramKey],
          [year]: parseFloat(value) || 0,
        },
      },
    }));
  };

  const handleRecalculate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const forecasted_lv3 = Object.entries(inputValues).map(
        ([category, params]) => ({
          category,
          data: Object.entries(params).map(([paramKey, growthPercentages]) => ({
            param_name: data[category][paramKey].param_name,
            growth_percentages: growthPercentages,
          })),
        })
      );

      const payload = {
        client_id: CLIENT_ID,
        document: selectedDocument,
        historical_lv3: {},
        forecasted_lv3,
      };

      const response = await fetch(`${API_BASE_URL}/sm_ga/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // After successful update, re-fetch data to get the new calculated values
      await fetchData();
    } catch (e) {
      console.error("Failed to update data:", e);
      setError(
        "Failed to update data. Please check the API endpoint and payload structure."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !data) {
    return (
      <Box className="flex items-center justify-center min-h-screen">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Container
        maxWidth="xl"
        className="py-8 bg-gray-50 min-h-screen font-sans"
      >
        <Typography
          variant="h3"
          component="h1"
          gutterBottom
          className="text-center font-bold text-gray-800 mb-8"
        >
          Financial Data Dashboard
        </Typography>
        <Box className="flex flex-wrap items-center justify-center gap-4 mb-6">
          <TextField
            select
            label="Document"
            value={selectedDocument}
            onChange={(e) => setSelectedDocument(e.target.value)}
            variant="outlined"
            size="small"
          >
            <MenuItem value="S&M">S&amp;M</MenuItem>
            <MenuItem value="G&A">G&amp;A</MenuItem>
          </TextField>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => fetchData(selectedDocument)}
            disabled={isLoading}
            className="rounded-full"
          >
            {isLoading ? "Fetching..." : "Fetch"}
          </Button>
        </Box>
        {error && (
          <Alert severity="error" className="mb-4">
            {error}
          </Alert>
        )}
        <Grid container spacing={4}>
          {data &&
            Object.keys(data).map((category) => (
              <Grid item xs={12} md={6} key={category}>
                <Typography
                  variant="h5"
                  component="h2"
                  gutterBottom
                  className="font-semibold text-gray-700"
                >
                  {category.toUpperCase()}
                </Typography>
                <Grid container spacing={2}>
                  {Object.keys(data[category]).map((paramKey) => (
                    <Grid item xs={12} key={paramKey}>
                      <Card className="rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                        <CardContent>
                          <Typography
                            variant="h6"
                            component="h3"
                            className="font-medium text-gray-900 mb-2"
                          >
                            {data[category][paramKey].param_name}
                          </Typography>
                          <Grid container spacing={2}>
                            {Object.keys(
                              data[category][paramKey].growth_percentages
                            ).map((year) => {
                              return (
                                <Grid item xs={6} sm={4} key={year}>
                                  <TextField
                                    label={`Growth % (${year})`}
                                    type="number"
                                    variant="outlined"
                                    fullWidth
                                    value={
                                      inputValues[category]?.[paramKey]?.[
                                        year
                                      ] ?? ""
                                    }
                                    onChange={handleInputChange(
                                      category,
                                      paramKey,
                                      year
                                    )}
                                    InputProps={{
                                      endAdornment: (
                                        <Typography
                                          variant="body2"
                                          className="text-gray-500"
                                        >
                                          %
                                        </Typography>
                                      ),
                                    }}
                                  />
                                </Grid>
                              );
                            })}
                          </Grid>
                          <Box className="mt-4 border-t pt-4 border-gray-200">
                            <Grid container spacing={2}>
                              {Object.keys(data[category][paramKey])
                                .filter((key) => !isNaN(key))
                                .map((year) => (
                                  <Grid item xs={6} sm={4} key={year}>
                                    <Card
                                      variant="outlined"
                                      className="bg-gray-100 rounded-md"
                                    >
                                      <CardContent className="p-2">
                                        <Typography
                                          variant="subtitle2"
                                          className="text-gray-500"
                                        >
                                          {year}
                                        </Typography>
                                        <Typography
                                          variant="body1"
                                          className="font-bold text-gray-800"
                                        >
                                          {formatNumber(
                                            data[category][paramKey][year]
                                          )}
                                        </Typography>
                                      </CardContent>
                                    </Card>
                                  </Grid>
                                ))}
                            </Grid>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            ))}
        </Grid>
        <Box className="text-center mt-8">
          <Button
            variant="contained"
            color="primary"
            onClick={handleRecalculate}
            disabled={isLoading}
            className="rounded-full shadow-md hover:shadow-lg transition-shadow"
            startIcon={
              isLoading ? <CircularProgress size={20} color="inherit" /> : null
            }
          >
            {isLoading ? "Recalculating..." : "Recalculate"}
          </Button>
        </Box>
      </Container>
    </ThemeProvider>
  );
};

export default ForecastingCalculationLv3;
