import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Container,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  Snackbar,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import LinkedinAITheme from "../LinkedinAI/style/LinkedinAITheme";
import { apiUrl } from "./hooks/api";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DescriptionIcon from "@mui/icons-material/Description";
import PersonIcon from "@mui/icons-material/Person";

// Create a theme override that fixes the transparent background issue
const exportManagerTheme = createTheme({
  ...LinkedinAITheme,
  palette: {
    ...LinkedinAITheme.palette,
    background: {
      default: "#f5f5f5",
      paper: "rgba(255,255,255,0.8)",
    },
  },
});

const ExportManager = () => {
  const [clientId, setClientId] = useState("");
  const [splitSheets, setSplitSheets] = useState(false);
  const [isExportingYearByYear, setIsExportingYearByYear] = useState(false);
  const [isExportingHistorical, setIsExportingHistorical] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const handleDownloadFile = async (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const extractFilename = (contentDisposition, defaultName) => {
    if (!contentDisposition) return defaultName;
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    return filenameMatch ? filenameMatch[1] : defaultName;
  };

  const exportYearByYear = async () => {
    if (!clientId.trim()) {
      setError("Please enter a Client ID");
      return;
    }

    setError("");
    setIsExportingYearByYear(true);

    try {
      const response = await fetch(
        `${apiUrl}/export/statments/years?client_id=${encodeURIComponent(
          clientId.trim()
        )}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        }
      );

      if (!response.ok) {
        throw new Error(`Export failed with status: ${response.status}`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      const filename = extractFilename(
        contentDisposition,
        "financial_statements.xlsx"
      );

      await handleDownloadFile(blob, filename);
      setSuccessMessage("Year by Year export downloaded successfully!");
      setSnackbarOpen(true);
    } catch (err) {
      console.error("Export error:", err);
      setError(`Failed to export year by year data: ${err.message}`);
    } finally {
      setIsExportingYearByYear(false);
    }
  };

  const exportHistorical = async () => {
    if (!clientId.trim()) {
      setError("Please enter a Client ID");
      return;
    }

    setError("");
    setIsExportingHistorical(true);

    try {
      const response = await fetch(
        `${apiUrl}/export/new/historical/${encodeURIComponent(
          clientId.trim()
        )}?split_sheets=${splitSheets}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || `Export failed with status: ${response.status}`
        );
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      const filename = extractFilename(
        contentDisposition,
        "Financial_Statements.xlsx"
      );

      await handleDownloadFile(blob, filename);
      setSuccessMessage("Historical export downloaded successfully!");
      setSnackbarOpen(true);
    } catch (err) {
      console.error("Export error:", err);
      setError(`Failed to export historical data: ${err.message}`);
    } finally {
      setIsExportingHistorical(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <ThemeProvider theme={exportManagerTheme}>
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          py: 4,
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{ textAlign: "center", fontWeight: "bold", mb: 4 }}
          >
            Export Manager
          </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ textAlign: "center", mb: 4 }}
        >
          Export financial statements and historical data to Excel files
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {/* Client ID Input Card */}
        <Card
          elevation={3}
          sx={{
            mb: 4,
            borderRadius: 2,
            maxWidth: "100%",
          }}
        >
          <CardContent>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                mb: 2,
              }}
            >
              <PersonIcon
                sx={{ fontSize: 32, color: "primary.main", mr: 1 }}
              />
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Client ID
              </Typography>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 3 }}
            >
              Enter the client ID to enable export options
            </Typography>
            <TextField
              label="Client ID"
              variant="outlined"
              fullWidth
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Enter client ID (e.g., icts)"
              required
              sx={{
                "& .MuiOutlinedInput-root": {
                  fontSize: "1.1rem",
                },
              }}
            />
          </CardContent>
        </Card>

        <Grid container spacing={3}>
          {/* Year by Year Export Card */}
          <Grid item xs={12} md={6}>
            <Card
              elevation={3}
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    mb: 2,
                  }}
                >
                  <DescriptionIcon
                    sx={{ fontSize: 32, color: "primary.main", mr: 1 }}
                  />
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Year by Year Export
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  Export financial statements organized by year. Requires a
                  Client ID.
                </Typography>

                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={exportYearByYear}
                  disabled={isExportingYearByYear || !clientId.trim()}
                  startIcon={
                    isExportingYearByYear ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <FileDownloadIcon />
                    )
                  }
                  sx={{
                    py: 1.5,
                    fontWeight: 600,
                  }}
                >
                  {isExportingYearByYear
                    ? "Exporting..."
                    : "Export Year by Year"}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Historical Export Card */}
          <Grid item xs={12} md={6}>
            <Card
              elevation={3}
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    mb: 2,
                  }}
                >
                  <FileDownloadIcon
                    sx={{ fontSize: 32, color: "primary.main", mr: 1 }}
                  />
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Historical Export
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  Export all historical financial statements data. Choose whether
                  to split data into separate sheets.
                </Typography>

                <Box sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={splitSheets}
                        onChange={(e) => setSplitSheets(e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Typography variant="body2">
                        Split sheets by tabs:{" "}
                        <strong>{splitSheets ? "Yes" : "No"}</strong>
                      </Typography>
                    }
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1, ml: 4 }}
                  >
                    {splitSheets
                      ? "Data will be organized into separate tabs/sheets"
                      : "All data will be in a single sheet"}
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={exportHistorical}
                  disabled={isExportingHistorical || !clientId.trim()}
                  startIcon={
                    isExportingHistorical ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <FileDownloadIcon />
                    )
                  }
                  sx={{
                    py: 1.5,
                    fontWeight: 600,
                    bgcolor: "#2e7d32",
                    "&:hover": {
                      bgcolor: "#1b5e20",
                    },
                  }}
                >
                  {isExportingHistorical
                    ? "Exporting..."
                    : "Export Historical Data"}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
          message={successMessage}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        />
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default ExportManager;
