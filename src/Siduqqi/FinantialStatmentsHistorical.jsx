import React, { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Paper,
} from "@mui/material";
import { styled } from "@mui/system";
import { apiUrl } from "./hooks/api";
import ExportHistoricalButton from "./utils/ExportHistoricalButton";

const StyledTableContainer = styled("div")({
  "&, & *, & *::before, & *::after": {
    color: "#000 !important",
  },
  "& table": {
    borderCollapse: "collapse",
    width: "100%",
    marginBottom: "1rem",
    fontSize: "0.9em",
  },
  "& th, & td": {
    border: "1px solid #e2e8f0",
    padding: "10px",
    textAlign: "left",
  },
  "& tr:nth-of-type(even)": {
    backgroundColor: "#f7fafc",
  },
});

const FinancialStatementsHistorical = () => {
  // State to hold the client ID from the input field
  const [clientId, setClientId] = useState("pwc-test-123456");
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
      } else {
        throw new Error("No historical table found in the response.");
      }
    } catch (err) {
      // Catch and set any errors that occurred during the fetch
      console.error("Fetch error:", err);
      setError(`Failed to fetch data: ${err.message}`);
    } finally {
      // Always set loading to false, regardless of success or failure
      setIsLoading(false);
    }
  };

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

        <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
          <TextField
            fullWidth
            label="Enter Client ID"
            variant="outlined"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
          <Button
            variant="contained"
            onClick={fetchHistoricalData}
            disabled={isLoading || clientId.length === 0}
            sx={{ minWidth: "120px" }}
          >
            {isLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Fetch Data"
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
                <StyledTableContainer sx={{ mt: 4 }}>
                  <div dangerouslySetInnerHTML={{ __html: html.historical }} />
                </StyledTableContainer>
              </Paper>
            </Box>
          ))}
      </Paper>
    </Box>
  );
};

export default FinancialStatementsHistorical;
