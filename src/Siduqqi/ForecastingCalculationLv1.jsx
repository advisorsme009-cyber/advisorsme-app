import React, { useState, useEffect } from "react";
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Typography,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { ThemeProvider } from "@emotion/react";
import LinkedinAITheme from "../LinkedinAI/style/LinkedinAITheme";
import { apiUrl } from "./hooks/api";

// The main App component
const ForecastingCalculationLv1 = () => {
  const [data, setData] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState("panel1"); // State to manage which accordion is expanded

  const API_BASE_URL = "http://127.0.0.1:8000";
  const CLIENT_ID = "pwc-test-123456";

  // Function to handle accordion expansion
  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  // Function to fetch data from the API
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiUrl}/calculation/lv1/revenue/create?client_id=${CLIENT_ID}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const jsonData = await response.json();
      setData(jsonData);

      // Initialize form data with mutable values from the API response
      const extractedParams = jsonData.extracted_param["IS-CON"];
      const assumptions = jsonData.assumptions;

      const initialFormData = {};

      // Flatten the nested extracted_param object into a single key-value map
      for (const paramKey in extractedParams) {
        const param = extractedParams[paramKey];
        for (const year in param) {
          if (year !== "param_name") {
            initialFormData[`extracted_param.${paramKey}.${year}`] =
              param[year];
          }
        }
      }

      // Flatten the nested assumptions object
      for (const paramKey in assumptions) {
        const param = assumptions[paramKey];
        for (const year in param) {
          if (year !== "param_name") {
            initialFormData[`assumptions.${paramKey}.${year}`] = param[year];
          }
        }
      }

      setFormData(initialFormData);
    } catch (e) {
      console.error("Failed to fetch data:", e);
      setError("Failed to fetch data. Please check the API server.");
    } finally {
      setLoading(false);
    }
  };

  // Function to handle changes in the input fields
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Simple validation to ensure only numbers are entered
    if (!isNaN(value) || value === "" || value === "-" || value === ".") {
      setFormData((prev) => ({
        ...prev,
        [name]: value === "" || value === "-" ? null : parseFloat(value),
      }));
    }
  };

  // Function to handle the recalculate button click
  const handleRecalculate = async () => {
    setLoading(true);
    setError(null);

    // Reconstruct the nested payload from the flattened formData state
    const payload = {
      client_id: CLIENT_ID,
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
            param_name: data.extracted_param["IS-CON"][paramName].param_name,
          };
        }
        payload.extracted_params["IS-CON"][paramName][year] = value;
      } else if (category === "assumptions") {
        if (!payload.assumptions[paramName]) {
          payload.assumptions[paramName] = {
            param_name: data.assumptions[paramName].param_name,
          };
        }
        payload.assumptions[paramName][year] = value;
      }
    }

    console.log(payload);
    try {
      // The user's curl command showed a GET with a body, which is unconventional.
      // This implementation uses a POST request, which is standard for an update operation.
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
        // If the update is successful, re-fetch the new calculated data
        await fetchData();
      } else {
        throw new Error("Update failed. Server response status not success.");
      }
    } catch (e) {
      console.error("Failed to update data:", e);
      setError(
        "Failed to update data. Please check the API server and data format."
      );
    } finally {
      setLoading(false);
    }
  };

  // Call fetchData on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Helper function to render a section of the data as read-only values
  const renderCalculationSection = (title, sectionData, panelName) => (
    <Accordion
      expanded={expanded === panelName}
      onChange={handleChange(panelName)}
      elevation={3}
      sx={{ borderRadius: "12px", mb: 4 }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={`${panelName}-content`}
        id={`${panelName}-header`}
      >
        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={2}>
          {Object.entries(sectionData).map(([key, years]) => (
            <Grid item xs={12} key={key}>
              <Typography variant="body1" sx={{ fontWeight: "medium", mb: 1 }}>
                {key}
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(years).map(([year, value]) => (
                  <Grid item xs={6} sm={4} md={2.4} key={year}>
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      sx={{ mb: 0.5 }}
                    >
                      {year}
                    </Typography>
                    <Box
                      sx={{
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        p: 1.5,
                        backgroundColor: "#f5f5f5",
                        textAlign: "center",
                      }}
                    >
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: "bold" }}
                      >
                        {typeof value === "number"
                          ? `$${value.toFixed(2).toLocaleString()}`
                          : "N/A"}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Divider sx={{ my: 2 }} />
            </Grid>
          ))}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );

  // Helper function to render a section with editable text fields
  const renderEditableSection = (title, sectionData, sectionKey, panelName) => (
    <Accordion
      expanded={expanded === panelName}
      onChange={handleChange(panelName)}
      elevation={3}
      sx={{ borderRadius: "12px", mb: 4 }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={`${panelName}-content`}
        id={`${panelName}-header`}
      >
        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={3}>
          {Object.entries(sectionData).map(([paramKey, param]) => (
            <Grid item xs={12} key={paramKey}>
              <Typography variant="body1" sx={{ fontWeight: "medium", mb: 2 }}>
                {param.param_name}
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(param).map(
                  ([year, value]) =>
                    year !== "param_name" && (
                      <Grid item xs={6} sm={4} md={2.4} key={year}>
                        <TextField
                          fullWidth
                          label={year}
                          type="number"
                          name={`${sectionKey}.${paramKey}.${year}`}
                          value={
                            formData[`${sectionKey}.${paramKey}.${year}`] ?? ""
                          }
                          onChange={handleInputChange}
                          variant="outlined"
                          size="small"
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              borderRadius: "8px",
                            },
                          }}
                        />
                      </Grid>
                    )
                )}
              </Grid>
              <Divider sx={{ my: 2 }} />
            </Grid>
          ))}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Container
        maxWidth={false}
        sx={{ mt: 4, mb: 4, fontFamily: "Inter, sans-serif" }}
      >
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          align="center"
          sx={{ fontWeight: "bold", mb: 4, color: "#3f51b5" }}
        >
          Financial Calculation Dashboard
        </Typography>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Box sx={{ py: 5 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {!loading && !error && data && (
          <Box>
            {/* Section 1: Editable Assumptions */}
            {renderEditableSection(
              "Assumptions",
              data.assumptions,
              "assumptions",
              "panel2"
            )}
            {/* Section 2: Read-only Calculation Results */}
            {renderCalculationSection(
              "Calculations (LV1)",
              data.calculation_lv1,
              "panel1"
            )}

            {/* Section 3: Editable Extracted Parameters */}
            {renderEditableSection(
              "Extracted Parameters",
              data.extracted_param["IS-CON"],
              "extracted_param",
              "panel3"
            )}

            <Box sx={{ textAlign: "center", mt: 4 }}>
              <Button
                variant="contained"
                size="large"
                sx={{
                  borderRadius: "50px",
                  px: 5,
                  py: 1.5,
                  fontWeight: "bold",
                  backgroundColor: "#3f51b5",
                  "&:hover": {
                    backgroundColor: "#303f9f",
                  },
                }}
                onClick={handleRecalculate}
              >
                Recalculate
              </Button>
            </Box>
          </Box>
        )}
      </Container>
    </ThemeProvider>
  );
};

export default ForecastingCalculationLv1;
