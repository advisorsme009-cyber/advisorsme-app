import React, { useState, useEffect } from "react";
import {
  Container,
  TextField,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Paper,
  CssBaseline,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import TablesUI from "./utils/TableView";
import { apiUrl } from "./hooks/api";
import ExcelDownloadButton from "./utils/ExportingTables";
import { useSettings } from "./context/SettingsContext";

const theme = createTheme({
  palette: {
    primary: {
      main: "#FF9800", // Orange for primary actions
    },
    secondary: {
      main: "#000000", // Black for text
    },
    text: {
      primary: "#000000",
    },
  },
  typography: {
    fontFamily: "Roboto, sans-serif",
    h3: {
      fontWeight: 700,
      color: "#000000",
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiTab: {
      styleOverrides: {
        root: {
          color: "#000000",
          "&.Mui-selected": {
            color: "#FF9800",
          },
        },
      },
    },
  },
});

const FinancialStatementComponent = () => {
  const { clientId, getCachedData, setCachedData } = useSettings();
  const [statementData, setStatementData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState(0);

  const handleFetchStatements = async () => {
    setLoading(true);
    setError("");
    setStatementData(null);

    try {
      const response = await fetch(`${apiUrl}/statements/${clientId}`, {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch data. Please check the Client ID.");
      }

      const data = await response.json();
      setStatementData(data);
      setCachedData("statements", clientId, data);
      setSelectedTab(0); // Reset to the first tab on new data
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      const cached = getCachedData("statements", clientId);
      if (cached) {
        setStatementData(cached);
        setSelectedTab(0);
      } else {
        handleFetchStatements();
      }
    }
  }, [clientId]);

  const years = statementData
    ? Object.keys(statementData).sort((a, b) => b - a)
    : [];
  const currentTables =
    years.length > 0 ? statementData[years[selectedTab]] : [];

  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth={false} sx={{ mt: 5, mb: 5 }}>
        <Paper elevation={4} sx={{ p: 4, borderRadius: "15px" }}>
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography variant="h3" gutterBottom>
              Financial Statement Viewer 📊
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Enter a Client ID to retrieve and view financial statements.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 4, justifyContent: "center" }}>
            <Button
              variant="contained"
              onClick={handleFetchStatements}
              disabled={loading || !clientId}
              sx={{
                height: "56px",
                fontWeight: "bold",
                borderRadius: "10px",
                px: 4
              }}
            >
              Refresh Data
            </Button>
          </Box>
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", my: 3 }}>
              <CircularProgress />
            </Box>
          )}
          {error && (
            <Alert severity="error" sx={{ my: 3, borderRadius: "10px" }}>
              {error}
            </Alert>
          )}
          {currentTables.length > 0 && (
            <Box sx={{ my: 4, display: "flex", justifyContent: "end" }}>
              <ExcelDownloadButton
                text={`Extract Current year to Excel`}
                jsonData={currentTables}
              />
            </Box>
          )}
          {statementData && years.length > 0 && (
            <Box sx={{ width: "100%" }}>
              <Tabs
                value={selectedTab}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  borderBottom: 1,
                  borderColor: "divider",
                  ".MuiTabs-indicator": {
                    backgroundColor: "#FF9800",
                  },
                }}
              >
                {years.map((year, index) => (
                  <Tab
                    key={year}
                    label={year}
                    sx={{ textTransform: "none", fontWeight: "bold" }}
                  />
                ))}
              </Tabs>
              <TablesUI tables={currentTables} pages={[]} />
            </Box>
          )}
        </Paper>
      </Container>
    </ThemeProvider>
  );
};

export default FinancialStatementComponent;
