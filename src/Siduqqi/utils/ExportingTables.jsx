/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { Button, CircularProgress, Box, Typography } from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { apiUrl } from "../hooks/api";

const ExcelDownloadButton = ({ jsonData, text = "Export tables to Excel" }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null); // Clear any previous errors

    try {
      const response = await fetch(`${apiUrl}/generate-excel/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jsonData), // Send your JSON data here
      });

      console.log(JSON.stringify(jsonData));

      if (!response.ok) {
        // Attempt to parse error message from server
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate Excel file");
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "all_tables.xlsx"; // Default filename
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      // Create a blob from the response
      const blob = await response.blob();

      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link element
      const a = document.createElement("a");
      a.href = url;
      a.download = filename; // Set the download filename
      document.body.appendChild(a); // Append to body to make it clickable

      // Programmatically click the link to trigger download
      a.click();

      // Clean up by revoking the object URL and removing the link
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download error:", err);
      setError(err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <Button
        variant="contained"
        onClick={handleDownload}
        disabled={isDownloading}
        startIcon={
          isDownloading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <FileDownloadIcon />
          )
        }
      >
        {isDownloading ? "Downloading..." : text}
      </Button>
      {error && (
        <Typography color="error" variant="body2">
          Error: {error}
        </Typography>
      )}
    </Box>
  );
};

export default ExcelDownloadButton;
