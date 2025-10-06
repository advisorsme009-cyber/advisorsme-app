import React, { useState } from "react";
import {
  Button,
  CircularProgress,
  Box,
  Typography,
  Alert,
  Snackbar,
} from "@mui/material";
import { apiUrl } from "../hooks/api";

// Main App component
// eslint-disable-next-line react/prop-types
const ExportHistoricalButton = ({ clientId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  /**
   * Handles the export button click.
   * Fetches data from the API and triggers a file download.
   */
  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/export/historical/${clientId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get("content-disposition");
      let filename = "combined_tables.xlsx"; // Default filename
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL object
      window.URL.revokeObjectURL(url);

      setSnackbarOpen(true);
    } catch (e) {
      console.error("Download failed:", e);
      setError("Failed to download the file. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <Box>
      <Button
        variant="contained"
        onClick={handleExport}
        disabled={loading}
        sx={{
          width: 250, // Keep button width consistent
          height: 50, // Keep button height consistent
          position: "relative",
        }}
      >
        {loading ? (
          <CircularProgress
            size={24}
            sx={{
              color: "white",
              position: "absolute",
              top: "50%",
              left: "50%",
              marginTop: "-12px",
              marginLeft: "-12px",
            }}
          />
        ) : (
          "Export Historical Data"
        )}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        message="File download started!"
      />
    </Box>
  );
};

export default ExportHistoricalButton;
