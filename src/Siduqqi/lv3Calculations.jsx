import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Paper,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  CircularProgress,
  Alert,
  Snackbar,
  Divider,
} from "@mui/material";
import { ThemeProvider } from "@emotion/react";
import LinkedinAITheme from "../LinkedinAI/style/LinkedinAITheme";

/**
 * Lv3Calculations
 * - Ask for client_id and doc ("S&M" | "G&A"). If provided via URL (/advisors/:client_id/:doc), auto-fetch.
 * - After fetch, show three views as tabs:
 *    1) Assumptions: editable growth_assumption for each param across years
 *    2) Forecast: table with years as columns, rows = param_name
 *    3) Historical: table with years as columns, rows = param_name
 * - "Recalculate" posts updated assumptions (and current data) to update API then re-fetches.
 * - Uses MUI components for a clean UI.
 */

const BASE_URL = "http://127.0.0.1:8000"; // adjust if needed

function a11yProps(index) {
  return {
    id: `lv3-tab-${index}`,
    "aria-controls": `lv3-tabpanel-${index}`,
  };
}

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`lv3-tabpanel-${index}`}
      aria-labelledby={`lv3-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

// Helpers -------------------------------------------------------------
const isYearKey = (k) => /^(19|20)\d{2}$/.test(String(k));
const numberFmt = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});
const toNumberOrEmpty = (v) =>
  v === null || v === undefined || v === "" ? "" : Number(v);

// Extract nested param objects under a section (forecasted/historical), skipping top-level labels
const extractParamItems = (sectionObj = {}) =>
  Object.entries(sectionObj)
    .filter(([key]) => key !== "param_name")
    .filter(([, val]) => val && typeof val === "object" && "param_name" in val)
    .map(([key, val]) => ({ id: key, ...val }));

// Collect year columns for a section. For assumptions, use growth_assumption years; otherwise numeric year keys
const collectYears = (items, { assumptions = false } = {}) => {
  const set = new Set();
  items.forEach((it) => {
    const source = assumptions ? it.growth_assumption : it;
    Object.keys(source || {}).forEach((k) => {
      if (assumptions) {
        if (isYearKey(k)) set.add(k);
      } else {
        if (isYearKey(k)) set.add(k);
      }
    });
  });
  return Array.from(set).sort();
};

export default function Lv3Calculations() {
  const params = useParams();
  const urlClient = params?.client_id
    ? decodeURIComponent(params.client_id)
    : "";
  const urlDoc = params?.doc ? decodeURIComponent(params.doc) : "";

  const [clientId, setClientId] = useState(urlClient);
  const [doc, setDoc] = useState(urlDoc);
  const docOptions = ["S&M", "G&A", "FA"];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null); // full server payload

  // editable assumptions: { [paramKey]: { [year]: number } }
  const [assumptions, setAssumptions] = useState({});
  const [baseKpis, setBaseKpis] = useState({});
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const fetchedOnceRef = useRef(false);

  const canAutoFetch = Boolean(urlClient && urlDoc && !fetchedOnceRef.current);

  // Derivations ------------------------------------------------------
  const forecastItems = useMemo(
    () => extractParamItems(data?.forecasted),
    [data]
  );
  const historicalItems = useMemo(
    () => extractParamItems(data?.historical),
    [data]
  );

  const assumptionYears = useMemo(
    () => collectYears(forecastItems, { assumptions: true }),
    [forecastItems]
  );
  const forecastYears = useMemo(
    () => collectYears(forecastItems),
    [forecastItems]
  );
  const historicalYears = useMemo(
    () => collectYears(historicalItems),
    [historicalItems]
  );

  // initialize assumptions & base_kpi from fetched data
  useEffect(() => {
    if (!data) return;
    const next = {};
    const nextBase = {};
    extractParamItems(data.forecasted).forEach((it) => {
      const ga = it.growth_assumption || {};
      next[it.id] = {};
      Object.keys(ga).forEach((yr) => {
        if (isYearKey(yr)) next[it.id][yr] = toNumberOrEmpty(ga[yr]);
      });
      nextBase[it.id] = it.base_kpi || "YoY%";
    });
    setAssumptions(next);
    setBaseKpis(nextBase);
  }, [data]);

  // Auto-fetch if params are present in URL
  useEffect(() => {
    if (canAutoFetch) {
      fetchedOnceRef.current = true;
      handleFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutoFetch]);

  const handleFetch = async () => {
    if (!clientId || !doc) {
      setError("Please enter Client ID and choose a document.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const url = `${BASE_URL}/calculation/lv3/fetch?client_id=${encodeURIComponent(
        clientId
      )}&doc=${encodeURIComponent(doc)}`;
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!data) return;
    setLoading(true);
    setError("");

    // Build updated forecasted with edited growth_assumption values merged back
    const updatedForecasted = Object.fromEntries(
      Object.entries(data.forecasted || {}).map(([k, v]) => {
        if (k === "param_name") return [k, v];
        if (!v || typeof v !== "object") return [k, v];
        const editedGA = assumptions?.[k] || {};
        const originalGA = v.growth_assumption || {};
        // merge: keep original keys but overwrite with edited where present
        const mergedGA = { ...originalGA };
        Object.keys(editedGA).forEach((yr) => {
          if (isYearKey(yr)) mergedGA[yr] = Number(editedGA[yr]);
        });
        const newBaseKpi = baseKpis?.[k] ?? v.base_kpi;
        return [k, { ...v, base_kpi: newBaseKpi, growth_assumption: mergedGA }];
      })
    );

    try {
      const res = await fetch(`${BASE_URL}/calculation/lv3/update`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          document: doc, // API expects "document" for POST
          historical_lv3: data.historical,
          forecasted_lv3: updatedForecasted,
        }),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      const json = await res.json();
      if (json?.success) {
        setSnack({
          open: true,
          message: "Recalculated successfully.",
          severity: "success",
        });
        // re-fetch to refresh values
        await handleFetch();
      } else {
        throw new Error("Update API returned an error.");
      }
    } catch (e) {
      console.error(e);
      setSnack({
        open: true,
        message: e.message || "Failed to recalculate",
        severity: "error",
      });
      setError(e.message || "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const handleAssumptionChange = (paramKey, year, value) => {
    setAssumptions((prev) => ({
      ...prev,
      [paramKey]: {
        ...(prev[paramKey] || {}),
        [year]: value === "" ? "" : Number(value),
      },
    }));
  };

  const handleBaseKpiChange = (paramKey, value) => {
    setBaseKpis((prev) => ({ ...prev, [paramKey]: value }));
  };

  // Renderers --------------------------------------------------------
  const renderToolbar = () => (
    <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <TextField
          label="Client ID"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="e.g., pwc-test-123456"
          size="small"
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="doc-select-label">Document</InputLabel>
          <Select
            labelId="doc-select-label"
            label="Document"
            value={doc || ""}
            onChange={(e) => setDoc(e.target.value)}
          >
            {docOptions.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={handleFetch} disabled={loading}>
            {loading ? "Loading..." : "Fetch"}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleRecalculate}
            disabled={!data || loading}
          >
            Recalculate
          </Button>
        </Stack>
      </Stack>
      {error && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}
    </Paper>
  );

  const AssumptionsTable = () => (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Assumptions (editable)
      </Typography>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
              Parameter
            </TableCell>
            <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
              Base KPI
            </TableCell>
            {assumptionYears.map((yr) => (
              <TableCell key={yr} align="right" sx={{ fontWeight: 700 }}>
                {yr}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {forecastItems.map((it) => (
            <TableRow key={it.id} hover>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                {it.param_name}
              </TableCell>
              <TableCell>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <Select
                    value={baseKpis?.[it.id] ?? it.base_kpi ?? "YoY%"}
                    onChange={(e) => handleBaseKpiChange(it.id, e.target.value)}
                  >
                    {["YoY%", "Sales%"].map((opt) => (
                      <MenuItem key={opt} value={opt}>
                        {opt}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </TableCell>
              {assumptionYears.map((yr) => (
                <TableCell key={yr} align="right">
                  <TextField
                    variant="outlined"
                    size="small"
                    value={assumptions?.[it.id]?.[yr] ?? ""}
                    onChange={(e) =>
                      handleAssumptionChange(it.id, yr, e.target.value)
                    }
                    type="number"
                    inputProps={{ inputMode: "decimal", step: "any" }}
                    sx={{ width: 110 }}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button
          variant="contained"
          onClick={handleRecalculate}
          disabled={!data || loading}
        >
          Recalculate
        </Button>
        <Button
          variant="text"
          onClick={() => {
            // reset from original data
            if (!data) return;
            const next = {};
            const nextBase = {};
            extractParamItems(data.forecasted).forEach((it) => {
              const ga = it.growth_assumption || {};
              next[it.id] = {};
              Object.keys(ga).forEach((yr) => {
                if (isYearKey(yr)) next[it.id][yr] = toNumberOrEmpty(ga[yr]);
              });
              nextBase[it.id] = it.base_kpi || "YoY%";
            });
            setAssumptions(next);
            setBaseKpis(nextBase);
          }}
          disabled={!data || loading}
        >
          Reset
        </Button>
      </Stack>
    </Paper>
  );

  const ForecastTable = () => (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Forecasted
      </Typography>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
              Parameter
            </TableCell>
            {forecastYears.map((yr) => (
              <TableCell key={yr} align="right" sx={{ fontWeight: 700 }}>
                {yr}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {forecastItems.map((it) => (
            <TableRow key={it.id} hover>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                {it.param_name}
              </TableCell>
              {forecastYears.map((yr) => (
                <TableCell key={yr} align="right">
                  {isYearKey(yr) && it[yr] !== undefined
                    ? numberFmt.format(it[yr])
                    : "—"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );

  const HistoricalTable = () => (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Historical
      </Typography>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
              Parameter
            </TableCell>
            {historicalYears.map((yr) => (
              <TableCell key={yr} align="right" sx={{ fontWeight: 700 }}>
                {yr}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {historicalItems.map((it) => (
            <TableRow key={it.id} hover>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                {it.param_name}
              </TableCell>
              {historicalYears.map((yr) => (
                <TableCell key={yr} align="right">
                  {isYearKey(yr) && it[yr] !== undefined
                    ? numberFmt.format(it[yr])
                    : "—"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 1200, mx: "auto" }}>
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
          Lv3 Calculations
        </Typography>
        <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
          Enter a Client ID and pick a document to load data. If you opened this
          page via a URL like
          <code> /advisors/&lt;client_id&gt;/&lt;doc&gt; </code>, it will
          auto-fetch.
        </Typography>

        {renderToolbar()}

        {loading && (
          <Stack alignItems="center" sx={{ my: 4 }}>
            <CircularProgress />
          </Stack>
        )}

        {data && !loading && (
          <Paper elevation={0} sx={{ p: 0 }}>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              aria-label="lv3 views"
              sx={{ borderBottom: 1, borderColor: "divider" }}
            >
              <Tab label="Assumptions" {...a11yProps(0)} />
              <Tab label="Forecast" {...a11yProps(1)} />
              <Tab label="Historical" {...a11yProps(2)} />
            </Tabs>

            <TabPanel value={tab} index={0}>
              <AssumptionsTable />
            </TabPanel>
            <TabPanel value={tab} index={1}>
              <ForecastTable />
            </TabPanel>
            <TabPanel value={tab} index={2}>
              <HistoricalTable />
            </TabPanel>
          </Paper>
        )}

        <Snackbar
          open={snack.open}
          autoHideDuration={3000}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
            severity={snack.severity}
            sx={{ width: "100%" }}
          >
            {snack.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
