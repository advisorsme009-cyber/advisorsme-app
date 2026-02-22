import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Paper,
} from "@mui/material";
import { apiUrl } from "./hooks/api";
import ExportHistoricalButton from "./utils/ExportHistoricalButton";
import StyledHtmlTable from "./utils/StyledHtmlTable";
import { useSettings } from "./context/SettingsContext";



const FinancialStatementsHistorical = () => {
  const { clientId, getCachedData, setCachedData } = useSettings();
  // State to hold the HTML content fetched from the API
  const [htmlContents, setHtmlContents] = useState([]);
  // State to manage the loading status
  const [isLoading, setIsLoading] = useState(false);
  // State to store any error messages
  const [error, setError] = useState("");

  // Function to fetch the historical data from the API
  const fetchHistoricalData = async () => {
    // Clear previous results and set loading state
    setHtmlContents([]);
    setError("");
    setIsLoading(true);

    try {
      // Construct the API URL with the client ID

      // Make the GET request to the API
      const response = await fetch(
        `${apiUrl}/historical/fetch/firestore/${clientId}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      // Check if the response was successful
      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }

      // Parse the JSON response
      const result = await response.json();
      console.log(result);

      // Check if the 'table_english' key exists and has content
      if (result) {
        setHtmlContents(result);
        setCachedData("historical", clientId, result);
      } else {
        throw new Error("No historical table found in the response.");
      }
    } catch (err) {
      // Catch and set any errors that occurred during the fetch
      console.error("Fetch error:", err);
      setError(`Failed to fetch data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      const cached = getCachedData("historical", clientId);
      if (cached) {
        setHtmlContents(cached);
      } else {
        fetchHistoricalData();
      }
    }
  }, [clientId]);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#f0f2f5",
        p: 3,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 4,
          borderRadius: 2,
          maxWidth: "100%",
          width: "100%",
        }}
      >
        <Typography
          color="black"
          variant="h4"
          component="h1"
          gutterBottom
          align="center"
        >
          Historical Statements
        </Typography>

        <Box sx={{ display: "flex", gap: 2, mb: 3, justifyContent: "center" }}>
          <Button
            variant="contained"
            onClick={fetchHistoricalData}
            disabled={isLoading || !clientId}
            sx={{ minWidth: "120px", px: 4 }}
          >
            {isLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Refresh Data"
            )}
          </Button>
        </Box>

        {/* Conditional rendering for loading, error, or content */}
        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Typography color="error" align="center" sx={{ mt: 4 }}>
            {error}
          </Typography>
        )}

        {htmlContents.length !== 0 && (
          <Box sx={{ my: 4, display: "flex", justifyContent: "end" }}>
            <ExportHistoricalButton clientId={clientId} />
          </Box>
        )}

        {htmlContents.length !== 0 &&
          htmlContents.map((html, idx) => (
            <Box key={idx}>
              <Paper>
                <StyledHtmlTable html={html.historical} />
              </Paper>
            </Box>
          ))}
      </Paper>
    </Box>
  );
};

export default FinancialStatementsHistorical;
