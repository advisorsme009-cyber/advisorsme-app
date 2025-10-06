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

// eslint-disable-next-line react/prop-types
const ExportCsvTableButton = ({ csvString, filename = "document.xlsx" }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  /**
   * Handles the export button click.
   * Sends the HTML content in the request body and triggers an Excel file download.
   */
  const handleExport = async () => {
    if (!csvString) {
      setError("No HTML content provided to export.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/export/html`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ csv_string: csvString }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
          width: 250,
          height: 50,
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
          "Export to Excel"
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

export default ExportCsvTableButton;
