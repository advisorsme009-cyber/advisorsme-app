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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import LinkedinAITheme from "../LinkedinAI/style/LinkedinAITheme";
import { apiUrl } from "./hooks/api";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DescriptionIcon from "@mui/icons-material/Description";
import PersonIcon from "@mui/icons-material/Person";
import TableChartIcon from "@mui/icons-material/TableChart";
import { useSettings } from "./context/SettingsContext";
import useEngineExport from "./hooks/useEngineExport";

const ENGINE_MODULES = [
  { key: "all", label: "All Modules" },
  { key: "IS-CON", label: "Income Statement" },
  { key: "BS", label: "Balance Sheet" },
  { key: "CF", label: "Cash Flow" },
  { key: "S&M", label: "Sales & Marketing" },
  { key: "G&A", label: "General & Admin" },
  { key: "FA", label: "Fixed Assets" },
  { key: "WC", label: "Working Capital" },
  { key: "DEBT", label: "Debt" },
  { key: "equity", label: "Equity" },
  { key: "eosp", label: "EOSP" },
];

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
  const { clientId } = useSettings();
  const [splitSheets, setSplitSheets] = useState(false);
  const [isExportingYearByYear, setIsExportingYearByYear] = useState(false);
  const [isExportingHistorical, setIsExportingHistorical] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState("all");
  const { exportModule, exportAll, exporting, error: engineError, setError: setEngineError } = useEngineExport();

  const handleEngineExport = async () => {
    if (!clientId.trim()) {
      setError("Please enter a Client ID");
      return;
    }
    try {
      if (selectedModule === "all") {
        await exportAll(clientId.trim());
      } else {
        await exportModule(clientId.trim(), selectedModule);
      }
      const label = ENGINE_MODULES.find((m) => m.key === selectedModule)?.label || selectedModule;
      setSuccessMessage(`${label} export downloaded successfully!`);
      setSnackbarOpen(true);
    } catch {
      // error is already set by the hook
    }
  };

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
          {/* Engine Export Section */}
          <Grid item xs={12}>
            <Divider sx={{ my: 3 }} />
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
              Financial Model (Engine)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Export from the forecasting engine — includes historical and forecast data with formatted Excel.
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Card
              elevation={3}
              sx={{
                display: "flex",
                flexDirection: "column",
                borderRadius: 2,
              }}
            >
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <TableChartIcon
                    sx={{ fontSize: 32, color: "primary.main", mr: 1 }}
                  />
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Financial Model Export
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  Export engine-calculated financial model data as a formatted Excel workbook.
                  Choose a specific module or export all modules into a multi-sheet workbook.
                </Typography>

                {(engineError) && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEngineError(null)}>
                    {engineError}
                  </Alert>
                )}

                <Box sx={{ display: "flex", gap: 2, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <FormControl sx={{ minWidth: 240 }} size="medium">
                    <InputLabel>Module</InputLabel>
                    <Select
                      value={selectedModule}
                      label="Module"
                      onChange={(e) => setSelectedModule(e.target.value)}
                    >
                      {ENGINE_MODULES.map((m) => (
                        <MenuItem key={m.key} value={m.key}>
                          {m.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleEngineExport}
                    disabled={!!exporting || !clientId.trim()}
                    startIcon={
                      exporting ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        <FileDownloadIcon />
                      )
                    }
                    sx={{
                      py: 1.5,
                      px: 4,
                      fontWeight: 600,
                      bgcolor: "#1F559B",
                      "&:hover": { bgcolor: "#163C6E" },
                    }}
                  >
                    {exporting
                      ? "Exporting..."
                      : selectedModule === "all"
                      ? "Export All Modules"
                      : `Export ${ENGINE_MODULES.find((m) => m.key === selectedModule)?.label}`}
                  </Button>
                </Box>
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
