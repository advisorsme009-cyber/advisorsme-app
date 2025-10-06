import React, { useState } from "react";
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

const theme = createTheme({
  palette: {
    primary: { main: "#FF9800" },
    secondary: { main: "#000000" },
    text: { primary: "#000000" },
  },
  typography: {
    fontFamily: "Roboto, sans-serif",
    h3: { fontWeight: 700, color: "#000000" },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiTab: {
      styleOverrides: {
        root: {
          color: "#000000",
          "&.Mui-selected": { color: "#FF9800" },
        },
      },
    },
  },
});

function groupNotesByYear(arr) {
  // arr is the API array response
  return arr.reduce((acc, item) => {
    const y = String(item.statement_year ?? "Unknown");
    if (!acc[y]) acc[y] = [];
    acc[y].push({
      id: item.id,
      page_number: item.page_number,
      title_english: item.title_english,
      table_english: item.table_english,
      metadata: item.metadata,
      has_error: item.has_error,
      client_id: item.client_id,
    });
    return acc;
  }, {});
}

const FinancialStatementComponent = () => {
  const [clientId, setClientId] = useState("pwc-test-123456");
  const [year, setYear] = useState("2018");
  const [noteNumber, setNoteNumber] = useState("4");

  const [statementData, setStatementData] = useState(null); // { [year]: tables[] }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState(0);

  const handleFetchNotes = async () => {
    setLoading(true);
    setError("");
    setStatementData(null);

    try {
      const url = `${apiUrl}/notes/${encodeURIComponent(
        clientId.trim()
      )}/${encodeURIComponent(year.trim())}/${encodeURIComponent(
        noteNumber.trim()
      )}`;

      const response = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(
          "Failed to fetch note data. Please check Client ID, Year, and Note Number."
        );
      }

      const data = await response.json(); // expected: array
      if (!Array.isArray(data) || data.length === 0) {
        setStatementData({});
        setSelectedTab(0);
      } else {
        const grouped = groupNotesByYear(data);
        setStatementData(grouped);
        setSelectedTab(0);
      }
    } catch (err) {
      setError(err.message || "Unexpected error.");
    } finally {
      setLoading(false);
    }
  };

  const years = statementData
    ? Object.keys(statementData).sort(
        (a, b) => Number(b) - Number(a) // numeric desc
      )
    : [];

  const currentTables =
    years.length > 0 ? statementData[years[selectedTab]] : [];

  const handleTabChange = (_event, newValue) => setSelectedTab(newValue);

  const canFetch =
    Boolean(clientId.trim()) &&
    /^[0-9]{4}$/.test(year.trim()) &&
    Boolean(noteNumber.trim());

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ mt: 5, mb: 5 }}>
        <Paper elevation={4} sx={{ p: 4, borderRadius: "15px" }}>
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography variant="h3" gutterBottom>
              Financial Notes Viewer
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Enter Client ID, Year, and Note Number to retrieve note tables by
              year.
            </Typography>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 160px 160px 220px" },
              gap: 2,
              alignItems: "center",
              mb: 4,
            }}
          >
            <TextField
              label="Client ID"
              variant="outlined"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
            />
            <TextField
              label="Year"
              variant="outlined"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              inputProps={{
                inputMode: "numeric",
                pattern: "[0-9]*",
                maxLength: 4,
              }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
            />
            <TextField
              label="Note Number"
              variant="outlined"
              value={noteNumber}
              onChange={(e) => setNoteNumber(e.target.value)}
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
            />
            <Button
              variant="contained"
              onClick={handleFetchNotes}
              disabled={loading || !canFetch}
              sx={{ height: "56px", fontWeight: "bold", borderRadius: "10px" }}
            >
              Fetch Note Tables
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

          {statementData && years.length === 0 && !loading && !error && (
            <Alert severity="info" sx={{ my: 3, borderRadius: "10px" }}>
              No tables found for this Note / Year.
            </Alert>
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
                  ".MuiTabs-indicator": { backgroundColor: "#FF9800" },
                }}
              >
                {years.map((y) => (
                  <Tab
                    key={y}
                    label={y}
                    sx={{ textTransform: "none", fontWeight: "bold" }}
                  />
                ))}
              </Tabs>

              {/* Reuse your existing table renderer */}
              <TablesUI tables={currentTables} pages={[]} />
            </Box>
          )}
        </Paper>
      </Container>
    </ThemeProvider>
  );
};

export default FinancialStatementComponent;
